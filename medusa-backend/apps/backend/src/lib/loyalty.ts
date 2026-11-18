import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows";
import { LOYALTY_MODULE } from "../modules/loyalty";
import { grantCoupon } from "./coupons";

/* ---------------------------------------------------------------------------
 * Points: earned on every purchase, spent on the next one.
 *
 * The design decision worth writing down: spending points does NOT discount a
 * live cart. It mints a single-use discount code worth the points, and that
 * code goes into the customer's wallet.
 *
 * Discounting a cart would mean holding points against something that may
 * never be bought — an abandoned basket silently eating a balance, and two
 * tabs able to spend the same points twice. A code is a durable object: the
 * points leave the ledger once, the customer holds something they can see,
 * and it works in both places a code already works — the online checkout and
 * the till — with no new payment path to get wrong.
 * ------------------------------------------------------------------------ */

export type LoyaltySettings = {
  enabled: boolean;
  /** Percent of the order total returned as points. */
  earnPercent: number;
  /** What one point is worth in togrog when spent. */
  pointValue: number;
  /** Fewest points that may be turned into a code. */
  minRedeem: number;
};

export const LOYALTY_DEFAULTS: LoyaltySettings = {
  enabled: true,
  earnPercent: 3,
  pointValue: 1,
  minRedeem: 5000,
};

const META_KEY = "loyalty";
const MAX_PERCENT = 50;

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

async function storeRecord(scope: any) {
  const storeModule = scope.resolve(Modules.STORE);
  const [first] = await storeModule.listStores({}, { take: 1 });
  return { storeModule, store: first };
}

export async function loyaltySettings(scope: any): Promise<LoyaltySettings> {
  try {
    const { store } = await storeRecord(scope);
    const raw = (store?.metadata as any)?.[META_KEY] || {};
    return {
      enabled: raw.enabled === undefined ? LOYALTY_DEFAULTS.enabled : !!raw.enabled,
      earnPercent: Math.min(MAX_PERCENT, Math.max(0, num(raw.earnPercent, LOYALTY_DEFAULTS.earnPercent))),
      pointValue: Math.max(1, Math.round(num(raw.pointValue, LOYALTY_DEFAULTS.pointValue))),
      minRedeem: Math.max(1, Math.round(num(raw.minRedeem, LOYALTY_DEFAULTS.minRedeem))),
    };
  } catch {
    // A shop that cannot read its settings should still sell; points simply
    // behave as the defaults until it can.
    return { ...LOYALTY_DEFAULTS };
  }
}

export async function saveLoyaltySettings(scope: any, patch: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
  const current = await loyaltySettings(scope);
  const next: LoyaltySettings = {
    enabled: patch.enabled === undefined ? current.enabled : !!patch.enabled,
    earnPercent: Math.min(MAX_PERCENT, Math.max(0, num(patch.earnPercent, current.earnPercent))),
    pointValue: Math.max(1, Math.round(num(patch.pointValue, current.pointValue))),
    minRedeem: Math.max(1, Math.round(num(patch.minRedeem, current.minRedeem))),
  };
  const { storeModule, store } = await storeRecord(scope);
  if (!store) throw new Error("Дэлгүүр олдсонгүй");
  // Merge: the store's metadata carries other settings (the till count, …).
  await storeModule.updateStores(store.id, { metadata: { ...(store.metadata || {}), [META_KEY]: next } });
  return next;
}

/* ---------------------------------- ledger -------------------------------- */

export type LedgerEntry = {
  id: string;
  points: number;
  kind: "earn" | "redeem" | "adjust" | "revert";
  order_id: string | null;
  code: string | null;
  note: string | null;
  created_at: string;
};

const service = (scope: any) => scope.resolve(LOYALTY_MODULE);

export async function ledgerFor(scope: any, customerId: string, take = 50): Promise<LedgerEntry[]> {
  const rows = await service(scope).listLoyaltyEntries(
    { customer_id: customerId },
    { order: { created_at: "DESC" }, take },
  );
  return rows.map((r: any) => ({
    id: r.id,
    points: Number(r.points) || 0,
    kind: r.kind,
    order_id: r.order_id ?? null,
    code: r.code ?? null,
    note: r.note ?? null,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

/**
 * The balance is the sum of the ledger, never a stored number — a stored one
 * drifts from its rows the first time a write half-fails, and then nobody can
 * say which is right.
 */
export async function balanceOf(scope: any, customerId: string): Promise<number> {
  let total = 0;
  for (let skip = 0; ; skip += 500) {
    const rows = await service(scope).listLoyaltyEntries(
      { customer_id: customerId },
      { take: 500, skip },
    );
    for (const r of rows) total += Number(r.points) || 0;
    if (rows.length < 500) break;
  }
  return total;
}

export type Summary = {
  balance: number;
  earned: number;
  spent: number;
  entries: LedgerEntry[];
};

export async function summaryFor(scope: any, customerId: string, take = 50): Promise<Summary> {
  const entries = await ledgerFor(scope, customerId, take);
  const balance = await balanceOf(scope, customerId);
  let earned = 0;
  let spent = 0;
  for (const e of entries) {
    if (e.points > 0) earned += e.points;
    else spent += -e.points;
  }
  return { balance, earned, spent, entries };
}

export type Holder = {
  customer_id: string;
  balance: number;
  earned: number;
  spent: number;
  last_at: string | null;
};

/**
 * Everyone holding points, biggest balance first.
 *
 * Summed in JS from the whole ledger rather than by SQL GROUP BY: the module
 * service has no aggregate API, and for a single shop the ledger is small
 * enough that one pass is cheaper than reaching around the module boundary.
 */
export async function topHolders(scope: any, take = 20): Promise<{ holders: Holder[]; totals: { outstanding: number; earned: number; spent: number; holders: number } }> {
  const acc = new Map<string, Holder>();
  for (let skip = 0; ; skip += 1000) {
    const rows = await service(scope).listLoyaltyEntries({}, { take: 1000, skip, order: { created_at: "DESC" } });
    for (const r of rows) {
      const id = String(r.customer_id);
      const points = Number(r.points) || 0;
      const at = r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? "");
      const cur = acc.get(id) || { customer_id: id, balance: 0, earned: 0, spent: 0, last_at: null };
      cur.balance += points;
      if (points > 0) cur.earned += points;
      else cur.spent += -points;
      // Rows arrive newest-first, so the first one seen is the latest.
      if (!cur.last_at && at) cur.last_at = at;
      acc.set(id, cur);
    }
    if (rows.length < 1000) break;
  }

  const all = [...acc.values()];
  const totals = {
    outstanding: all.reduce((n, h) => n + h.balance, 0),
    earned: all.reduce((n, h) => n + h.earned, 0),
    spent: all.reduce((n, h) => n + h.spent, 0),
    holders: all.filter(h => h.balance > 0).length,
  };
  const holders = all.sort((a, b) => b.balance - a.balance).slice(0, take);
  return { holders, totals };
}

/* ---------------------------------- earning ------------------------------- */

/** Points an order is worth, given the settings. Pure, so the rule is testable. */
export function pointsForTotal(total: number, s: LoyaltySettings): number {
  if (!s.enabled || s.earnPercent <= 0) return 0;
  // A total that is not a finite number earns nothing. Medusa hands totals over
  // as strings and BigNumbers, and a NaN or an Infinity slipping through here
  // would be written into the ledger as a balance nobody could spend or
  // explain.
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const value = Math.round(amount) * (s.earnPercent / 100);
  const points = Math.floor(value / Math.max(1, s.pointValue));
  return Number.isFinite(points) ? Math.max(0, points) : 0;
}

/**
 * Award the points an order earned. Safe to call more than once for the same
 * order: the unique index on (order_id, kind='earn') is the real guard, and
 * the pre-check keeps the common path quiet.
 */
export async function awardForOrder(
  scope: any,
  input: { orderId: string; customerId: string; total: number },
): Promise<number> {
  const { orderId, customerId, total } = input;
  if (!orderId || !customerId) return 0;

  const s = await loyaltySettings(scope);
  const points = pointsForTotal(total, s);
  if (points <= 0) return 0;

  const [already] = await service(scope).listLoyaltyEntries(
    { order_id: orderId, kind: "earn" },
    { take: 1 },
  );
  if (already) return 0;

  try {
    await service(scope).createLoyaltyEntries({
      customer_id: customerId,
      points,
      kind: "earn",
      order_id: orderId,
      note: `${s.earnPercent}% — ${Math.round(total)}₮`,
    });
  } catch (e: any) {
    // Two deliveries of the same event racing each other: the index refused
    // the second, which is exactly what it is for.
    if (/unique|duplicate/i.test(String(e?.message))) return 0;
    throw e;
  }
  return points;
}

/**
 * Take back the points an order earned, because the order was cancelled.
 *
 * Capped at what the customer still holds: if they have already spent the
 * points on a coupon, the shop wears it rather than leaving a negative
 * balance that silently eats their next purchase. Idempotent on (order_id,
 * kind='revert') so a repeated cancellation event cannot claw back twice.
 */
export async function revertForOrder(scope: any, orderId: string): Promise<number> {
  if (!orderId) return 0;

  const [earn] = await service(scope).listLoyaltyEntries({ order_id: orderId, kind: "earn" }, { take: 1 });
  if (!earn) return 0;

  const [already] = await service(scope).listLoyaltyEntries({ order_id: orderId, kind: "revert" }, { take: 1 });
  if (already) return 0;

  const customerId = String(earn.customer_id);
  const earned = Number(earn.points) || 0;
  if (earned <= 0) return 0;

  const balance = await balanceOf(scope, customerId);
  const take = Math.min(earned, Math.max(0, balance));
  if (take <= 0) return 0;

  await service(scope).createLoyaltyEntries({
    customer_id: customerId,
    points: -take,
    kind: "revert",
    order_id: orderId,
    note: take < earned ? `Захиалга цуцлагдсан (${earned} онооноос ${take})` : "Захиалга цуцлагдсан",
  });
  return take;
}

/* --------------------------------- spending ------------------------------- */

// No 0/O or 1/I: this gets read off a phone screen and typed at a till.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const suffix = (n: number) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

export type Redemption = { code: string; amount: number; points: number; balance: number };

/**
 * Turn points into a single-use discount code worth `points × pointValue`.
 *
 * The ledger is written first and the code second, deliberately. If minting
 * fails the debit is reverted and the customer keeps their points; the other
 * order would risk a code in the wild that nobody paid for.
 */
export async function redeemPoints(scope: any, customerId: string, wanted: number): Promise<Redemption> {
  const s = await loyaltySettings(scope);
  if (!s.enabled) throw new Error("Оноо цуглуулах системийг түр хаасан байна.");

  const points = Math.floor(Number(wanted) || 0);
  if (!Number.isFinite(points) || points <= 0) throw new Error("Оноо буруу байна.");
  if (points < s.minRedeem) {
    throw new Error(`Хамгийн багадаа ${s.minRedeem.toLocaleString("mn-MN")} оноо хэрэгтэй.`);
  }

  const balance = await balanceOf(scope, customerId);
  if (points > balance) {
    throw new Error(`Танд ${balance.toLocaleString("mn-MN")} оноо байна.`);
  }

  const amount = points * s.pointValue;
  const code = `XP${suffix(6)}`;

  const entry = await service(scope).createLoyaltyEntries({
    customer_id: customerId,
    points: -points,
    kind: "redeem",
    code,
    note: `${amount.toLocaleString("mn-MN")}₮ купон`,
  });
  const entryId = Array.isArray(entry) ? entry[0]?.id : entry?.id;

  try {
    await createPromotionsWorkflow(scope).run({
      input: {
        promotionsData: [{
          code,
          type: "standard",
          status: "active",
          // One use, by anyone holding it — the wallet is what ties it to a
          // person, and the code is only ever given to them.
          limit: 1,
          application_method: {
            type: "fixed",
            target_type: "order",
            allocation: "across",
            value: amount,
            currency_code: "mnt",
          },
        }],
      } as any,
    });
    await grantCoupon(scope, customerId, code, `${points.toLocaleString("mn-MN")} оноо`);
  } catch (e: any) {
    // Give the points back rather than leave them spent on nothing.
    try {
      if (entryId) await service(scope).deleteLoyaltyEntries([entryId]);
    } catch { /* the revert below still records the truth */ }
    throw new Error(e?.message || "Купон үүсгэж чадсангүй. Оноог буцаалаа.");
  }

  return { code, amount, points, balance: balance - points };
}

/** A manual movement from the admin: a goodwill grant or a correction. */
export async function adjustPoints(
  scope: any,
  customerId: string,
  points: number,
  note: string,
): Promise<number> {
  const raw = Number(points);
  const n = Number.isFinite(raw) ? Math.round(raw) : 0;
  if (!n) throw new Error("Оноо 0 байж болохгүй.");
  // A typo of a hundred million points would be a coupon for a hundred million
  // togrog. Nothing legitimate needs that, so cap a manual movement.
  if (Math.abs(n) > 1_000_000) throw new Error("Нэг удаад 1,000,000 онооноос их хөдөлгөөн хийж болохгүй.");
  if (n < 0) {
    const balance = await balanceOf(scope, customerId);
    if (-n > balance) throw new Error(`Танд ${balance.toLocaleString("mn-MN")} оноо байна.`);
  }
  await service(scope).createLoyaltyEntries({
    customer_id: customerId,
    points: n,
    kind: "adjust",
    note: String(note || "").slice(0, 200) || null,
  });
  return balanceOf(scope, customerId);
}

/** The customer an order belongs to, and what it was worth. */
export async function orderForAward(scope: any, orderId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id", "total", "items.detail.quantity"],
    filters: { id: orderId },
    pagination: { take: 1 },
  });
  const o: any = (data || [])[0];
  if (!o) return null;
  return { id: o.id, customerId: o.customer_id as string | null, total: Math.round(Number(o.total) || 0) };
}
