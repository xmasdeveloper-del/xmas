import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { countsAsRevenue, lineItemRevenue, num, orderRevenue } from "../../../../lib/money";
import { ITEM_MONEY_FIELDS, scanOrderPage } from "../../../../lib/order-scan";

// GET /admin/analytics/overview — sales KPIs, top products, recent orders.
//
// Revenue is what the shop kept: order total net of promotions and refunds,
// with cancelled/draft/archived orders excluded. The earlier version summed
// `unit_price × quantity`, i.e. the catalogue price, so every order paid with
// XMAS10/XMAS20 was reported at full value and a cancelled order kept counting.
// `scanOrderPage` prefers real order totals and falls back to rebuilding from
// line items if they cannot be loaded (see lib/order-scan).
const MAX_SCAN = 5000;
const PAGE = 500;

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderModule = req.scope.resolve(Modules.ORDER);
  const customerModule = req.scope.resolve(Modules.CUSTOMER);

  const [, orderCount] = await orderModule.listAndCountOrders({}, { take: 1, select: ["id"] as any });

  let customerCount = 0;
  try {
    const [, c] = await customerModule.listAndCountCustomers({}, { take: 1, select: ["id"] as any });
    customerCount = c;
  } catch { /* optional */ }

  let revenue = 0;
  let scanned = 0; // orders that counted as revenue
  let seen = 0;    // rows examined, including cancelled/draft ones
  let capped = false;
  const productAgg = new Map<string, { qty: number; revenue: number }>();
  const recent: { id: string; email: string; total: number; date: string }[] = [];

  for (let skip = 0; skip < MAX_SCAN; skip += PAGE) {
    const { rows: orders } = await scanOrderPage(
      req.scope,
      [
        "id", "display_id", "email", "created_at", "status",
        "items.title", "items.product_title", ...ITEM_MONEY_FIELDS,
      ],
      PAGE,
      skip,
    );
    for (const o of orders) {
      seen++;
      // Cancelled, draft and archived orders are not revenue.
      if (!countsAsRevenue(o.status)) continue;
      for (const it of o.items || []) {
        const key = it.product_title || it.title || "Бараа";
        const a = productAgg.get(key) || { qty: 0, revenue: 0 };
        a.qty += num(it.quantity);
        a.revenue += lineItemRevenue(it);
        productAgg.set(key, a);
      }
      const kept = orderRevenue(o);
      revenue += kept;
      scanned++;
      if (recent.length < 8) {
        recent.push({ id: o.display_id ? `#${o.display_id}` : o.id, email: o.email, total: kept, date: o.created_at });
      }
    }
    if (orders.length < PAGE) break;
    if (skip + PAGE >= MAX_SCAN) capped = true;
  }

  const topProducts = [...productAgg.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  res.json({
    // `orders` counts the same population the revenue is built from, so the
    // two KPIs always describe the same set. `allOrders` keeps the raw total
    // (including cancelled and draft) available for reference.
    orders: scanned,
    allOrders: orderCount,
    customers: customerCount,
    revenue: Math.round(revenue),
    avgOrder: scanned ? Math.round(revenue / scanned) : 0,
    scanned,
    seen,
    capped,
    topProducts,
    recent,
  });
}
