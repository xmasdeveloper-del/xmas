import { scanOrderPage, ITEM_MONEY_FIELDS } from "../order-scan";

/* ---------------------------------------------------------------------------
 * Paging orders for the reports.
 *
 * The fake below reproduces the behaviour measured on Medusa 2.17: an order's
 * money is computed from each line's `detail` quantity, so asking for `total`
 * WITHOUT `items.detail.quantity` returns every figure as zero — and takes
 * `items.quantity` with it, so the obvious fallback of price × quantity is
 * zero as well. Nothing throws and no row goes missing.
 *
 * That is what emptied this shop's sales report, its analytics, its day-close
 * and its receipts, with nothing in the logs. These tests exist so the field
 * cannot quietly be dropped from the list again.
 * ------------------------------------------------------------------------ */

type Row = Record<string, any>;

function fakeScope(orders: Row[]) {
  return {
    resolve: () => ({
      graph: async ({ fields, filters, pagination }: any) => {
        let rows = orders;
        if (filters?.id) {
          const ids = (Array.isArray(filters.id) ? filters.id : [filters.id]).map(String);
          rows = rows.filter((r) => ids.includes(String(r.id)));
        }
        // Measured: asking for `items.total` alone leaves quantity intact and
        // simply does not populate it. It is the ORDER total that computes.
        const wantsMoney = fields.includes("total");
        const hasDetail = fields.includes("items.detail.quantity");
        const take = pagination?.take ?? rows.length;
        const skip = pagination?.skip ?? 0;
        const page = rows.slice(skip, skip + take).map((o) => {
          const items = (o.items || []).map((i: any) => ({ ...i }));
          if (!wantsMoney) {
            // No money asked for: quantities are intact, line totals are not
            // computed at all.
            return { ...o, total: undefined, items: items.map((i: any) => ({ ...i, total: undefined })) };
          }
          if (!hasDetail) {
            // Money asked for without the quantity it is computed from.
            return { ...o, total: 0, items: items.map((i: any) => ({ ...i, quantity: undefined, total: 0 })) };
          }
          return { ...o, items };
        });
        return { data: page };
      },
    }),
  };
}

const BASE = ["id", "created_at", "status", "items.id", ...ITEM_MONEY_FIELDS];

const sale = {
  id: "o_till",
  created_at: "2026-11-10T12:46:00Z",
  status: "pending",
  total: 998_000,
  items: [{ id: "li_1", quantity: 2, unit_price: 499_000, total: 998_000 }],
};

describe("scanOrderPage", () => {
  it("asks for the quantity the order totals are computed from", async () => {
    // The whole fix in one assertion: without this field every figure below is
    // zero, and nothing anywhere says so.
    const seen: string[][] = [];
    const spy = {
      resolve: () => ({
        graph: async ({ fields }: any) => { seen.push(fields); return { data: [sale] }; },
      }),
    };
    await scanOrderPage(spy, BASE, 50, 0);
    expect(seen.some((f) => f.includes("total") && f.includes("items.detail.quantity"))).toBe(true);
  });

  it("reports the real money for a counter sale", async () => {
    const { rows, totals } = await scanOrderPage(fakeScope([sale]), BASE, 50, 0);
    expect(rows[0].total).toBe(998_000);
    expect(totals).toBe(true);
  });

  it("keeps the basket, with its quantities, on the orders it returns", async () => {
    const { rows } = await scanOrderPage(fakeScope([sale]), BASE, 50, 0);
    expect(rows[0].items).toHaveLength(1);
    expect(rows[0].items[0].quantity).toBe(2);
    expect(rows[0].items[0].unit_price).toBe(499_000);
  });

  it("holds the page from the plain query, so a failed totals lookup loses no orders", async () => {
    let call = 0;
    const halfDead = {
      resolve: () => ({
        graph: async () => {
          call++;
          if (call === 1) return { data: [sale] };
          throw new Error("totals unavailable");
        },
      }),
    };
    const { rows, totals } = await scanOrderPage(halfDead, BASE, 50, 0);
    expect(rows.map((r: any) => r.id)).toEqual(["o_till"]);
    expect(totals).toBe(false);          // the caller rebuilds from the basket
  });

  it("is the bug: an empty page does not claim the totals were unavailable", async () => {
    // The scan runs until a short page, so the last call returns nothing. Read
    // as "not exact", that put a warning on the sales report every single run.
    const { rows, totals } = await scanOrderPage(fakeScope([]), BASE, 50, 0);
    expect(rows).toEqual([]);
    expect(totals).toBe(true);
  });

  it("reports inexact when the caller asked not to load totals", async () => {
    const { rows, totals } = await scanOrderPage(fakeScope([sale]), BASE, 50, 0, false);
    expect(rows).toHaveLength(1);
    expect(totals).toBe(false);
  });

  it("carries line-item promotions through", async () => {
    const discounted = {
      ...sale,
      id: "o_promo",
      items: [{ id: "li_1", quantity: 2, unit_price: 499_000, total: 898_200, adjustments: [{ amount: 99_800 }] }],
    };
    const { rows } = await scanOrderPage(fakeScope([discounted]), BASE, 50, 0);
    expect(rows[0].items[0].adjustments).toEqual([{ amount: 99_800 }]);
  });
});
