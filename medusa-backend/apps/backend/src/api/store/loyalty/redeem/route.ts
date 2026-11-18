import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { redeemPoints } from "../../../../lib/loyalty";

/**
 * POST /store/loyalty/redeem — turn points into a discount code.
 *
 * The code lands in the customer's wallet and works at the online checkout
 * and at the till, both of which already take codes. Rate-limited in
 * middlewares: minting money is not something to allow in a loop.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id;
  if (!customerId) {
    res.status(401).json({ message: "Нэвтэрнэ үү" });
    return;
  }

  try {
    const result = await redeemPoints(req.scope, customerId, Number((req.body as any)?.points));
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Оноо ашиглаж чадсангүй" });
  }
}
