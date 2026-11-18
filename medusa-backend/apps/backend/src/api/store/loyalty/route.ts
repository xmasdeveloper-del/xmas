import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { loyaltySettings, summaryFor } from "../../../lib/loyalty";
import { walletWithState } from "../../../lib/coupons";

/**
 * GET /store/loyalty — what the signed-in customer has.
 *
 * Balance, how it was earned and spent, the codes already minted from it, and
 * the rules in force, so the account page can explain itself rather than show
 * a number with no story behind it.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id;
  if (!customerId) {
    res.status(401).json({ message: "Нэвтэрнэ үү" });
    return;
  }

  const [settings, summary, coupons] = await Promise.all([
    loyaltySettings(req.scope),
    summaryFor(req.scope, customerId, 40),
    walletWithState(req.scope, customerId).catch(() => []),
  ]);

  res.json({
    enabled: settings.enabled,
    earnPercent: settings.earnPercent,
    pointValue: settings.pointValue,
    minRedeem: settings.minRedeem,
    balance: summary.balance,
    earned: summary.earned,
    spent: summary.spent,
    entries: summary.entries,
    coupons,
  });
}
