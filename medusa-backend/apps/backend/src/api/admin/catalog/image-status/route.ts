import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { HIDDEN_NO_IMAGE } from "../../../../lib/image-visibility";

/* ---------------------------------------------------------------------------
 * GET /admin/catalog/image-status
 *
 * Every product, with its handle and whether it already has a picture.
 *
 * The "Зураг оруулах" page used to read /admin/catalog/hidden-no-image, which
 * only lists products parked for having no picture. It matched dropped files
 * against those handles alone, so once every product had an image the page
 * knew no handles at all and every file dropped on it came back "no such
 * product" — and a picture could never be replaced, only ever added to
 * something that had none.
 *
 * Both are answered from here: the page highlights what is missing a picture
 * and still recognises a file named after anything in the catalogue.
 *
 * Guarded by catalog.read (see middlewares).
 * ------------------------------------------------------------------------ */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "subtitle", "status", "thumbnail", "metadata"],
    pagination: { take: 5000, skip: 0, order: { title: "ASC" } },
  });

  const items = (data || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    brand: p.metadata?.brand || p.subtitle || "",
    thumbnail: p.thumbnail || "",
    // Parked by lib/image-visibility for having no picture — shoppers cannot
    // see it until one is attached, which is the list the page leads with.
    missing: !p.thumbnail || p.metadata?.hidden_reason === HIDDEN_NO_IMAGE,
  }));

  res.json({
    count: items.length,
    missing: items.filter((i) => i.missing).length,
    items,
  });
}
