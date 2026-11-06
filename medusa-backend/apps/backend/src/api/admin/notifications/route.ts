import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { lowStockVariants } from "../../../lib/catalog";
import { countsAsRevenue, ubDayKey, ubDayStart } from "../../../lib/money";
import { remainingQuantities } from "../../../lib/fulfillment";

// GET /admin/notifications — operational alerts for the admin dashboard (spec
// A-29): low stock, pending returns, new orders today. Complements the email
// subscribers (order.placed / shipment.created). Guarded by orders.read.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const threshold = Math.max(0, Number((req.query as any)?.threshold ?? 5) || 5);

  // Low stock
  let lowStock: any[] = [];
  try { lowStock = await lowStockVariants(req.scope, threshold); } catch { /* inventory may be off */ }

  // Pending returns
  let pendingReturns = 0;
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: "return",
      fields: ["id", "status"],
      filters: { status: "requested" } as any,
      pagination: { take: 1000 },
    });
    pendingReturns = (data || []).length;
  } catch { /* returns optional */ }

  // New orders today — bounded to the Ulaanbaatar day, not the container's UTC
  // one, so at 02:00 local this stops showing yesterday's orders.
  let newOrdersToday = 0;
  try {
    const orderModule = req.scope.resolve(Modules.ORDER);
    const start = ubDayStart(ubDayKey(new Date()));
    const [, count] = await orderModule.listAndCountOrders(
      { created_at: { $gte: start } } as any,
      { take: 1, select: ["id"] as any },
    );
    newOrdersToday = count;
  } catch { /* ignore */ }

  // Orders still to pack or dispatch — the actual work queue. Without this the
  // panel could read all-clear while orders sat unfulfilled.
  let awaitingFulfilment = 0;
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "status", "items.id", "items.quantity",
        "fulfillments.canceled_at", "fulfillments.shipped_at",
        "fulfillments.items.line_item_id", "fulfillments.items.quantity"],
      pagination: { take: 200, order: { created_at: "DESC" } },
    });
    for (const o of (data || []) as any[]) {
      if (!countsAsRevenue(o.status)) continue;
      const fuls = (o.fulfillments || []).filter((f: any) => !f.canceled_at);
      const lines = (o.items || []).map((i: any) => ({ id: i.id, quantity: i.quantity }));
      if (remainingQuantities(lines, fuls).length || fuls.some((f: any) => !f.shipped_at)) {
        awaitingFulfilment++;
      }
    }
  } catch { /* ignore */ }

  // Reviews waiting for moderation — they could previously sit unseen for weeks.
  let pendingReviews = 0;
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: "review",
      fields: ["id", "status"],
      filters: { status: "pending" } as any,
      pagination: { take: 1000 },
    });
    pendingReviews = (data || []).length;
  } catch { /* review module optional */ }

  const items = [
    { key: "awaitingFulfilment", label: "Биелүүлэх хүлээгдэж буй захиалга", count: awaitingFulfilment, tone: awaitingFulfilment ? "warning" : "ok", href: "/app/fulfillment" },
    { key: "lowStock", label: "Бага нөөцтэй бараа", count: lowStock.length, tone: lowStock.length ? "warning" : "ok", href: "/app/catalog" },
    { key: "pendingReturns", label: "Хүлээгдэж буй буцаалт", count: pendingReturns, tone: pendingReturns ? "warning" : "ok", href: "/app/returns" },
    { key: "pendingReviews", label: "Хянах сэтгэгдэл", count: pendingReviews, tone: pendingReviews ? "warning" : "ok", href: "/app/reviews" },
    { key: "newOrdersToday", label: "Өнөөдрийн шинэ захиалга", count: newOrdersToday, tone: "info", href: "/app/fulfillment" },
  ];

  res.json({
    items,
    lowStockSample: lowStock.slice(0, 10),
    // Things that actually need someone to act. "New orders today" is
    // information, not a task, so it stays out of the total.
    total: awaitingFulfilment + lowStock.length + pendingReturns + pendingReviews,
  });
}
