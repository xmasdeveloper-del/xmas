import {
  num, mnt, ubDayKey, ubDayStart, ubDayEnd, ubRange,
  countsAsRevenue, lineItemRevenue, orderRevenue,
} from "../money";

describe("num — BigNumberValue coercion", () => {
  it("reads every shape Medusa hands back", () => {
    expect(num(1500)).toBe(1500);
    expect(num("1500")).toBe(1500);
    expect(num({ value: "1500" })).toBe(1500);
    expect(num({ numeric: 1500 })).toBe(1500);
  });

  it("never returns NaN", () => {
    for (const bad of [null, undefined, "", "abc", {}, { value: "abc" }, NaN, Infinity, []]) {
      expect(num(bad)).toBe(0);
    }
  });

  it("preserves a genuine zero", () => {
    expect(num(0)).toBe(0);
    expect(num({ value: 0 })).toBe(0);
    expect(num({ numeric: "0" })).toBe(0);
  });

  it("mnt rounds to whole tugrik", () => {
    expect(mnt("1499.6")).toBe(1500);
    expect(mnt({ value: 1499.4 })).toBe(1499);
  });
});

describe("Ulaanbaatar calendar (UTC+8)", () => {
  it("buckets an evening sale into the correct local day", () => {
    // 18:00 in Ulaanbaatar on 2 Jan is 10:00 UTC the same day.
    expect(ubDayKey("2026-01-02T10:00:00.000Z")).toBe("2026-01-02");
    // 23:30 Ulaanbaatar on 2 Jan is 15:30 UTC on 2 Jan — still the 2nd locally.
    expect(ubDayKey("2026-01-02T15:30:00.000Z")).toBe("2026-01-02");
    // 16:00 UTC is already 00:00 on the 3rd in Ulaanbaatar.
    expect(ubDayKey("2026-01-02T16:00:00.000Z")).toBe("2026-01-03");
  });

  it("is the bug the old code had: UTC bucketing moved evening sales a day late", () => {
    const evening = "2026-01-02T15:00:00.000Z"; // 23:00 in Ulaanbaatar, 2 Jan
    expect(new Date(evening).toISOString().slice(0, 10)).toBe("2026-01-02");
    const earlyHours = "2026-01-02T17:00:00.000Z"; // 01:00 in Ulaanbaatar, 3 Jan
    expect(new Date(earlyHours).toISOString().slice(0, 10)).toBe("2026-01-02"); // old: wrong day
    expect(ubDayKey(earlyHours)).toBe("2026-01-03");                            // new: right day
  });

  it("day boundaries are the matching UTC instants", () => {
    expect(ubDayStart("2026-01-02")!.toISOString()).toBe("2026-01-01T16:00:00.000Z");
    expect(ubDayEnd("2026-01-02")!.toISOString()).toBe("2026-01-02T15:59:59.999Z");
  });

  it("a single-day range covers exactly 24 hours", () => {
    const { from, to } = ubRange("2026-01-02", "2026-01-02");
    expect(to!.getTime() - from!.getTime()).toBe(24 * 3600_000 - 1);
  });

  it("passes an explicit timestamp through untouched", () => {
    const { from } = ubRange("2026-01-02T09:15:00.000Z");
    expect(from!.toISOString()).toBe("2026-01-02T09:15:00.000Z");
  });

  it("returns null for a missing or unparseable date", () => {
    const { from, to } = ubRange(undefined, "not-a-date");
    expect(from).toBeNull();
    expect(to).toBeNull();
  });
});

describe("countsAsRevenue", () => {
  it("excludes cancelled, draft and archived orders", () => {
    for (const s of ["canceled", "draft", "archived"]) expect(countsAsRevenue(s)).toBe(false);
  });
  it("keeps real orders", () => {
    for (const s of ["pending", "completed", "requires_action", undefined]) {
      expect(countsAsRevenue(s)).toBe(true);
    }
  });
});

describe("lineItemRevenue — promotions must be subtracted", () => {
  it("uses the computed total when the module provides it", () => {
    expect(lineItemRevenue({ unit_price: 349000, quantity: 1, total: 279200 })).toBe(279200);
  });

  it("subtracts adjustments when totals were not loaded", () => {
    // XMAS20 on a 349,000 pair: catalogue price minus a 69,800 adjustment.
    const item = { unit_price: 349000, quantity: 1, adjustments: [{ amount: 69800 }] };
    expect(lineItemRevenue(item)).toBe(279200);
  });

  it("is the bug being fixed: full price without adjustments", () => {
    const item = { unit_price: 349000, quantity: 1, adjustments: [{ amount: 69800 }] };
    expect(Number(item.unit_price) * Number(item.quantity)).toBe(349000); // old basis
    expect(lineItemRevenue(item)).toBe(279200);                            // new basis
  });

  it("handles quantity > 1 and several adjustments", () => {
    const item = { unit_price: 100000, quantity: 3, adjustments: [{ amount: 30000 }, { amount: 10000 }] };
    expect(lineItemRevenue(item)).toBe(260000);
  });

  it("copes with BigNumber-shaped amounts", () => {
    const item = { unit_price: { value: "349000" }, quantity: 1, adjustments: [{ amount: { value: "69800" } }] };
    expect(lineItemRevenue(item)).toBe(279200);
  });

  it("never goes negative", () => {
    expect(lineItemRevenue({ unit_price: 1000, quantity: 1, adjustments: [{ amount: 5000 }] })).toBe(0);
  });

  it("returns 0 for an empty item rather than NaN", () => {
    expect(lineItemRevenue({})).toBe(0);
    expect(lineItemRevenue(null)).toBe(0);
  });
});

describe("orderRevenue — refunds must come off", () => {
  it("nets a refund out of the order total", () => {
    expect(orderRevenue({ total: 279200, refunded_total: 0 })).toBe(279200);
    expect(orderRevenue({ total: 279200, refunded_total: 279200 })).toBe(0);
    expect(orderRevenue({ total: 279200, refunded_total: 100000 })).toBe(179200);
  });

  it("treats a missing refund field as no refund", () => {
    expect(orderRevenue({ total: 279200 })).toBe(279200);
  });

  it("reads BigNumber shapes", () => {
    expect(orderRevenue({ total: { value: "279200" }, refunded_total: { value: "79200" } })).toBe(200000);
  });

  it("rebuilds from line items when the module did not compute `total`", () => {
    // Without the fallback this order would be reported as worth ₮0.
    const order = {
      shipping_total: 5000,
      items: [
        { unit_price: 349000, quantity: 1, adjustments: [{ amount: 69800 }] },
        { unit_price: 100000, quantity: 2 },
      ],
    };
    expect(orderRevenue(order)).toBe(279200 + 200000 + 5000);
  });

  it("nets refunds off a rebuilt total too", () => {
    const order = { items: [{ unit_price: 100000, quantity: 1 }], refunded_total: 40000 };
    expect(orderRevenue(order)).toBe(60000);
  });

  it("stays at zero for an order with neither total nor items", () => {
    expect(orderRevenue({})).toBe(0);
    expect(orderRevenue({ items: [] })).toBe(0);
  });
});

// The till used to bound "today" with the server's own midnight. Containers run
// UTC, Ulaanbaatar is UTC+8, so the till counted a day that began at 08:00
// local while the sales report counted one that began at midnight — and the
// till's own Z-report disagreed with both. These pin the boundary that every
// one of them now shares.
describe("Ulaanbaatar day boundaries vs the server's UTC day", () => {
  it("opens a day 8 hours before UTC midnight", () => {
    expect(ubDayStart("2026-11-10")!.toISOString()).toBe("2026-11-09T16:00:00.000Z");
    expect(ubDayEnd("2026-11-10")!.toISOString()).toBe("2026-11-10T15:59:59.999Z");
  });

  it("keeps an early-morning sale on the day the shop rang it up", () => {
    // 02:00 in Ulaanbaatar on the 10th is still the 9th in UTC.
    const sale = new Date("2026-11-09T18:00:00.000Z");
    expect(ubDayKey(sale)).toBe("2026-11-10");
    expect(sale >= ubDayStart("2026-11-10")!).toBe(true);
    expect(sale <= ubDayEnd("2026-11-10")!).toBe(true);
    // The old rule would have put it on the 9th and dropped it from "today".
    const serverMidnight = new Date("2026-11-10T00:00:00.000Z");
    expect(sale < serverMidnight).toBe(true);
  });

  it("keeps a late-evening sale off the next day", () => {
    // 23:00 on the 10th in Ulaanbaatar is 15:00 UTC the same date.
    const sale = new Date("2026-11-10T15:00:00.000Z");
    expect(ubDayKey(sale)).toBe("2026-11-10");
    expect(sale <= ubDayEnd("2026-11-10")!).toBe(true);
    expect(sale >= ubDayStart("2026-11-11")!).toBe(false);
  });

  it("covers a whole day with no gap and no overlap", () => {
    const end = ubDayEnd("2026-11-10")!.getTime();
    const nextStart = ubDayStart("2026-11-11")!.getTime();
    expect(nextStart - end).toBe(1);
  });
});
