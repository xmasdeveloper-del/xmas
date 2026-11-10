import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

// One way to page through orders for every reporting path.
//
// Order-level money fields (`total`, `discount_total`, `refunded_total`,
// `shipping_total`) are computed, and computing them pulls in shipping-method
// versions. An order with NO shipping method — every sale rung up at the till,
// because nothing is being delivered — is dropped by that join rather than
// returned with empty totals.
//
// This used to ask for the totals first and fall back only if the graph threw.
// It does not throw: it answers successfully, just without those orders. So a
// shop whose only sales were in-store saw an empty sales report and empty
// analytics while the till's own counter showed the money, and nothing in the
// logs looked wrong.
//
// So the lean set is fetched first and is authoritative — every order on the
// page is reported, whether or not it was ever going to be delivered. Totals
// are then asked for separately and merged in where they exist; an order that
// has none has its value rebuilt from its line items by the money helpers (see
// ./money), which is correct and simply excludes a delivery charge it never
// had. `totals` is false when any order on the page had to be rebuilt that way.
//
// This must never throw for a reason the caller cannot act on: a report that
// errors is worse than a report that omits the delivery charge.

const ORDER_TOTAL_FIELDS = ["total", "discount_total", "refunded_total", "shipping_total"];

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

  // Authoritative: every order on this page, delivered or not.
  const { data } = await query.graph({ entity: "order", fields: baseFields, pagination });
  const rows = (data || []) as any[];
  if (!preferTotals || !rows.length) return { rows, totals: false };

  try {
    const { data: priced } = await query.graph({
      entity: "order",
      fields: [...baseFields, ...ORDER_TOTAL_FIELDS],
      pagination,
    });
    const byId = new Map(((priced || []) as any[]).map((o) => [o.id, o]));
    let everyOne = true;
    const merged = rows.map((r) => {
      const withTotals = byId.get(r.id);
      if (!withTotals) { everyOne = false; return r; }
      return { ...r, ...withTotals };
    });
    return { rows: merged, totals: everyOne };
  } catch {
    // Totals unavailable for the whole page — the items are still there.
    return { rows, totals: false };
  }
}

/** Line-item fields every money calculation needs (promotion-aware). */
export const ITEM_MONEY_FIELDS = [
  "items.quantity",
  "items.unit_price",
  "items.total",
  "items.adjustments.amount",
];
