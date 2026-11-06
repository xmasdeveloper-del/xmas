import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { audit } from "../../../../../lib/audit";

// POST /store/customers/me/deletion-request
// GDPR-style "right to erasure": the signed-in customer requests deletion of
// their personal data. We flag the account (metadata.deletion_requested_at) for
// an admin to process, rather than hard-deleting — order records must be retained
// for accounting / e-Barimt. Requires a customer auth token.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id;
  if (!customerId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const customerModule = req.scope.resolve(Modules.CUSTOMER);
  const requestedAt = new Date().toISOString();

  // Merge, never replace. `updateCustomers` overwrites the whole metadata
  // object, so passing the flag alone wiped everything else held there — the
  // shop's own internal note about that customer included.
  const existing: any = await customerModule
    .retrieveCustomer(customerId, { select: ["id", "metadata"] as any })
    .catch(() => null);

  await customerModule.updateCustomers(customerId, {
    metadata: { ...(existing?.metadata || {}), deletion_requested_at: requestedAt },
  });

  // Durable trace for the owner: a console line is not something anybody reads,
  // and an erasure request carries a legal clock.
  await audit(req.scope, {
    actor_id: customerId,
    action: "privacy.deletion_request",
    target: customerId,
    meta: { requested_at: requestedAt },
  }, Date.now());

  res.json({ ok: true, requested_at: requestedAt });
}
