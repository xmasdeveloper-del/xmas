import { cashSuggestions } from "../cash";

describe("cashSuggestions — what to offer the cashier", () => {
  it("is the bug: a large ticket used to be offered only amounts below it", () => {
    // The old row was a fixed [exact, 20k, 50k, 100k]; on this ticket three of
    // the four buttons were less than the total and did nothing useful.
    const s = cashSuggestions(237_500);
    expect(s[0]).toBe(237_500);
    expect(s.every((v) => v >= 237_500)).toBe(true);
  });

  it("offers the exact amount first", () => {
    expect(cashSuggestions(45_000)[0]).toBe(45_000);
  });

  it("rounds a messy ticket up the way a customer pays", () => {
    expect(cashSuggestions(237_500)).toEqual([237_500, 238_000, 240_000, 250_000]);
  });

  it("skips round-ups that equal the ticket", () => {
    // 45,000 is already a multiple of 1,000 and of 5,000.
    expect(cashSuggestions(45_000)).toEqual([45_000, 50_000, 100_000]);
  });

  it("never repeats an amount", () => {
    const s = cashSuggestions(99_999);
    expect(new Set(s).size).toBe(s.length);
  });

  it("stays within four buttons", () => {
    for (const t of [1, 999, 1_234, 56_789, 450_001, 2_345_678]) {
      expect(cashSuggestions(t).length).toBeLessThanOrEqual(4);
    }
  });

  it("is ascending, so the buttons read left to right", () => {
    const s = cashSuggestions(123_456);
    expect([...s].sort((a, b) => a - b)).toEqual(s);
  });

  it("offers nothing for an empty ticket", () => {
    expect(cashSuggestions(0)).toEqual([]);
    expect(cashSuggestions(-5)).toEqual([]);
    expect(cashSuggestions(NaN)).toEqual([]);
  });

  it("handles a tiny ticket", () => {
    expect(cashSuggestions(500)).toEqual([500, 1_000, 5_000, 10_000]);
  });
});
