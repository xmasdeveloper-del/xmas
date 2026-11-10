import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { lowStockReport } from "../../../../lib/catalog";

// GET /admin/catalog/low-stock?threshold=5 — inventory-managed variants at or
// below the threshold, lowest first.
//
// `untracked` comes back too. A variant set not to manage inventory has no
// stock figure, so it can never be low: without that number the page showed a
// reassuring zero for a catalogue where nothing was being counted at all.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const threshold = Math.max(0, Number((req.query as any)?.threshold ?? 5) || 5);
  const { rows, tracked, untracked } = await lowStockReport(req.scope, threshold);
  res.json({ threshold, count: rows.length, variants: rows, tracked, untracked });
}
