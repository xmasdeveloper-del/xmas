import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { cancelReturnRequestWorkflow } from "@medusajs/medusa/core-flows";
import { audit } from "../../../../../lib/audit";

// POST /admin/returns/:id/reject  { reason? }
//
// Decline a customer's return request. Approving was the only thing the admin
// could do with a return, so a worn or out-of-policy pair had no outcome at all
// — staff either accepted it or left the request sitting open forever. Guarded
// by returns.write and audited, like the approval.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const reason = String((req.body as any)?.reason || "").slice(0, 300);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "return",
    fields: ["id", "status"],
    filters: { id },
  });
  const ret = data?.[0] as any;
  if (!ret) {
    res.status(404).json({ message: "Буцаалт олдсонгүй" });
    return;
  }
  if (ret.status && ret.status !== "requested") {
    res.status(409).json({
      message: `Зөвхөн хүсэлт гаргасан буцаалтыг татгалзах боломжтой (төлөв: ${ret.status}).`,
    });
    return;
  }

  await cancelReturnRequestWorkflow(req.scope).run({ input: { return_id: id } });

  await audit(req.scope, {
    actor_id: (req as any).auth_context?.actor_id || null,
    action: "return.reject",
    target: id,
    meta: reason ? { reason } : {},
  }, Date.now());

  res.json({ id, status: "canceled" });
}
