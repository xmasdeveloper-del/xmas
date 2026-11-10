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

// A promotion on a line item. Asked for separately for the same reason as the
// order totals: a line with no promotion has no adjustments, and requiring the
// relation drops the LINE rather than returning it with none — which left the
// orders present but every one of them apparently worth nothing and holding no
// goods. Only a line that actually carries a promotion needs this; the rest are
// priced from `items.total`, which is already net of one.
const ITEM_ADJUSTMENT_FIELDS = ["items.adjustments.amount"];

/**
 * Rows for a query that reaches through an OPTIONAL relation, keyed by id.
 *
 * Requiring a relation some rows lack drops those rows rather than returning
 * them without it — an order with no delivery, a line with no promotion, an
 * order nobody has packed yet. So a query like this can never be the source of
 * which rows exist: hold the row set already, and merge what comes back here
 * onto it. Answers an empty map rather than throwing, because a missing
 * optional is not a reason to fail the screen that asked.
 */
export async function optionalRows(
  scope: { resolve: (k: any) => any },
  entity: string,
  fields: string[],
  pagination: Record<string, unknown>,
): Promise<Map<string, any>> {
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({ entity, fields, pagination });
    return new Map(((data || []) as any[]).map((r) => [r.id, r]));
  } catch {
    return new Map();
  }
}

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

  {
    const byId = await optionalRows(
      scope,
      "order",
      [...baseFields, ...ORDER_TOTAL_FIELDS, ...ITEM_ADJUSTMENT_FIELDS],
      pagination,
    );
    let everyOne = byId.size > 0;
    const merged = rows.map((r) => {
      const extra = byId.get(r.id);
      if (!extra) { everyOne = false; return r; }
      // Take the order's money, but keep the authoritative line items — the
      // enriched copy only holds the lines that carry a promotion, so spreading
      // it wholesale would throw the rest away again. Adjustments are attached
      // per line, to the lines we already have.
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

/** Line-item fields every money calculation needs (promotion-aware). */
// Only fields every line item has. A relation that some lines lack belongs in
// the enrichment above, never here — requiring one drops the lines without it.
export const ITEM_MONEY_FIELDS = [
  "items.quantity",
  "items.unit_price",
  "items.total",
];
