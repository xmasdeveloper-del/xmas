import { optionalRows, optionalRowsById, mergeOptional } from "../graph";

/* ---------------------------------------------------------------------------
 * mergeOptional holds a row set from one query and merges a second onto it.
 *
 * Measured on Medusa 2.17: query.graph LEFT-joins, so a second query asking
 * for a relation normally answers for every row it was given. These tests pin
 * the behaviour when it does not — a lookup that fails, is slower to catch up,
 * or simply has nothing for a row: the row must survive with the relation
 * absent, never vanish from the screen that is listing it.
 *
 * The fake below therefore answers only for rows that have what was asked for,
 * which is the worst case rather than the normal one.
 * ------------------------------------------------------------------------ */

type Row = Record<string, any>;

/** A graph that drops any row missing a requested relation, like the real one. */
function fakeScope(tables: Record<string, Row[]>, spy?: { calls: any[] }) {
  return {
    resolve: () => ({
      graph: async ({ entity, fields, filters, pagination }: any) => {
        spy?.calls.push({ entity, fields, filters, pagination });
        let rows = tables[entity] || [];
        const wanted = filters?.id;
        if (wanted) {
          const ids = Array.isArray(wanted) ? wanted.map(String) : [String(wanted)];
          rows = rows.filter((r) => ids.includes(String(r.id)));
        }
        // The drop: a row lacking the head of any requested relation is gone.
        const heads = [...new Set(fields.filter((f: string) => f.includes(".")).map((f: string) => f.split(".")[0]))];
        rows = rows.filter((r) => heads.every((h) => {
          const v = (r as any)[h as string];
          return Array.isArray(v) ? v.length > 0 : v != null;
        }));
        const take = pagination?.take ?? rows.length;
        const skip = pagination?.skip ?? 0;
        return { data: rows.slice(skip, skip + take) };
      },
    }),
  };
}

describe("optionalRows", () => {
  it("keys what it finds by id", async () => {
    const scope = fakeScope({ order: [{ id: "o1", address: { city: "UB" } }] });
    const found = await optionalRows(scope, "order", ["id", "address.city"], { pagination: { take: 10 } });
    expect(found.get("o1").address.city).toBe("UB");
  });

  it("answers empty rather than throwing when the relation cannot be read", async () => {
    const scope = { resolve: () => ({ graph: async () => { throw new Error("no such module"); } }) };
    await expect(optionalRows(scope, "order", ["id", "nope.x"], {})).resolves.toEqual(new Map());
  });

  it("simply omits a row it has nothing for, which is why it may not decide the set", async () => {
    const scope = fakeScope({
      order: [{ id: "o1", address: { city: "UB" } }, { id: "o2" }],   // o2: a till sale, no address
    });
    const found = await optionalRows(scope, "order", ["id", "address.city"], { pagination: { take: 10 } });
    expect([...found.keys()]).toEqual(["o1"]);
  });
});

describe("mergeOptional — the row set survives a lookup that answers for fewer", () => {
  const tables = {
    order: [
      { id: "o1", address: { city: "UB" }, fulfillments: [{ id: "f1" }] },
      { id: "o2" },                                        // counter sale, nobody packed it
      { id: "o3", address: { city: "Darkhan" } },           // delivered to, not yet packed
    ],
  };

  it("keeps every row and attaches what each one has", async () => {
    const rows: Row[] = [{ id: "o1" }, { id: "o2" }, { id: "o3" }];
    const out: any[] = await mergeOptional(fakeScope(tables), "order", rows as any, [
      { fields: ["address.city"], keys: ["address"] },
      { fields: ["fulfillments.id"], keys: ["fulfillments"] },
    ]);
    expect(out.map((r: any) => r.id)).toEqual(["o1", "o2", "o3"]);
    expect(out[0].address.city).toBe("UB");
    expect(out[0].fulfillments).toHaveLength(1);
    // Still listed, holding only what each one actually has:
    expect(out[1].address).toBeUndefined();
    expect(out[1].fulfillments).toBeUndefined();
    expect(out[2].address.city).toBe("Darkhan");
    expect(out[2].fulfillments).toBeUndefined();
  });

  it("keeps each lookup independent, so one empty answer costs only itself", async () => {
    const together = await optionalRows(fakeScope(tables), "order",
      ["id", "address.city", "fulfillments.id"], { pagination: { take: 10 } });
    expect([...together.keys()]).toEqual(["o1"]);
  });

  it("does not mutate the rows it was given", async () => {
    const rows = [{ id: "o1" }];
    await mergeOptional(fakeScope(tables), "order", rows, [{ fields: ["address.city"], keys: ["address"] }]);
    expect(rows[0]).toEqual({ id: "o1" });
  });

  it("asks by id, not by re-running a page window", async () => {
    // Two windows can disagree about which rows they cover; ids cannot.
    const spy = { calls: [] as any[] };
    await mergeOptional(fakeScope(tables, spy), "order", [{ id: "o3" }], [
      { fields: ["address.city"], keys: ["address"] },
    ]);
    expect(spy.calls[0].filters).toEqual({ id: ["o3"] });
  });

  it("returns the rows untouched when there is nothing optional to fetch", async () => {
    const rows = [{ id: "o1" }];
    await expect(mergeOptional(fakeScope(tables), "order", rows, [])).resolves.toBe(rows);
  });

  it("looks up more ids than one query holds, in chunks", async () => {
    const many = Array.from({ length: 450 }, (_, i) => ({ id: `o${i}`, address: { city: "UB" } }));
    const spy = { calls: [] as any[] };
    const out = await mergeOptional(fakeScope({ order: many }, spy), "order",
      many.map((m) => ({ id: m.id })), [{ fields: ["address.city"], keys: ["address"] }]);
    expect(out).toHaveLength(450);
    expect(out.every((r: any) => r.address.city === "UB")).toBe(true);
    expect(spy.calls).toHaveLength(3);          // 200 + 200 + 50
  });
});

describe("optionalRowsById", () => {
  it("answers nothing for an empty id list without querying", async () => {
    const spy = { calls: [] as any[] };
    await expect(optionalRowsById(fakeScope({}, spy), "order", ["id", "a.b"], [])).resolves.toEqual(new Map());
    expect(spy.calls).toHaveLength(0);
  });
});
