import { countsAsRevenue, orderRevenue } from "./money";
import { ITEM_MONEY_FIELDS, scanOrderPage } from "./order-scan";

// CRM aggregation for the admin customer view (spec A3 / A-17, A-18).
// LTV = Σ (what the customer actually paid) across their orders — the same
// basis as the sales report: net of promotions and refunds, and excluding
// cancelled/draft orders. It used to be Σ (unit_price × quantity), which
// counted the catalogue price, so a customer who only ever bought with XMAS20
// looked like a bigger spender than they were and could reach VIP on discount
// alone. Segments are derived, not stored, so they stay correct without a
// maintenance job.

export const VIP_LTV = 500_000; // ₮ lifetime spend to count as VIP
export const NEW_DAYS = 30; // account younger than this = "new"
export const INACTIVE_DAYS = 90; // no order in this many days = "inactive"

const MAX_SCAN = 5000;
const PAGE = 500;
const DAY = 86_400_000;

export type Agg = { ltv: number; orders: number; lastOrder: number | null };
export type Segment = "vip" | "new" | "active" | "inactive" | "none";

// Aggregate every (bounded) order by customer_id.
export async function aggregateByCustomer(scope: { resolve: (k: any) => any }) {
  const map = new Map<string, Agg>();
  for (let skip = 0; skip < MAX_SCAN; skip += PAGE) {
    const { rows: orders } = await scanOrderPage(
      scope,
      ["id", "customer_id", "created_at", "status", ...ITEM_MONEY_FIELDS],
      PAGE,
      skip,
    );
    for (const o of orders) {
      const cid = o.customer_id;
      if (!cid) continue;
      // A cancelled or draft order is not lifetime value.
      if (!countsAsRevenue(o.status)) continue;
      const a = map.get(cid) || { ltv: 0, orders: 0, lastOrder: null };
      a.ltv += orderRevenue(o);
      a.orders += 1;
      const t = new Date(o.created_at).getTime();
      if (a.lastOrder === null || t > a.lastOrder) a.lastOrder = t;
      map.set(cid, a);
    }
    if (orders.length < PAGE) break;
  }
  return map;
}

// Derive a customer's segment from aggregate + account age. `now` is passed in
// (Date.now is fine in route handlers; kept a param for testability).
export function segmentOf(agg: Agg | undefined, createdAt: string | Date, now: number): Segment {
  const created = new Date(createdAt).getTime();
  if ((agg?.ltv || 0) >= VIP_LTV) return "vip";
  if (now - created <= NEW_DAYS * DAY) return "new";
  if (!agg || agg.orders === 0) return "none";
  if (agg.lastOrder != null && now - agg.lastOrder > INACTIVE_DAYS * DAY) return "inactive";
  return "active";
}

export const SEGMENT_LABEL: Record<Segment, string> = {
  vip: "VIP",
  new: "Шинэ",
  active: "Идэвхтэй",
  inactive: "Идэвхгүй",
  none: "Захиалгагүй",
};
