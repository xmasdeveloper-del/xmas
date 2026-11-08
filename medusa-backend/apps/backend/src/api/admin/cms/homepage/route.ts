import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { readHomepage, writeHomepage, sanitize } from "../../../../lib/cms";
import { revalidateStorefront } from "../../../../lib/revalidate";
import { audit } from "../../../../lib/audit";

// GET  /admin/cms/homepage — current editable homepage content.
// POST /admin/cms/homepage — save it. Both guarded by content.write.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ content: await readHomepage(req.scope) });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const content = sanitize((req.body as any)?.content ?? req.body);
  await writeHomepage(req.scope, content);

  // Push the change onto the live homepage. If on-demand revalidation is not
  // configured the save still stands and the page picks it up within the ISR
  // window — we report which happened so the admin can tell the owner when to
  // expect it, instead of claiming it is already live.
  const revalidated = await revalidateStorefront(["/mn", "/en", "/"]);

  const filled = Object.values(content.hero)
    .filter((v: any) => v && typeof v === "object" && ("mn" in v))
    .filter((v: any) => v.mn || v.en).length;

  await audit(req.scope, {
    actor_id: (req as any).auth_context?.actor_id || null,
    action: "cms.save",
    target: "homepage",
    meta: {
      hero_fields: filled,
      hero_images: content.hero.images.filter((i) => i.img).length,
      promo: content.promo.enabled,
      revalidated: revalidated.ok,
    },
  }, Date.now());

  res.json({ content, revalidated });
}
