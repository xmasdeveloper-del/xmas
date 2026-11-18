import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { loyaltySettings, saveLoyaltySettings } from "../../../../lib/loyalty";

// GET/POST /admin/loyalty/settings — the rules of the points scheme.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ settings: await loyaltySettings(req.scope) });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (req.body as any) || {};
    const settings = await saveLoyaltySettings(req.scope, {
      enabled: body.enabled,
      earnPercent: body.earnPercent,
      pointValue: body.pointValue,
      minRedeem: body.minRedeem,
    });
    res.json({ settings });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Хадгалж чадсангүй" });
  }
}
