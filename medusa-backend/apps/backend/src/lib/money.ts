// Money and calendar helpers shared by every reporting path (sales report,
// analytics overview, CRM lifetime value).
//
// Two things used to go wrong everywhere and are fixed here once:
//
//   1. Amounts. Medusa v2 returns money as `BigNumberValue`, which at runtime is
//      a number, a numeric string, or an object carrying the value — depending on
//      how the row was loaded. `Number(x)` on the object form yields NaN, which
//      then silently poisoned a total. `num()` accepts all three shapes and
//      returns 0 for anything it cannot read, so a total is never NaN.
//
//   2. Days. The store trades in Ulaanbaatar (UTC+8, no DST) but the container
//      runs on UTC, so `toISOString().slice(0,10)` bucketed an 18:00 Ulaanbaatar
//      sale — peak hour for this shop — into the following day, and a report for
//      "today" started at 08:00 local. Every boundary below is an Ulaanbaatar
//      one expressed as the correct UTC instant.

/** Ulaanbaatar is UTC+8 all year — Mongolia abolished DST in 2017. */
export const UB_OFFSET_MINUTES = 8 * 60;
const UB_OFFSET_MS = UB_OFFSET_MINUTES * 60_000;

/**
 * Coerce a Medusa `BigNumberValue` (number | numeric string | { value } |
 * { numeric }) to a plain number. Returns 0 for null/undefined/unparseable,
 * so arithmetic never produces NaN.
 */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // BigNumber instances expose `numeric`; serialized ones carry `value`.
    for (const key of ["numeric", "value"]) {
      if (key in o) {
        const n = num(o[key]);
        if (n !== 0) return n;
        // Distinguish a real 0 from an unreadable shape.
        if (o[key] === 0 || o[key] === "0") return 0;
      }
    }
  }
  return 0;
}

/** Round to whole MNT — the currency has no subunit in practice. */
export const mnt = (v: unknown): number => Math.round(num(v));

/**
 * The Ulaanbaatar calendar day (YYYY-MM-DD) a UTC instant falls on.
 * 2026-01-01T18:00Z is 2026-01-02 02:00 in Ulaanbaatar → "2026-01-02".
 */
export function ubDayKey(d: Date | string | number): string {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** First UTC instant of an Ulaanbaatar day. "2026-01-02" → 2026-01-01T16:00Z. */
export function ubDayStart(ymd: string): Date | null {
  const t = Date.parse(`${ymd}T00:00:00.000+08:00`);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Last UTC instant of an Ulaanbaatar day. "2026-01-02" → 2026-01-02T15:59:59.999Z. */
export function ubDayEnd(ymd: string): Date | null {
  const t = Date.parse(`${ymd}T23:59:59.999+08:00`);
  return Number.isFinite(t) ? new Date(t) : null;
}

/**
 * Turn an inclusive `YYYY-MM-DD` range from the admin's date pickers into the
 * UTC instants that bound those Ulaanbaatar days. A bare ISO timestamp is
 * honoured as-is so callers can still pass an exact instant.
 */
export function ubRange(fromISO?: string, toISO?: string): { from: Date | null; to: Date | null } {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const parse = (s: string | undefined, edge: "start" | "end"): Date | null => {
    if (!s) return null;
    if (dateOnly.test(s)) return edge === "start" ? ubDayStart(s) : ubDayEnd(s);
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t) : null;
  };
  return { from: parse(fromISO, "start"), to: parse(toISO, "end") };
}

/**
 * Order statuses that must never count as revenue. Cancelled orders are not
 * soft-deleted, and drafts/archives are not money the shop took.
 */
export const NON_REVENUE_STATUSES = ["canceled", "draft", "archived"] as const;

export function countsAsRevenue(status: unknown): boolean {
  return !NON_REVENUE_STATUSES.includes(String(status ?? "") as any);
}

/**
 * What a line item actually earned, after any promotion.
 *
 * `unit_price × quantity` is the catalogue price: a promotion lives in
 * `adjustments`, so with XMAS20 live every discounted order was being reported
 * at full price. Prefer the module's computed `total`; fall back to subtracting
 * the adjustments ourselves when totals were not loaded.
 */
export function lineItemRevenue(item: any): number {
  const gross = num(item?.unit_price) * num(item?.quantity);
  const adjustments = Array.isArray(item?.adjustments)
    ? item.adjustments.reduce((sum: number, a: any) => sum + num(a?.amount), 0)
    : 0;
  const computed = item?.total;
  // Only trust `total` when the module actually populated it.
  if (computed !== null && computed !== undefined) {
    const t = num(computed);
    if (t > 0 || gross === 0) return Math.round(t);
  }
  return Math.round(Math.max(0, gross - adjustments));
}

/**
 * What the shop kept for an order: what was charged, less anything refunded.
 * `order.total` already nets off promotions and includes shipping, so it is the
 * figure that matches the order page, the bank, and the VAT return.
 */
export function orderRevenue(order: any): number {
  const refunded = Math.round(num(order?.refunded_total));
  const total = Math.round(num(order?.total));
  if (total > 0) return total - refunded;

  // `total` is a computed field. If the module did not populate it we must not
  // report the order as worth nothing — rebuild it from the line items (already
  // net of promotions) plus shipping, so a loading quirk can never silently
  // zero out a day's revenue.
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return total - refunded;
  const rebuilt = items.reduce((sum, it) => sum + lineItemRevenue(it), 0)
    + Math.round(num(order?.shipping_total));
  return Math.max(0, rebuilt - refunded);
}
