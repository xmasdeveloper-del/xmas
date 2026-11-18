import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { setStockFromRows, stockLevels } from "../../../../lib/catalog";

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

/**
 * POST /admin/catalog/stock — set one variant's stock by hand.
 *
 * The CSV upload is for a hundred rows at once; this is for the one pair that
 * just came back, typed straight into the list. It goes through exactly the
 * same path as the upload (`setStockFromRows`), so the validation, the
 * switching-on of inventory tracking and the stock location are identical and
 * cannot drift apart from the bulk route.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sku = String((req.body as any)?.sku ?? "").trim();
  const raw = String((req.body as any)?.stock ?? "").trim();

  if (!sku) {
    res.status(400).json({ message: "Энэ хувилбарт SKU алга — нөөцийг CSV-ээр оруулна уу." });
    return;
  }
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n) || n < 0) {
    res.status(400).json({ message: "Нөөц нь 0 буюу түүнээс дээш тоо байх ёстой." });
    return;
  }

  try {
    const result = await setStockFromRows(req.scope, [{ sku, stock: String(Math.round(n)) }]);
    if (result.updated === 0 && result.enabled === 0) {
      res.status(404).json({ message: `"${sku}" SKU-тай хувилбар олдсонгүй.` });
      return;
    }
    res.json({ sku, stock: Math.round(n), enabled: result.enabled > 0 });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Хадгалж чадсангүй" });
  }
}
