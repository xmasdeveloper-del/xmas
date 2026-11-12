import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { NEWSLETTER_MODULE } from "../../../modules/newsletter";

const MAX = 160;
// Deliberately loose: the point is to reject obvious nonsense, not to argue
// with a legitimate address. Delivery is the real test of an address.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * POST /store/newsletter — "tell me when new stock lands".
 *
 * The answer is the same whether the address is new or already on the list:
 * telling a stranger which addresses are subscribed is a leak, and from the
 * visitor's side both cases mean the same thing.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const email = clean((req.body as any)?.email, MAX).toLowerCase();
  const lang = clean((req.body as any)?.lang, 8) || null;
  const source = clean((req.body as any)?.source, 40) || "storefront";

  if (!email || !LOOKS_LIKE_EMAIL.test(email)) {
    res.status(400).json({ message: "Имэйл хаяг буруу байна" });
    return;
  }

  const service: any = req.scope.resolve(NEWSLETTER_MODULE);
  const [existing] = await service.listNewsletterSubscribers({ email }, { take: 1 });

  if (existing) {
    // Someone who had unsubscribed and is asking again is subscribing again.
    if (existing.status !== "subscribed") {
      await service.updateNewsletterSubscribers({ id: existing.id, status: "subscribed", lang });
    }
  } else {
    await service.createNewsletterSubscribers({ email, lang, source, status: "subscribed" });
  }

  res.status(201).json({ ok: true });
}
