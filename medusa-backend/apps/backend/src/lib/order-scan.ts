import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

// One way to page through orders for every reporting path.
//
// Why the two-attempt shape: order-level money fields (`total`, `discount_total`,
// `refunded_total`, `shipping_total`) are computed, and computing them pulls in
// shipping-method versions. The previous analytics code avoided them for exactly
// that reason — its comment recorded that loading order totals "requires
// shipping-method versions". They are the correct basis when they load, so we
// ask for them first and quietly fall back to the line-item fields alone if the
// graph refuses. Callers get `totals: false` on the lean path; the money helpers
// (see ./money) rebuild an order's value from its items in that case, so the
// numbers stay right — they simply exclude shipping.
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

  if (preferTotals) {
    try {
      const { data } = await query.graph({
        entity: "order",
        fields: [...baseFields, ...ORDER_TOTAL_FIELDS],
        pagination,
      });
      return { rows: (data || []) as any[], totals: true };
    } catch {
      /* fall through to the lean field set */
    }
  }

  const { data } = await query.graph({ entity: "order", fields: baseFields, pagination });
  return { rows: (data || []) as any[], totals: false };
}

/** Line-item fields every money calculation needs (promotion-aware). */
export const ITEM_MONEY_FIELDS = [
  "items.quantity",
  "items.unit_price",
  "items.total",
  "items.adjustments.amount",
];
