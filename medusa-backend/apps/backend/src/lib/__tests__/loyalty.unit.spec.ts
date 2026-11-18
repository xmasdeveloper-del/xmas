import { pointsForTotal, LOYALTY_DEFAULTS, type LoyaltySettings } from "../loyalty";

/**
 * The earning rule is money, so it is pinned here rather than only checked by
 * ringing up a sale. Everything else in lib/loyalty.ts talks to the database;
 * this is the part that must never quietly change.
 */
const S = (patch: Partial<LoyaltySettings> = {}): LoyaltySettings => ({ ...LOYALTY_DEFAULTS, ...patch });

describe("pointsForTotal", () => {
  it("gives back the configured percentage", () => {
    expect(pointsForTotal(100_000, S({ earnPercent: 3, pointValue: 1 }))).toBe(3_000);
    expect(pointsForTotal(250_000, S({ earnPercent: 3, pointValue: 1 }))).toBe(7_500);
    expect(pointsForTotal(100_000, S({ earnPercent: 10, pointValue: 1 }))).toBe(10_000);
  });

  it("divides by what a point is worth", () => {
    // 3% of 100,000₮ is 3,000₮; at 100₮ a point that is 30 points.
    expect(pointsForTotal(100_000, S({ earnPercent: 3, pointValue: 100 }))).toBe(30);
    expect(pointsForTotal(100_000, S({ earnPercent: 3, pointValue: 1_000 }))).toBe(3);
  });

  it("rounds down, so the shop never owes more than it meant to", () => {
    expect(pointsForTotal(99_999, S({ earnPercent: 3, pointValue: 100 }))).toBe(29);
    expect(pointsForTotal(1_000, S({ earnPercent: 3, pointValue: 100 }))).toBe(0);
  });

  it("earns nothing when the scheme is off or set to zero", () => {
    expect(pointsForTotal(500_000, S({ enabled: false }))).toBe(0);
    expect(pointsForTotal(500_000, S({ earnPercent: 0 }))).toBe(0);
  });

  it("never returns a negative or a NaN, whatever the total is", () => {
    for (const bad of [0, -1, -999_999, NaN, Infinity, null as any, undefined as any, "abc" as any]) {
      const n = pointsForTotal(bad, S());
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it("treats a string total the way Medusa hands it over", () => {
    expect(pointsForTotal("100000" as any, S({ earnPercent: 3, pointValue: 1 }))).toBe(3_000);
  });

  it("is proportional — twice the basket, twice the points", () => {
    const s = S({ earnPercent: 5, pointValue: 10 });
    expect(pointsForTotal(400_000, s)).toBe(2 * pointsForTotal(200_000, s));
  });

  it("ships with the rule the shop was set up with", () => {
    expect(LOYALTY_DEFAULTS).toEqual({ enabled: true, earnPercent: 3, pointValue: 1, minRedeem: 5_000 });
  });
});
