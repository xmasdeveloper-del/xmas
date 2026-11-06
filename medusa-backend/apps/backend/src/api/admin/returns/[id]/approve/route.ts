import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { receiveAndCompleteReturnOrderWorkflow } from "@medusajs/medusa/core-flows";
import { audit } from "../../../../../lib/audit";

// POST /admin/returns/:id/approve
// One-click approval for a customer-requested return: receives all requested
// items and completes the return (Medusa's built-in flow is multi-step).
//
// Receiving goods back and closing a return is a stock- and money-affecting
// action, so it is guarded and audited like the fulfillment routes: the status
// is checked server-side (the UI hiding the button is not enough — a stale tab
// or a second click would otherwise re-run the workflow on a closed return),
// and the approval is written to the audit log.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "return",
    fields: ["id", "status", "items.item_id", "items.quantity"],
    filters: { id },
  });
  const ret = data?.[0] as any;
  if (!ret) {
    res.status(404).json({ message: "Буцаалт олдсонгүй" });
    return;
  }
  if (ret.status && ret.status !== "requested") {
    res.status(409).json({
      message: `Энэ буцаалтыг аль хэдийн боловсруулсан байна (төлөв: ${ret.status}).`,
    });
    return;
  }
  // Input item id must be the order line item id (return item's item_id).
  const items = (ret.items || [])
    .map((i: any) => ({ id: i.item_id as string, quantity: i.quantity as number }))
    .filter((i: any) => i.id && i.quantity > 0);
  if (!items.length) {
    res.status(400).json({ message: "Буцаалтад хүлээж авах бараа алга" });
    return;
  }

  await receiveAndCompleteReturnOrderWorkflow(req.scope).run({
    input: { return_id: id, items },
  });

  await audit(req.scope, {
    actor_id: (req as any).auth_context?.actor_id || null,
    action: "return.approve",
    target: id,
    meta: { items: items.length, units: items.reduce((a: number, i: any) => a + i.quantity, 0) },
  }, Date.now());

  res.json({ id, status: "received", received_items: items.length });
}
