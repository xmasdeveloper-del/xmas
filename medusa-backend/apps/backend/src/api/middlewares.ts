import { authenticate, defineMiddlewares, MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { canActor, cashierVerdict, cashierEmptyKey, Permission } from "../lib/rbac";
import { rateLimit } from "../lib/rate-limit";

// Auth throttles (H9): brute-force / credential-stuffing on login, and spam on
// signup + password-reset. Separate buckets so one endpoint can't exhaust another.
const loginLimit = rateLimit({ name: "auth-login", windowMs: 15 * 60_000, max: 10 });
const registerLimit = rateLimit({ name: "auth-register", windowMs: 60 * 60_000, max: 10 });
const resetLimit = rateLimit({ name: "auth-reset", windowMs: 15 * 60_000, max: 5 });
// Review writes are cheap to spam, so cap them per client as well as per account
// (the route itself already allows one review per customer per product).
const reviewLimit = rateLimit({ name: "store-review", windowMs: 60 * 60_000, max: 12 });
// The newsletter box is an unauthenticated write, so it is the easiest thing
// on the site to spam. One address at a time, a handful an hour per client.
const newsletterLimit = rateLimit({ name: "store-newsletter", windowMs: 60 * 60_000, max: 8 });

// RBAC guard (spec A0): enforce a permission on our custom /admin routes based on
// the acting user's role (user.metadata.role). Role-less users are treated as
// super_admin (see lib/rbac) so the existing admin is never locked out.
//
// NOTE on matchers: Medusa's middleware loader runs `String(matcher)` and hands the
// result to Express as a path, so matchers MUST be Express path strings (globs /
// ":param"), never RegExp — a RegExp stringifies to a path that matches nothing.
// The config field is `methods` (plural).
function requirePermission(...perms: Permission[]) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const userId = (req as any).auth_context?.actor_id;
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    try {
      const userModule = req.scope.resolve(Modules.USER);
      const user: any = await userModule.retrieveUser(userId, { select: ["id", "email", "metadata"] as any });
      const role = user?.metadata?.role;
      // A role-less user is only trusted implicitly while they are the single
      // admin account (the shop owner before any staff exist). The moment a
      // second admin is invited, role-less means no permissions until the Team
      // page grants some — otherwise every new hire would arrive as a super
      // admin. Only looked up when the user has no role, so the common path
      // stays a single query.
      let soleAdmin: boolean | undefined;
      if (!role) {
        try {
          const [, adminCount] = await userModule.listAndCountUsers({}, { take: 1, select: ["id"] as any });
          soleAdmin = adminCount <= 1;
        } catch {
          soleAdmin = undefined; // cannot tell → fall back to permissive
        }
      }
      const actor = { role, email: user?.email, soleAdmin };
      if (!perms.some((p) => canActor(actor, p))) {
        res.status(403).json({ message: `Эрх хүрэлцэхгүй (${perms.join(" / ")})` });
        return;
      }
      next();
    } catch (e) {
      next(e as Error);
    }
  };
}

// Admin file uploads (Зураг оруулах, Хувилбарын зураг, CMS). Core
// /admin/uploads takes any file from any signed-in admin and has no size limit
// of its own, so a mistyped upload can fill the disk. Size is checked from the
// header before the body is read; either catalog or content write may upload,
// since product photos and CMS artwork go through the same endpoint.
const UPLOAD_MAX_BYTES = 30 * 1024 * 1024;

function guardUpload(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const len = Number(req.headers["content-length"] || 0);
  if (!len || len > UPLOAD_MAX_BYTES) {
    res.status(413).json({ message: "Файл хэт том байна (дээд тал нь 30MB)" });
    return;
  }
  return requirePermission("catalog.write", "content.write")(req, res, next);
}

// POS-only lock for the cashier role. The rule itself lives in lib/rbac
// (cashierVerdict) so it is unit-tested; this only resolves who is calling.
//
// It runs before every other admin guard because Medusa core admin routes have
// no role model of their own: hiding the custom pages from a cashier is UI, not
// a control — a valid session could still rewrite a price over the core API.
// Any role other than cashier — including a user with no role at all — passes
// straight through, so nobody can be locked out by it.
async function cashierLock(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const userId = (req as any).auth_context?.actor_id;
  if (!userId) return next(); // unauthenticated → core auth answers first

  let role: unknown;
  try {
    const user: any = await req.scope
      .resolve(Modules.USER)
      .retrieveUser(userId, { select: ["id", "metadata"] as any });
    role = user?.metadata?.role;
  } catch {
    return next(); // lookup failed → leave the decision to the route's own guard
  }
  if (role !== "cashier") return next();

  const path = String(req.originalUrl || req.url || "");
  const verdict = cashierVerdict(req.method, path);
  if (verdict === "allow") return next();
  if (verdict === "empty") {
    // Answer as the collection would, but with nothing in it. A 403 here would
    // blank the whole admin screen — Medusa drops a fresh session on
    // /app/orders — and take the cashier's own POS page down with it.
    res.json({ [cashierEmptyKey(path)]: [], count: 0, offset: 0, limit: 0 });
    return;
  }
  res.status(403).json({ message: "Кассчин зөвхөн кассын системд хандах эрхтэй" });
}

// Keys the shop keeps on a customer record that the customer themselves must
// never read or overwrite. `metadata` is part of Medusa's public store customer
// payload and `BaseUpdateCustomer` accepts it, so an internal note like
// "утсаар хэрэлдсэн, дахиж зээлээр өгөхгүй" was readable by that customer
// through their own login — and they could blank it. Rather than move the notes
// to their own table (a migration on a live shop), we close both directions at
// the edge: metadata never comes back out, and the customer cannot send it in.
const PRIVATE_CUSTOMER_METADATA = ["note", "note_at", "note_by", "deletion_requested_at"];

function protectCustomerMetadata() {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    // Inbound: a customer has no business setting arbitrary metadata on itself.
    const body = (req as any).body;
    if (body && typeof body === "object" && "metadata" in body) delete body.metadata;

    // Outbound: strip the private keys from whatever customer object is returned.
    const sendJson = res.json.bind(res);
    (res as any).json = (payload: any) => {
      try {
        const c = payload?.customer;
        if (c && c.metadata && typeof c.metadata === "object") {
          const metadata = { ...c.metadata };
          for (const k of PRIVATE_CUSTOMER_METADATA) delete metadata[k];
          payload = { ...payload, customer: { ...c, metadata } };
        }
      } catch { /* a filtering slip must never break the response */ }
      return sendJson(payload);
    };
    next();
  };
}

export default defineMiddlewares({
  routes: [
    // --- Customer privacy: keep shop-internal notes off the storefront API ---
    {
      matcher: "/store/customers/me",
      methods: ["GET", "POST"],
      middlewares: [protectCustomerMetadata()],
    },

    // --- Auth rate limiting (login / register / password reset), both actor types ---
    // Runs before every other admin guard: the core Medusa admin API has no
    // role model of its own, so this is what actually keeps a cashier inside
    // the POS. No effect on any other role.
    { matcher: "/admin/*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], middlewares: [cashierLock] },

    { matcher: "/auth/:actor/emailpass", methods: ["POST"], middlewares: [loginLimit] },
    { matcher: "/auth/:actor/emailpass/register", methods: ["POST"], middlewares: [registerLimit] },
    { matcher: "/auth/:actor/emailpass/reset-password", methods: ["POST"], middlewares: [resetLimit] },

    // --- Customer reviews ---
    // Store POSTs need the customer on req.auth_context; GETs stay public, so
    // authentication is optional here and the route itself rejects anonymous writes.
    {
      matcher: "/store/reviews",
      methods: ["POST"],
      middlewares: [reviewLimit, authenticate("customer", ["bearer", "session"], { allowUnauthenticated: true })],
    },
    // --- Newsletter ---
    { matcher: "/store/newsletter", methods: ["POST"], middlewares: [newsletterLimit] },
    // The list is customer data; reading it is the same trust as the CRM.
    { matcher: "/admin/newsletter", methods: ["GET"], middlewares: [requirePermission("customers.read")] },

    // Moderation is content work — the marketer role already carries it.
    { matcher: "/admin/reviews", methods: ["GET"], middlewares: [requirePermission("content.write")] },
    { matcher: "/admin/reviews/*", methods: ["POST", "DELETE"], middlewares: [requirePermission("content.write")] },

    { matcher: "/admin/catalog/*", methods: ["GET"], middlewares: [requirePermission("catalog.read")] },
    { matcher: "/admin/catalog/*", methods: ["POST"], middlewares: [requirePermission("catalog.write")] },
    { matcher: "/admin/analytics/*", methods: ["GET"], middlewares: [requirePermission("analytics.read")] },
    { matcher: "/admin/fulfillment/*", methods: ["GET"], middlewares: [requirePermission("orders.read")] },
    { matcher: "/admin/fulfillment/*", methods: ["POST"], middlewares: [requirePermission("orders.write")] },
    { matcher: "/admin/offline-sale", methods: ["GET"], middlewares: [requirePermission("orders.read")] },
    { matcher: "/admin/offline-sale", methods: ["POST"], middlewares: [requirePermission("orders.write")] },
    { matcher: "/admin/offline-sale/qpay", methods: ["GET", "POST"], middlewares: [requirePermission("orders.write")] },
    { matcher: "/admin/crm/*", methods: ["GET"], middlewares: [requirePermission("customers.read")] },
    { matcher: "/admin/crm/*", methods: ["POST"], middlewares: [requirePermission("customers.write")] },
    { matcher: "/admin/cms/*", methods: ["GET", "POST"], middlewares: [requirePermission("content.write")] },
    { matcher: "/admin/reports/*", methods: ["GET"], middlewares: [requirePermission("reports.read")] },
    { matcher: "/admin/marketing/*", methods: ["GET"], middlewares: [requirePermission("promotions.write")] },
    { matcher: "/admin/audit", methods: ["GET"], middlewares: [requirePermission("team.manage")] },
    { matcher: "/admin/notifications", methods: ["GET"], middlewares: [requirePermission("orders.read")] },
    { matcher: "/admin/returns/:id/approve", methods: ["POST"], middlewares: [requirePermission("returns.write")] },
    { matcher: "/admin/returns/:id/reject", methods: ["POST"], middlewares: [requirePermission("returns.write")] },
    { matcher: "/admin/users/:id/role", methods: ["POST"], middlewares: [requirePermission("team.manage")] },

    // --- Routes the newly added admin pages drive ---
    // Granting a code to a named customer is a marketing action, so it sits
    // under /admin/marketing (a marketer has no customer permissions).
    { matcher: "/admin/marketing/validate-code", methods: ["POST"], middlewares: [requirePermission("orders.write")] },
    { matcher: "/admin/marketing/coupons", methods: ["POST"], middlewares: [requirePermission("promotions.write")] },
    // Хувилбарын зураг writes per-variant images through the core variant route.
    { matcher: "/admin/products/:id/variants/:variantId", methods: ["POST"], middlewares: [requirePermission("catalog.write")] },
    { matcher: "/admin/uploads", methods: ["POST"], middlewares: [guardUpload] },
    { matcher: "/admin/uploads/presigned-urls", methods: ["POST"], middlewares: [requirePermission("catalog.write")] },
    { matcher: "/admin/uploads/:id", methods: ["DELETE"], middlewares: [requirePermission("catalog.write")] },
  ],
});
