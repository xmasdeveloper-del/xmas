import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  countsAsRevenue, lineItemRevenue, mnt, num, orderRevenue, ubDayKey, ubRange,
} from "./money";
import { ITEM_MONEY_FIELDS, scanOrderPage } from "./order-scan";

// Sales reporting (spec A-24/25/26).
//
// Revenue is what the shop actually kept: `order.total` (already net of any
// promotion, and inclusive of shipping) minus anything refunded. That is the
// figure that reconciles with the order page, the bank statement and the VAT
// return. Three things this deliberately does that the first version did not:
//
//   • Promotions are subtracted. The old basis was `unit_price × quantity`,
//     the catalogue price — with XMAS20 live, an order paid at ₮279,200 was
//     reported as ₮349,000. See lineItemRevenue() in ./money.
//   • Cancelled, draft and archived orders are excluded. They are not
//     soft-deleted, so an order cancelled in the admin kept earning revenue.
//   • Days are Ulaanbaatar days (UTC+8), not UTC ones, so evening trade — the
//     shop's peak — is no longer credited to the following day.
//
// MNT prices are VAT-inclusive (Mongolia, 10%), so net and VAT are extracted
// from the gross.

export const VAT_RATE = 0.1;
const MAX_SCAN = 20000;
const PAGE = 500;

export type SalesReport = {
  from: string | null;
  to: string | null;
  totals: {
    revenue: number;    // charged minus refunded — the money kept
    orders: number;
    aov: number;
    net: number;        // revenue excluding VAT
    vat: number;
    discounts: number;  // what promotions gave away
    refunds: number;    // what went back to customers
    shipping: number;   // delivery charged (part of revenue, not of product rows)
  };
  daily: { date: string; revenue: number; orders: number }[];
  byCategory: { name: string; revenue: number; qty: number }[];
  byProduct: { name: string; revenue: number; qty: number }[];
  scanned: number;
  capped: boolean;
  /** False if shipping/discount totals were unavailable and revenue came from line items. */
  totalsExact: boolean;
};

// productId → category name (first category), for the by-category breakdown.
async function productCategoryMap(scope: { resolve: (k: any) => any }) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const map = new Map<string, string>();
  for (let skip = 0; skip < 50000; skip += 1000) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "categories.name"],
      pagination: { take: 1000, skip },
    });
    const batch = (data || []) as any[];
    for (const p of batch) map.set(p.id, (p.categories?.[0]?.name as string) || "Ангилалгүй");
    if (batch.length < 1000) break;
  }
  return map;
}

export async function salesReport(
  scope: { resolve: (k: any) => any },
  fromISO?: string,
  toISO?: string,
): Promise<SalesReport> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  // Ulaanbaatar day boundaries, expressed as the UTC instants that bound them.
  const { from, to } = ubRange(fromISO, toISO);

  const catMap = await productCategoryMap(scope);

  const daily = new Map<string, { revenue: number; orders: number }>();
  const byCat = new Map<string, { revenue: number; qty: number }>();
  const byProd = new Map<string, { revenue: number; qty: number }>();
  let revenue = 0;
  let discounts = 0;
  let refunds = 0;
  let shipping = 0;
  let orders = 0;
  let scanned = 0;
  let capped = false;
  // False when order-level totals could not be loaded and revenue had to be
  // rebuilt from line items — correct, but excluding the delivery charge.
  let totalsExact = true;

  for (let skip = 0; skip < MAX_SCAN; skip += PAGE) {
    const { rows: batch, totals: exact } = await scanOrderPage(
      scope,
      [
        "id", "created_at", "status",
        "items.id", "items.title", "items.product_title", "items.product_id",
        ...ITEM_MONEY_FIELDS,
      ],
      PAGE,
      skip,
    );
    if (!exact) totalsExact = false;
    for (const o of batch) {
      // Cancelled/draft/archived orders are not money the shop took.
      if (!countsAsRevenue(o.status)) continue;
      const created = new Date(o.created_at);
      if (from && created < from) continue;
      if (to && created > to) continue;
      scanned++;

      const day = ubDayKey(created);
      for (const it of o.items || []) {
        const sub = lineItemRevenue(it);
        const qty = num(it.quantity);
        const pname = it.product_title || it.title || "Бараа";
        const pAgg = byProd.get(pname) || { revenue: 0, qty: 0 };
        pAgg.revenue += sub; pAgg.qty += qty; byProd.set(pname, pAgg);
        const cname = it.product_id ? (catMap.get(it.product_id) || "Ангилалгүй") : "Ангилалгүй";
        const cAgg = byCat.get(cname) || { revenue: 0, qty: 0 };
        cAgg.revenue += sub; cAgg.qty += qty; byCat.set(cname, cAgg);
      }

      const kept = orderRevenue(o);
      const d = daily.get(day) || { revenue: 0, orders: 0 };
      d.revenue += kept; d.orders += 1; daily.set(day, d);
      revenue += kept;
      discounts += mnt(o.discount_total);
      refunds += mnt(o.refunded_total);
      shipping += mnt(o.shipping_total);
      orders++;
    }
    if (batch.length < PAGE) break;
    if (skip + PAGE >= MAX_SCAN) capped = true;
  }

  const net = Math.round(revenue / (1 + VAT_RATE));
  const vat = revenue - net;

  return {
    from: from ? ubDayKey(from) : null,
    to: to ? ubDayKey(to) : null,
    totals: {
      revenue, orders, aov: orders ? Math.round(revenue / orders) : 0,
      net, vat, discounts, refunds, shipping,
    },
    daily: [...daily.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    byCategory: [...byCat.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
    byProduct: [...byProd.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 50),
    scanned,
    capped,
    totalsExact,
  };
}
