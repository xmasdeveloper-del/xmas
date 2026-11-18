import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { balanceOf, loyaltySettings } from "../../../../lib/loyalty";
import { walletWithState } from "../../../../lib/coupons";

/**
 * The person standing at the till.
 *
 * In-store sales used to carry a typed name and a phone number in metadata and
 * nothing else — no account, so a regular who bought every month earned
 * nothing and the shop could not tell it was the same person. This finds them
 * by e-mail or phone, or enrols them on the spot, and hands the cashier their
 * points and their unspent codes so both can be used at the counter.
 *
 * GET  /admin/pos/customer?q=…                 — find
 * POST /admin/pos/customer { email, name, phone } — find or enrol
 */
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;
// Mongolian numbers are eight digits; compare on digits only so 9418-3355,
// +976 9418 3355 and 94183355 are one customer.
const digits = (v: string) => v.replace(/\D/g, "");

async function withPoints(scope: any, customer: any) {
  const [balance, coupons, settings] = await Promise.all([
    balanceOf(scope, customer.id).catch(() => 0),
    walletWithState(scope, customer.id).catch(() => [] as any[]),
    loyaltySettings(scope),
  ]);
  return {
    customer: {
      id: customer.id,
      email: customer.email,
      name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || null,
      phone: customer.phone || null,
    },
    points: { balance, enabled: settings.enabled, pointValue: settings.pointValue, minRedeem: settings.minRedeem },
    coupons: (coupons as any[]).filter(c => c.state === "usable"),
  };
}

async function find(scope: any, q: string) {
  const customerModule = scope.resolve(Modules.CUSTOMER);
  const term = q.toLowerCase();

  if (LOOKS_LIKE_EMAIL.test(term) || term.includes("@")) {
    const [c] = await customerModule.listCustomers({ email: term } as any, { take: 1 });
    return c || null;
  }

  const wanted = digits(term);
  if (wanted.length < 6) return null;
  // Phones are stored as typed, so the match is done here rather than in SQL.
  for (let skip = 0; ; skip += 500) {
    const page = await customerModule.listCustomers({}, { take: 500, skip, select: ["id", "email", "first_name", "last_name", "phone"] as any });
    const hit = page.find((c: any) => c.phone && digits(String(c.phone)).endsWith(wanted));
    if (hit) return hit;
    if (page.length < 500) return null;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = clean((req.query as any)?.q, 120);
  if (!q) {
    res.status(400).json({ message: "И-мэйл эсвэл утас оруулна уу" });
    return;
  }
  const customer = await find(req.scope, q);
  if (!customer) {
    res.status(404).json({ message: "Ийм харилцагч бүртгэлгүй байна" });
    return;
  }
  res.json(await withPoints(req.scope, customer));
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body as any) || {};
  const email = clean(body.email, 160).toLowerCase();
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 40);

  if (!email || !LOOKS_LIKE_EMAIL.test(email)) {
    res.status(400).json({ message: "Оноо цуглуулахад и-мэйл хаяг шаардлагатай" });
    return;
  }

  const customerModule = req.scope.resolve(Modules.CUSTOMER);
  const [existing] = await customerModule.listCustomers({ email } as any, { take: 1 });
  if (existing) {
    // Fill in what the counter has learned, never overwrite what is there.
    const patch: any = {};
    if (phone && !existing.phone) patch.phone = phone;
    if (name && !existing.first_name) patch.first_name = name;
    if (Object.keys(patch).length) {
      try { await customerModule.updateCustomers(existing.id, patch); } catch { /* not worth failing a sale */ }
    }
    res.json(await withPoints(req.scope, { ...existing, ...patch }));
    return;
  }

  const created = await customerModule.createCustomers({
    email,
    first_name: name || null,
    phone: phone || null,
  } as any);
  const customer = Array.isArray(created) ? created[0] : created;
  res.status(201).json(await withPoints(req.scope, customer));
}
