import { authenticate, defineMiddlewares, MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { canActor, Permission } from "../lib/rbac";
import { rateLimit } from "../lib/rate-limit";

// Auth throttles (H9): brute-force / credential-stuffing on login, and spam on
// signup + password-reset. Separate buckets so one endpoint can't exhaust another.
const loginLimit = rateLimit({ name: "auth-login", windowMs: 15 * 60_000, max: 10 });
const registerLimit = rateLimit({ name: "auth-register", windowMs: 60 * 60_000, max: 10 });
const resetLimit = rateLimit({ name: "auth-reset", windowMs: 15 * 60_000, max: 5 });
// Review writes are cheap to spam, so cap them per client as well as per account
// (the route itself already allows one review per customer per product).
const reviewLimit = rateLimit({ name: "store-review", windowMs: 60 * 60_000, max: 12 });

// RBAC guard (spec A0): enforce a permission on our custom /admin routes based on
// the acting user's role (user.metadata.role). Role-less users are treated as
// super_admin (see lib/rbac) so the existing admin is never locked out.
//
// NOTE on matchers: Medusa's middleware loader runs `String(matcher)` and hands the
// result to Express as a path, so matchers MUST be Express path strings (globs /
// ":param"), never RegExp — a RegExp stringifies to a path that matches nothing.
// The config field is `methods` (plural).
function requirePermission(perm: Permission) {
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
      // canActor enforces deny-by-default for role-less users when
      // SUPER_ADMIN_EMAILS is configured; otherwise keeps the no-lockout default.
      if (!canActor({ role, email: user?.email }, perm)) {
        res.status(403).json({ message: `Эрх хүрэлцэхгүй (${perm})` });
        return;
      }
      next();
    } catch (e) {
      next(e as Error);
    }
  };
}

export default defineMiddlewares({
  routes: [
    // --- Auth rate limiting (login / register / password reset), both actor types ---
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
  ],
});
