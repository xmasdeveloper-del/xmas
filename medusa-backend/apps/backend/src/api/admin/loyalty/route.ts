import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { adjustPoints, summaryFor, topHolders } from "../../../lib/loyalty";
import { audit } from "../../../lib/audit";

/**
 * GET  /admin/loyalty?email=…  — one customer's points and their history
 * POST /admin/loyalty          — { email, points, note } a manual movement
 *
 * A manual movement is money, so it is written to the audit log like any
 * other: "who gave whom how many points, and why" must be answerable later.
 */
async function findCustomer(scope: any, email: string) {
  const customerModule = scope.resolve(Modules.CUSTOMER);
  const [c] = await customerModule.listCustomers({ email } as any, { take: 1 });
  return c || null;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const email = String((req.query as any)?.email ?? "").trim().toLowerCase();

  // No e-mail: the shop-wide picture — how many points are outstanding (a real
  // liability, since each one can be spent) and who holds them.
  if (!email) {
    const { holders, totals } = await topHolders(req.scope, 20);
    const customerModule = req.scope.resolve(Modules.CUSTOMER);
    const people = new Map<string, any>();
    if (holders.length) {
      const rows = await customerModule.listCustomers(
        { id: holders.map(h => h.customer_id) } as any,
        { take: holders.length, select: ["id", "email", "first_name", "last_name"] as any },
      );
      for (const c of rows) people.set(c.id, c);
    }
    res.json({
      totals,
      holders: holders.map(h => {
        const c = people.get(h.customer_id);
        return {
          ...h,
          email: c?.email ?? null,
          name: c ? [c.first_name, c.last_name].filter(Boolean).join(" ") || null : null,
        };
      }),
    });
    return;
  }
  const customer = await findCustomer(req.scope, email);
  if (!customer) {
    res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
    return;
  }
  const summary = await summaryFor(req.scope, customer.id, 60);
  res.json({
    customer: { id: customer.id, email: customer.email, first_name: customer.first_name, last_name: customer.last_name },
    ...summary,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body as any) || {};
  const email = String(body.email ?? "").trim().toLowerCase();
  const points = Math.round(Number(body.points) || 0);
  const note = String(body.note ?? "").trim();

  if (!email) {
    res.status(400).json({ message: "И-мэйл шаардлагатай" });
    return;
  }
  const customer = await findCustomer(req.scope, email);
  if (!customer) {
    res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
    return;
  }

  try {
    const balance = await adjustPoints(req.scope, customer.id, points, note);
    await audit(req.scope, {
      actor_id: (req as any).auth_context?.actor_id || null,
      action: points > 0 ? "loyalty.grant" : "loyalty.deduct",
      target: customer.id,
      meta: { points, email: customer.email, note: note || undefined },
    }, Date.now()).catch(() => {});
    const summary = await summaryFor(req.scope, customer.id, 60);
    res.json({
      customer: { id: customer.id, email: customer.email, first_name: customer.first_name, last_name: customer.last_name },
      ...summary,
      balance,
    });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Хадгалж чадсангүй" });
  }
}
