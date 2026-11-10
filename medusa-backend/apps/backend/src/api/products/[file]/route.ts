import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/* ---------------------------------------------------------------------------
 * GET /products/:file — hand an admin page the photo the storefront is holding.
 *
 * Product photos are stored on the product as a site-relative path,
 * "/products/<handle>.webp", and the files themselves live in the storefront's
 * public folder. On the shop that path resolves to the shop. In the admin it
 * resolves against the ADMIN's own origin — api.xmas.mn/products/… — which
 * this server has never served, so every thumbnail in the admin and every
 * photo on the till came back 404 and rendered as an empty tile.
 *
 * Rewriting the stored paths to absolute URLs would have been the other way,
 * but the storefront passes them to next/image, which only accepts a remote
 * host it has been configured for — so a change made for the admin would have
 * broken the shop.
 *
 * Redirecting instead means every admin page keeps using the path it already
 * has: the POS, the fulfilment queue, bulk edit, the image tools and the
 * product widgets were all reading `thumbnail` straight into an <img>.
 *
 * Only a plain image filename is redirected, so this cannot be pointed at
 * anything else, and only ever at the configured storefront.
 * ------------------------------------------------------------------------ */

const STOREFRONT = (process.env.STOREFRONT_URL || "").replace(/\/$/, "");
const IMAGE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|avif|png|jpe?g|svg)$/;

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const file = String((req.params as any)?.file || "");

  // No storefront configured, or something that is not a photo filename —
  // answer as if the file simply is not here rather than forwarding it on.
  if (!STOREFRONT || !IMAGE.test(file)) {
    res.status(404).json({ message: "Not found" });
    return;
  }

  // Found-elsewhere rather than moved-permanently: the shop's public folder is
  // where these live today, and a browser should not cache that decision past
  // a change of storefront host.
  res.redirect(302, `${STOREFRONT}/products/${file}`);
}
