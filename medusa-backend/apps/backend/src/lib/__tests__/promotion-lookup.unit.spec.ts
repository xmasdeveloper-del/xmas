import { promotionsByCode, promotionByCode } from "../promotion-lookup";

/* ---------------------------------------------------------------------------
 * Discount codes.
 *
 * Measured: codes are matched exactly, so "qatest15" finds nothing when the
 * code was created as "QATEST15" — the till told the cashier the code did not
 * exist, in front of the customer.
 *
 * The campaign and the application method are read separately. Every code in
 * this shop was created without a campaign, and the shape of a promotion must
 * never decide whether the till can see it; the fake below drops such rows so
 * that stays true even if the server ever starts behaving that way.
 * ------------------------------------------------------------------------ */

type Row = Record<string, any>;

/** A graph that drops rows missing a requested relation, as the real one does. */
function fakeScope(promotions: Row[]) {
  return {
    resolve: () => ({
      graph: async ({ fields, filters, pagination }: any) => {
        let rows = promotions;
        if (filters?.code) {
          const codes = (Array.isArray(filters.code) ? filters.code : [filters.code]).map(String);
          rows = rows.filter((r) => codes.includes(String(r.code)));
        }
        if (filters?.id) {
          const ids = (Array.isArray(filters.id) ? filters.id : [filters.id]).map(String);
          rows = rows.filter((r) => ids.includes(String(r.id)));
        }
        const heads = [...new Set(fields.filter((f: string) => f.includes(".")).map((f: string) => f.split(".")[0]))];
        rows = rows.filter((r) => heads.every((h) => r[h as string] != null));
        const take = pagination?.take ?? rows.length;
        return { data: rows.slice(0, take) };
      },
    }),
  };
}

const PERCENT_NO_CAMPAIGN = {
  id: "promo_1",
  code: "XMAS10",
  status: "active",
  is_automatic: false,
  application_method: { type: "percentage", value: 10, currency_code: "mnt" },
  // no campaign — this is the shape that used to vanish
};

describe("promotionsByCode", () => {
  it("finds a code that has no campaign", async () => {
    const found = await promotionsByCode(fakeScope([PERCENT_NO_CAMPAIGN]), ["XMAS10"]);
    expect(found.get("XMAS10")?.code).toBe("XMAS10");
    expect(found.get("XMAS10")?.application_method?.type).toBe("percentage");
    expect(found.get("XMAS10")?.campaign).toBeUndefined();
  });

  it("is the bug: finds a code typed in the wrong case", async () => {
    // A cashier types it by hand; the code was created upper-case.
    const found = await promotionsByCode(fakeScope([PERCENT_NO_CAMPAIGN]), ["xmas10"]);
    expect(found.get("XMAS10")?.id).toBe("promo_1");
  });

  it("attaches the campaign when there is one", async () => {
    const withCampaign = {
      ...PERCENT_NO_CAMPAIGN,
      id: "promo_2",
      code: "SALE",
      campaign: { starts_at: "2026-01-01", ends_at: "2026-02-01" },
    };
    const found = await promotionsByCode(fakeScope([withCampaign]), ["SALE"]);
    expect(found.get("SALE")?.campaign?.ends_at).toBe("2026-02-01");
  });

  it("still reports a promotion with no application method, so it can be rejected as misconfigured rather than missing", async () => {
    const broken = { id: "promo_3", code: "HALF", status: "active", is_automatic: false };
    const found = await promotionsByCode(fakeScope([broken]), ["HALF"]);
    expect(found.get("HALF")?.code).toBe("HALF");
    expect(found.get("HALF")?.application_method).toBeUndefined();
  });

  it("asks for several codes in one query", async () => {
    const two = [PERCENT_NO_CAMPAIGN, { ...PERCENT_NO_CAMPAIGN, id: "p2", code: "WINTER" }];
    const found = await promotionsByCode(fakeScope(two), ["XMAS10", "WINTER"]);
    expect([...found.keys()].sort()).toEqual(["WINTER", "XMAS10"]);
  });

  it("answers nothing for a code that really does not exist", async () => {
    const found = await promotionsByCode(fakeScope([PERCENT_NO_CAMPAIGN]), ["NOPE"]);
    expect(found.size).toBe(0);
  });

  it("answers nothing, rather than throwing, when promotions cannot be read", async () => {
    const dead = { resolve: () => ({ graph: async () => { throw new Error("module down"); } }) };
    await expect(promotionsByCode(dead, ["XMAS10"])).resolves.toEqual(new Map());
  });

  it("does not query at all for a blank code", async () => {
    let called = false;
    const spy = { resolve: () => ({ graph: async () => { called = true; return { data: [] }; } }) };
    await promotionsByCode(spy, ["", "  "]);
    expect(called).toBe(false);
  });
});

describe("promotionByCode", () => {
  it("returns the one promotion", async () => {
    await expect(promotionByCode(fakeScope([PERCENT_NO_CAMPAIGN]), " xmas10 "))
      .resolves.toMatchObject({ id: "promo_1" });
  });

  it("returns null for an unknown code", async () => {
    await expect(promotionByCode(fakeScope([]), "XMAS10")).resolves.toBeNull();
  });
});
