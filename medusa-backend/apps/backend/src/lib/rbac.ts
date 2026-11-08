// Role-based access control for the admin (spec A0 / A-27).
//
// The @medusajs/rbac module exists but its enforcement is undocumented/immature
// (spec risk AR-01), so we use a robust, stable model: the assigned role lives on
// user.metadata.role, permissions are a code-defined map (source of truth), and a
// middleware enforces them on our custom /admin/* routes.
//
// NOTE: Medusa's core admin routes (products/orders CRUD) can't be fully role-
// gated in v2 without deeper platform work; this governs our custom admin surface
// and the visibility of custom UI pages.

export type Role =
  | "super_admin"
  | "cashier"
  | "order_processor"
  | "catalog_manager"
  | "marketer"
  | "support"
  | "report_viewer";

export type Permission =
  | "catalog.read" | "catalog.write"
  | "orders.read" | "orders.write"
  | "returns.read" | "returns.write"
  | "inventory.write"
  | "customers.read" | "customers.write"
  | "promotions.write"
  | "content.write"
  | "analytics.read" | "reports.read"
  | "team.manage";

export const ROLES: { value: Role; label: string; permissions: Permission[] | ["*"] }[] = [
  { value: "super_admin", label: "Super Admin", permissions: ["*"] },
  // Shop-floor cashier: the POS and nothing else — sell, take payment, check a
  // discount code. No catalog, customers, reports or team access.
  { value: "cashier", label: "Кассчин (POS)", permissions: ["orders.read", "orders.write"] },
  { value: "order_processor", label: "Захиалга боловсруулагч", permissions: ["orders.read", "orders.write", "returns.read", "returns.write", "catalog.read"] },
  { value: "catalog_manager", label: "Каталог менежер", permissions: ["catalog.read", "catalog.write", "inventory.write", "orders.read", "analytics.read"] },
  { value: "marketer", label: "Маркетер", permissions: ["promotions.write", "content.write", "analytics.read", "reports.read", "catalog.read"] },
  { value: "support", label: "Дэмжлэг", permissions: ["orders.read", "customers.read", "customers.write", "returns.read", "returns.write"] },
  { value: "report_viewer", label: "Тайлан харагч", permissions: ["analytics.read", "reports.read"] },
];

const PERMS = new Map(ROLES.map(r => [r.value, r.permissions]));

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && PERMS.has(v as Role);
}

// Whether a role may perform a permission. Unknown/unset role → treated as
// super_admin so the existing sole admin is never locked out (roles are opt-in).
export function can(role: string | undefined | null, perm: Permission): boolean {
  const p = isRole(role) ? PERMS.get(role)! : ["*" as const];
  return p[0] === "*" || (p as Permission[]).includes(perm);
}

// Bootstrap super-admins from env (comma-separated emails), lower-cased.
function bootstrapEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Enforcement decision for a specific acting user — closes M2 (a newly-invited,
// role-less admin silently getting super_admin) WITHOUT risking lockout:
//   • role set        → normal `can()` check.
//   • role-less + SUPER_ADMIN_EMAILS configured → allow ONLY if the user's email
//     is on that bootstrap allowlist, else DENY (deny-by-default).
//   • role-less + env unset + this is the ONLY admin account → allow. That is
//     the shop owner before anyone else exists; locking them out would brick
//     the admin.
//   • role-less + env unset + other admins exist → DENY.
//
// That last rule is the one that matters in practice. SUPER_ADMIN_EMAILS is not
// set on this deployment, so under the old "env unset → allow" default the very
// first staff member invited would silently receive full super-admin rights —
// including team.manage and the customer PII export — without anyone choosing
// that. Deriving the bootstrap from "there is exactly one admin" keeps the solo
// owner working with no configuration, and makes every later account start with
// nothing until a role is assigned on the Team page.
export function canActor(
  actor: { role?: string | null; email?: string | null; soleAdmin?: boolean },
  perm: Permission,
): boolean {
  if (isRole(actor.role)) return can(actor.role, perm);
  const bootstrap = bootstrapEmails();
  if (bootstrap.length > 0) return bootstrap.includes((actor.email || "").toLowerCase());
  // No allowlist configured: only the lone original admin is trusted implicitly.
  return actor.soleAdmin !== false;
}

// --- Cashier lock -----------------------------------------------------------
//
// The permission map above governs the admin routes we wrote. Medusa's core
// admin API (products, orders, promotions, users, inventory …) has no role
// model of its own in v2, so a cashier holding a valid admin session could call
// it directly and rewrite a price or read every customer — the custom pages
// being hidden from them is UI, not a control.
//
// cashierMayCall is the rule that closes it. It applies to the cashier role and
// to nobody else: every other role, including a user with no role at all, is
// unaffected, so no existing admin can be locked out by it.

// What the till actually uses.
const CASHIER_ALLOW: { re: RegExp; methods: string[] }[] = [
  // The POS screen (sell, take payment) and the day-close report.
  { re: /^\/admin\/offline-sale(\/qpay)?$/, methods: ["GET", "POST"] },
  // Checking a discount code at the till.
  { re: /^\/admin\/marketing\/validate-code$/, methods: ["POST"] },
  // The admin shell and usePermissions need to know who is signed in.
  { re: /^\/admin\/users\/me$/, methods: ["GET"] },
];

// Collections a cashier has no business browsing. A denied READ of one of
// these answers with an EMPTY list rather than an error: Medusa lands a fresh
// session on /app/orders, and a 403 there takes the whole admin screen down —
// including the cashier own way into the POS. An empty page shows them
// nothing and keeps the shell alive.
//
// Everything NOT listed here stays readable, because the shell needs the
// store, regions, currencies and the like just to render money and dates.
const CASHIER_PRIVATE_READ =
  /^\/admin\/(users|invites|api-keys|customers|orders|draft-orders|order-edits|products|product-categories|product-types|product-tags|collections|inventory-items|price-lists|pricing|promotions|campaigns|reports|analytics|audit|crm|team|ebarimt|returns|claims|exchanges|payments|refund-reasons|reservations)(\/|$)/;

export type CashierVerdict =
  /** let it through */
  | "allow"
  /** answer 200 with an empty collection — nothing leaks, nothing crashes */
  | "empty"
  /** refuse outright */
  | "deny";

/**
 * What should happen to this admin request when a cashier makes it?
 *
 * Writes are deny-by-default: only what the till actually posts gets through.
 * Reads are allow-by-default, except the private collections above, which come
 * back empty so no page the cashier lands on can take the admin down.
 */
export function cashierVerdict(method: string, path: string): CashierVerdict {
  const m = String(method || "GET").toUpperCase();
  const p = String(path || "").split("?")[0];
  if (CASHIER_ALLOW.some(a => a.methods.includes(m) && a.re.test(p))) return "allow";
  if (m !== "GET") return "deny";
  if (!CASHIER_PRIVATE_READ.test(p)) return "allow";
  // A top-level collection can be answered empty; a single record cannot be
  // faked, but it is unreachable anyway once its list comes back empty.
  return /^\/admin\/[a-z-]+\/?$/.test(p) ? "empty" : "deny";
}

/** The response key Medusa would have used, e.g. /admin/api-keys → api_keys. */
export function cashierEmptyKey(path: string): string {
  const seg = String(path || "").split("?")[0].replace(/\/+$/, "").split("/").pop() || "items";
  return seg.replace(/-/g, "_");
}
