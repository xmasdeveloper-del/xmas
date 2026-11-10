import { stockLevels } from "../catalog";

/* ---------------------------------------------------------------------------
 * Reading stock.
 *
 * One answer for four screens that must agree: the low-stock list, the bulk
 * stock upload, the till's stock figures, and the decrement a sale makes.
 *
 * Two things it has to get right, both found in this catalogue:
 *   - most variants have no inventory record at all, and that is different
 *     from having none in stock — the caller needs to know which, so it can
 *     create a record rather than write to one that is not there;
 *   - `available_quantity` is derived, and asking the module for it on its own
 *     answered zero while the shelf held four pairs. Stocked and reserved are
 *     columns; available is their difference.
 * ------------------------------------------------------------------------ */

type Row = Record<string, any>;

function fakeContainer(variants: Row[]) {
  return {
    resolve: () => ({
      graph: async ({ fields, filters, pagination }: any) => {
        let rows = variants;
        if (filters?.id) {
          const ids = (Array.isArray(filters.id) ? filters.id : [filters.id]).map(String);
          rows = rows.filter((r) => ids.includes(String(r.id)));
        }
        // The drop: every requested relation must be present and non-empty, at
        // every level of the path.
        const paths = fields.filter((f: string) => f.includes("."));
        rows = rows.filter((r) => paths.every((path: string) => {
          let level: any[] = [r];
          for (const part of path.split(".").slice(0, -1)) {
            level = level.flatMap((n) => {
              const v = n?.[part];
              return v == null ? [] : Array.isArray(v) ? v : [v];
            });
            if (!level.length) return false;
          }
          return true;
        }));
        const take = pagination?.take ?? rows.length;
        return { data: rows.slice(0, take) };
      },
    }),
  };
}

const LOC = "sloc_1";

/** Stocked and counted at the shop. */
const stocked = {
  id: "var_stocked",
  manage_inventory: true,
  inventory_items: [{
    inventory_item_id: "iitem_1",
    inventory: { location_levels: [{ location_id: LOC, stocked_quantity: 7, reserved_quantity: 2 }] },
  }],
};

/** Has an inventory item but has never been stocked anywhere. */
const neverStocked = {
  id: "var_never",
  manage_inventory: true,
  inventory_items: [{ inventory_item_id: "iitem_2" }],
};

/** No inventory item at all. */
const noItem = { id: "var_bare", manage_inventory: true };

/** Not inventory-managed — treated as unlimited elsewhere. */
const unmanaged = { id: "var_free", manage_inventory: false };

describe("stockLevels", () => {
  it("reads the quantity at the given location", async () => {
    const s = await stockLevels(fakeContainer([stocked]), ["var_stocked"], LOC);
    expect(s.get("var_stocked")).toEqual({ manage: true, itemId: "iitem_1", stocked: 7, available: 5 });
  });

  it("is the bug: available is worked out from the columns, not asked for", async () => {
    // Asked for directly, `available_quantity` came back zero while the shelf
    // held four pairs, so every tracked line read as sold out.
    const noComputed = {
      id: "var_plain",
      manage_inventory: true,
      inventory_items: [{
        inventory_item_id: "iitem_p",
        inventory: { location_levels: [{ location_id: LOC, stocked_quantity: 4 }] },
      }],
    };
    const s = await stockLevels(fakeContainer([noComputed]), ["var_plain"], LOC);
    expect(s.get("var_plain")).toMatchObject({ stocked: 4, available: 4 });
  });

  it("never reports negative availability", async () => {
    const oversold = {
      id: "var_over",
      manage_inventory: true,
      inventory_items: [{
        inventory_item_id: "iitem_o",
        inventory: { location_levels: [{ location_id: LOC, stocked_quantity: 1, reserved_quantity: 3 }] },
      }],
    };
    const s = await stockLevels(fakeContainer([oversold]), ["var_over"], LOC);
    expect(s.get("var_over")?.available).toBe(0);
  });

  it("answers for a variant that has never been stocked, at zero", async () => {
    const s = await stockLevels(fakeContainer([neverStocked]), ["var_never"], LOC);
    // Reported, and with the inventory item the stock upload needs to write to.
    expect(s.get("var_never")).toEqual({ manage: true, itemId: "iitem_2", stocked: 0, available: 0 });
  });

  it("says when a variant has no inventory record at all", async () => {
    const s = await stockLevels(fakeContainer([noItem]), ["var_bare"], LOC);
    expect(s.get("var_bare")).toEqual({ manage: true, itemId: null, stocked: 0, available: 0 });
  });

  it("reports an unmanaged variant rather than dropping it", async () => {
    const s = await stockLevels(fakeContainer([unmanaged]), ["var_free"], LOC);
    expect(s.get("var_free")?.manage).toBe(false);
  });

  it("answers for every variant asked about, whatever state each is in", async () => {
    const s = await stockLevels(
      fakeContainer([stocked, neverStocked, noItem, unmanaged]),
      ["var_stocked", "var_never", "var_bare", "var_free"],
      LOC,
    );
    expect([...s.keys()].sort()).toEqual(["var_bare", "var_free", "var_never", "var_stocked"]);
  });

  it("ignores levels at another location", async () => {
    const elsewhere = {
      ...stocked,
      id: "var_other",
      inventory_items: [{
        inventory_item_id: "iitem_9",
        inventory: { location_levels: [{ location_id: "sloc_warehouse", stocked_quantity: 99, reserved_quantity: 0 }] },
      }],
    };
    const s = await stockLevels(fakeContainer([elsewhere]), ["var_other"], LOC);
    expect(s.get("var_other")).toMatchObject({ itemId: "iitem_9", stocked: 0 });
  });

  it("sums every location when no location is named", async () => {
    const twoPlaces = {
      id: "var_two",
      manage_inventory: true,
      inventory_items: [{
        inventory_item_id: "iitem_3",
        inventory: {
          location_levels: [
            { location_id: LOC, stocked_quantity: 2, reserved_quantity: 0 },
            { location_id: "sloc_warehouse", stocked_quantity: 3, reserved_quantity: 2 },
          ],
        },
      }],
    };
    const s = await stockLevels(fakeContainer([twoPlaces]), ["var_two"]);
    expect(s.get("var_two")).toMatchObject({ stocked: 5, available: 3 });
  });

  it("says nothing about a variant id that does not exist", async () => {
    const s = await stockLevels(fakeContainer([stocked]), ["var_gone"], LOC);
    expect(s.has("var_gone")).toBe(false);
  });

  it("does not query for an empty list", async () => {
    let called = false;
    const spy = { resolve: () => ({ graph: async () => { called = true; return { data: [] }; } }) };
    await expect(stockLevels(spy, [])).resolves.toEqual(new Map());
    expect(called).toBe(false);
  });

  it("asks about more variants than one query holds", async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ ...noItem, id: `v${i}` }));
    const s = await stockLevels(fakeContainer(many), many.map((m) => m.id), LOC);
    expect(s.size).toBe(250);
  });
});
