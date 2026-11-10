import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { optionalRowsById } from "./graph";

// Kept exported from here so the fulfilment paths that already read orders
// through it keep one import.
export { optionalRows, mergeOptional } from "./graph";

/* ---------------------------------------------------------------------------
 * Paging orders for every reporting path, and the trap that made this shop's
 * sales report, its analytics, its day-close and its receipts all read ₮0.
 *
 * An order's money — `total`, `subtotal`, `discount_total`, `shipping_total`,
 * and `items.total` — is COMPUTED, not stored. The computation takes each
 * line's quantity from the line's `detail` relation. Ask for the totals
 * without asking for `items.detail.quantity` and Medusa computes them with a
 * quantity that is not there:
 *
 *     fields: ["id", "items.quantity", "items.unit_price"]
 *       → quantity 2, unit_price 499,000                      (correct)
 *     fields: [..., "total"]
 *       → total 0, items.total 0, and items.quantity GONE     (silently wrong)
 *     fields: [..., "total", "items.detail.quantity"]
 *       → total 998,000, items.total 998,000, quantity 2      (correct)
 *
 * Nothing throws and no row is dropped. The query succeeds and every figure is
 * zero — and it takes `items.quantity` down with it, so the obvious fallback
 * of multiplying price by quantity yields zero as well. That is why a day of
 * real sales could show as an empty report with nothing in the logs.
 *
 * So `items.detail.quantity` travels with the totals, always. It is in
 * ORDER_TOTAL_FIELDS for that reason and must not be removed.
 *
 * The totals are still fetched in a second query and merged on, so the page's
 * line items come from the plain query where `quantity` is known to be intact,
 * and a shop whose orders cannot be costed at all still gets its orders listed
 * with the value rebuilt from the basket (see ./money).
 * ------------------------------------------------------------------------ */

// `items.detail.quantity` is not optional decoration: without it every one of
// these computes to zero. See the header.
const ORDER_TOTAL_FIELDS = [
  "total", "discount_total", "refunded_total", "shipping_total",
  "items.detail.quantity",
];

// A promotion on a line item, so a discounted order is not reported at its
// full catalogue price. Carried with the totals because that is the query that
// knows the quantities; a line with no promotion simply has no adjustments.
const ITEM_ADJUSTMENT_FIELDS = ["items.adjustments.amount"];

export type OrderPage = { rows: any[]; totals: boolean };

export async function scanOrderPage(
  scope: { resolve: (k: any) => any },
  baseFields: string[],
  take: number,
  skip: number,
  preferTotals = true,
): Promise<OrderPage> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const pagination = { take, skip, order: { created_at: "DESC" as const } };

  // The page itself, from plain columns — no computed money here, so the
  // line quantities come back intact.
  const { data } = await query.graph({ entity: "order", fields: baseFields, pagination });
  const rows = (data || []) as any[];
  // Nothing on this page is nothing to be inexact about. Reported as false, an
  // empty page turned the caller's flag off for good — and since the scan runs
  // until a short page, the sales report carried its "totals could not be
  // loaded" warning on every run, including runs where every total was exact.
  if (!rows.length) return { rows, totals: true };
  if (!preferTotals) return { rows, totals: false };

  {
    const byId = await optionalRowsById(
      scope,
      "order",
      [...baseFields, ...ORDER_TOTAL_FIELDS, ...ITEM_ADJUSTMENT_FIELDS],
      rows.map((r) => r.id),
    );
    let everyOne = byId.size > 0;
    const merged = rows.map((r) => {
      const extra = byId.get(r.id);
      if (!extra) { everyOne = false; return r; }
      // Take the order's money, and attach each line's promotion to the line
      // we already have rather than swapping the basket wholesale: the lines
      // from this second query carry a `quantity` that the totals computation
      // rewrites, and the caller's money helpers read that field.
      const { items: promoted, ...orderMoney } = extra as any;
      const adjustments = new Map(
        ((promoted || []) as any[]).map((i) => [i.id, i.adjustments]),
      );
      return {
        ...r,
        ...orderMoney,
        items: ((r.items || []) as any[]).map((i) =>
          adjustments.has(i.id) ? { ...i, adjustments: adjustments.get(i.id) } : i,
        ),
      };
    });
    return { rows: merged, totals: everyOne };
  }
}

/**
 * Line-item fields every money calculation needs.
 *
 * `items.total` is computed and reads as 0 unless the order's totals were
 * asked for properly (see the header), so `unit_price` and `quantity` travel
 * with it — ./money prefers the computed figure and falls back to the two.
 */
export const ITEM_MONEY_FIELDS = [
  "items.quantity",
  "items.unit_price",
  "items.total",
];
