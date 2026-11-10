/* ---------------------------------------------------------------------------
 * What the customer is likely to hand over.
 *
 * The till used to offer a fixed row — exact, 20,000, 50,000, 100,000 — which
 * is only useful while the ticket is small. On a 237,500₮ coat every one of
 * those buttons was below the total, so they did nothing but sit there, and
 * the cashier typed the amount by hand on exactly the sales where the arithmetic
 * is hardest.
 *
 * So the suggestions are built from the ticket instead: the exact amount, then
 * the ticket rounded up to the next round number a person actually pays with.
 * Anything that equals the total, or repeats, is dropped.
 * ------------------------------------------------------------------------ */

/** Steps a customer rounds up to, smallest first (₮). */
const STEPS = [1_000, 5_000, 10_000, 50_000, 100_000];

/** At most this many buttons — more is a wall, not a shortcut. */
const MAX = 4;

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

/**
 * Cash amounts to offer for a ticket, starting with the exact total.
 *
 * An empty ticket gets nothing to offer.
 */
export function cashSuggestions(total: number): number[] {
  const t = Math.max(0, Math.round(Number(total) || 0));
  if (t <= 0) return [];
  const out: number[] = [t];
  for (const step of STEPS) {
    if (out.length >= MAX) break;
    const up = roundUp(t, step);
    // Only a round number ABOVE the ticket is a shortcut; the exact amount is
    // already the first button.
    if (up > t && !out.includes(up)) out.push(up);
  }
  return out;
}
