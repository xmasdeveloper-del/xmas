import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { mergeOptional } from "./graph";

/* ---------------------------------------------------------------------------
 * Reading a discount code.
 *
 * Codes are matched exactly, and every code in this shop is upper-case. A
 * cashier typing "xmas10" into the till was told the code did not exist, and
 * the only way to find that out was to try it in front of a customer. The
 * lookup asks for the case variants and keys the answer by one of them.
 *
 * The campaign and the application method are fetched separately. A code
 * created on its own has no campaign — which is all of them here — and keeping
 * the code set to plain columns means the shape of a promotion can never
 * decide whether the till can see it.
 * ------------------------------------------------------------------------ */

export type PromotionRow = {
  id: string;
  code: string;
  status?: string;
  is_automatic?: boolean;
  application_method?: {
    type?: string;
    value?: number | string;
    currency_code?: string;
    target_type?: string;
  } | null;
  campaign?: { starts_at?: string | null; ends_at?: string | null } | null;
};

/** Plain columns — these decide which codes exist. */
const BASE = ["id", "code", "status", "is_automatic"];

/** Fetched separately and merged on; either may legitimately be absent. */
const EXTRAS = [
  {
    fields: [
      "application_method.type",
      "application_method.value",
      "application_method.currency_code",
      "application_method.target_type",
    ],
    keys: ["application_method"],
  },
  { fields: ["campaign.starts_at", "campaign.ends_at"], keys: ["campaign"] },
];

/**
 * Promotions for the given codes, upper-cased keys, with the campaign and
 * application method attached where they exist.
 *
 * Answers an empty map if the promotion module is unavailable rather than
 * throwing — a till that cannot reach promotions should refuse the discount,
 * not refuse the sale.
 */
export async function promotionsByCode(
  scope: { resolve: (k: any) => any },
  codes: string[],
): Promise<Map<string, PromotionRow>> {
  const out = new Map<string, PromotionRow>();
  const asked = codes.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (!asked.length) return out;
  // Measured: filtering for "qatest15" returns nothing when the code was
  // created as "QATEST15". Ask for the case variants and key the answer by one.
  const wanted = [...new Set(asked.flatMap((c) => [c, c.toUpperCase(), c.toLowerCase()]))];

  let rows: PromotionRow[] = [];
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: "promotion",
      fields: BASE,
      filters: { code: wanted } as any,
      pagination: { take: wanted.length, skip: 0 },
    });
    rows = (data || []) as PromotionRow[];
  } catch {
    return out;
  }
  if (!rows.length) return out;

  const full = await mergeOptional(scope, "promotion", rows as any, EXTRAS);
  for (const p of full as PromotionRow[]) out.set(String(p.code).toUpperCase(), p);
  return out;
}

/** One code. Null when there is no such promotion. */
export async function promotionByCode(
  scope: { resolve: (k: any) => any },
  code: string,
): Promise<PromotionRow | null> {
  const m = await promotionsByCode(scope, [code]);
  return m.get(String(code ?? "").trim().toUpperCase()) || null;
}
