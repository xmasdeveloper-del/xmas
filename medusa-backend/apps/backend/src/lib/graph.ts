import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/* ---------------------------------------------------------------------------
 * Reading a relation that only some rows have.
 *
 * Measured on Medusa 2.17 (local, this catalogue): query.graph LEFT-joins.
 * Asking for a relation a row lacks does NOT drop the row — 1,170 variants
 * come back whether or not the inventory chain is requested, and 166 products
 * come back with or without their categories. An earlier reading of this code
 * assumed otherwise; it is not what the server does.
 *
 * What DOES go wrong is quieter: a computed field asked for without the inputs
 * its computation needs comes back as zero, not as an error (see ./order-scan
 * for the one that cost this shop its reports). So the shape here is still
 * worth keeping — the row set is decided by plain columns, and anything
 * computed or joined is fetched and merged on knowingly, where the field list
 * can say what it needs — but it guards against a wrong number, not a missing
 * row.
 *
 * Each relation is fetched on its own so one slow or failing lookup cannot
 * cost the others, and each asks for exactly the ids already held rather than
 * re-running the caller's window.
 * ------------------------------------------------------------------------ */

export type GraphArgs = { pagination?: Record<string, unknown>; filters?: Record<string, unknown> };

/** One independent lookup: what to ask for, and what to copy back. */
export type OptionalGroup = {
  /** Fields to request, e.g. ["categories.id", "categories.name"]. */
  fields: string[];
  /** Top-level keys to copy onto the row, e.g. ["categories"]. */
  keys: string[];
};

/** How many ids to look up in one query. Pages are smaller than this already. */
const CHUNK = 200;

/**
 * Rows for a secondary lookup, keyed by id.
 *
 * Answers an empty map rather than throwing: a lookup for extra detail is not
 * a reason to fail the screen that asked for it.
 */
export async function optionalRows(
  scope: { resolve: (k: any) => any },
  entity: string,
  fields: string[],
  args: GraphArgs = {},
): Promise<Map<string, any>> {
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({ entity, fields, ...args });
    return new Map(((data || []) as any[]).map((r) => [r.id, r]));
  } catch {
    return new Map();
  }
}

/** The same, looked up by a known set of ids, chunked. */
export async function optionalRowsById(
  scope: { resolve: (k: any) => any },
  entity: string,
  fields: string[],
  ids: string[],
): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const found = await optionalRows(scope, entity, fields, {
      filters: { id: slice } as any,
      pagination: { take: slice.length, skip: 0 },
    });
    for (const [id, row] of found) out.set(id, row);
  }
  return out;
}

/**
 * Copy extra relations onto rows that are already authoritative.
 *
 * Returns new rows in the order given. A row the lookup did not answer for is
 * returned untouched. Groups are fetched in parallel.
 */
export async function mergeOptional<T extends { id: string }>(
  scope: { resolve: (k: any) => any },
  entity: string,
  rows: T[],
  groups: OptionalGroup[],
): Promise<T[]> {
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (!ids.length || !groups.length) return rows;

  const found = await Promise.all(
    groups.map((g) => optionalRowsById(scope, entity, ["id", ...g.fields], ids)),
  );

  return rows.map((row) => {
    const out: any = { ...row };
    groups.forEach((g, i) => {
      const extra = found[i].get(row.id);
      if (!extra) return;
      for (const key of g.keys) if (key in extra) out[key] = extra[key];
    });
    return out as T;
  });
}
