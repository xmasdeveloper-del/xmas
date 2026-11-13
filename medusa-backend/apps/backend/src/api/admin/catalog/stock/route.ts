import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { stockLevels } from "../../../../lib/catalog";

/**
 * GET /admin/catalog/stock?q=&limit=&offset=
 *
 * Stock by variant, **with the product's photo**. Medusa's own Бараа материал
 * page lists "L / Black · SHIRT-L-BLACK · 1000000" and nothing else: the
 * variant's title, which on a shoe is a size, and a SKU. Nobody recognises
 * stock that way. This is the same list with the picture attached, and the
 * product name spelled out, so a row can be identified at a glance.
 */
const PAGE = 500;

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const q = String((req.query as any)?.q ?? "").trim().toLowerCase();
  const limit = Math.min(Number((req.query as any)?.limit) || 50, 200);
  const offset = Math.max(Number((req.query as any)?.offset) || 0, 0);

  // Every variant with its product; filtering is done here rather than in the
  // query so one search box can match a product name, a variant and a SKU.
  const all: any[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "variant",
      fields: ["id", "sku", "title", "manage_inventory", "product.title", "product.thumbnail", "product.handle"],
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    });
    const page = (data || []) as any[];
    all.push(...page);
    if (page.length < PAGE) break;
  }

  const matches = q
    ? all.filter(v =>
        `${v.product?.title ?? ""} ${v.title ?? ""} ${v.sku ?? ""}`.toLowerCase().includes(q))
    : all;

  const slice = matches.slice(offset, offset + limit);
  const levels = await stockLevels(req.scope, slice.filter(v => v.manage_inventory).map(v => v.id));

  res.json({
    count: matches.length,
    limit,
    offset,
    variants: slice.map(v => ({
      id: v.id,
      sku: v.sku || "",
      variant: v.title || "",
      product: v.product?.title || "",
      handle: v.product?.handle || "",
      thumbnail: v.product?.thumbnail || "",
      // null, not 0: a variant that does not count its stock has no number,
      // and showing it a zero would read as "sold out".
      stock: v.manage_inventory ? (levels.get(v.id)?.available ?? 0) : null,
    })),
  });
}
