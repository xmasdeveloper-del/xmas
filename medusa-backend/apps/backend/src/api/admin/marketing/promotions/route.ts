import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

// GET /admin/marketing/promotions
// Unified promotions view with usage counts (spec A-20). Usage is counted from
// orders' applied promo codes (bounded scan). Guarded by promotions.write
// (marketers manage promos) — see middlewares.
const MAX_SCAN = 5000;
const PAGE = 500;

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: promos } = await query.graph({
    entity: "promotion",
    fields: [
      "id", "code", "is_automatic", "status", "limit",
      "application_method.type", "application_method.value", "application_method.currency_code",
      // The expiry lives on the campaign the code was created with.
      "campaign.ends_at",
    ],
    pagination: { take: 200, order: { code: "ASC" } },
  });

  // Count usage from orders (order.promotions.code). Bounded scan.
  const usage = new Map<string, number>();
  let scanned = 0;
  let capped = false;
  for (let skip = 0; skip < MAX_SCAN; skip += PAGE) {
    let batch: any[] = [];
    try {
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "promotions.code"],
        pagination: { take: PAGE, skip, order: { created_at: "DESC" } },
      });
      batch = (data || []) as any[];
    } catch {
      break; // promotions relation unavailable → show configs without usage
    }
    for (const o of batch) {
      scanned++;
      for (const p of o.promotions || []) {
        if (p?.code) usage.set(p.code, (usage.get(p.code) || 0) + 1);
      }
    }
    if (batch.length < PAGE) break;
    if (skip + PAGE >= MAX_SCAN) capped = true;
  }

  const rows = (promos || []).map((p: any) => ({
    id: p.id,
    code: p.code,
    automatic: !!p.is_automatic,
    status: p.status,
    type: p.application_method?.type || "—", // percentage | fixed
    value: p.application_method?.value ?? null,
    currency: p.application_method?.currency_code || null,
    // What the owner typed when they made the code: without these the page
    // could not show back the limit and the expiry it had just accepted.
    limit: p.limit ?? null,
    ends_at: p.campaign?.ends_at ?? null,
    used: usage.get(p.code) || 0,
  }));
  rows.sort((a: any, b: any) => b.used - a.used);

  res.json({ promotions: rows, scanned, capped });
}
