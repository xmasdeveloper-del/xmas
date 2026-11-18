import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  loyaltySettings, saveLoyaltySettings, pointsForTotal, awardForOrder,
  balanceOf, redeemPoints, adjustPoints, summaryFor, topHolders,
} from "../lib/loyalty";

/**
 * End-to-end check of the points scheme against the real database and the
 * real promotion workflow: earn, double-award, redeem, over-spend, adjust.
 *
 * Run with: npx medusa exec ./src/scripts/test-loyalty.ts
 */
export default async function testLoyalty({ container }: ExecArgs) {
  const log = (ok: boolean, what: string, detail = "") =>
    console.log(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);

  const customerModule = container.resolve(Modules.CUSTOMER);
  const email = `loyalty-test-${Date.now()}@xmas.local`;
  const created = await customerModule.createCustomers({ email, first_name: "Онооны тест" } as any);
  const customer = Array.isArray(created) ? created[0] : created;
  console.log(`\ncustomer ${customer.id} (${email})\n`);

  // A freshly migrated database has no store row, and the settings live on the
  // store's metadata. Make one so the script also works on an empty database.
  const storeModule = container.resolve(Modules.STORE);
  const [store] = await storeModule.listStores({}, { take: 1 });
  if (!store) {
    await storeModule.createStores({ name: "X-MAS", supported_currencies: [{ currency_code: "mnt", is_default: true }] } as any);
    console.log("created a store row for this test database");
  }

  const before = await loyaltySettings(container);
  await saveLoyaltySettings(container, { enabled: true, earnPercent: 3, pointValue: 1, minRedeem: 5000 });
  const s = await loyaltySettings(container);
  log(s.earnPercent === 3 && s.pointValue === 1 && s.minRedeem === 5000, "settings round-trip", JSON.stringify(s));

  // The rule, pure.
  log(pointsForTotal(100000, s) === 3000, "100,000₮ earns 3,000", String(pointsForTotal(100000, s)));
  log(pointsForTotal(0, s) === 0, "a free order earns nothing");
  log(pointsForTotal(100000, { ...s, enabled: false }) === 0, "disabled earns nothing");
  log(pointsForTotal(100000, { ...s, pointValue: 100 }) === 30, "pointValue 100 → 30 points");

  // Earning, and the idempotence guard.
  const orderId = `order_test_${Date.now()}`;
  const first = await awardForOrder(container, { orderId, customerId: customer.id, total: 250000 });
  const second = await awardForOrder(container, { orderId, customerId: customer.id, total: 250000 });
  log(first === 7500, "250,000₮ earns 7,500", String(first));
  log(second === 0, "the same order cannot pay twice", String(second));
  log((await balanceOf(container, customer.id)) === 7500, "balance is the ledger sum");

  // Too few points.
  let refusedLow = "";
  try { await redeemPoints(container, customer.id, 100); } catch (e: any) { refusedLow = e.message; }
  log(!!refusedLow, "below the minimum is refused", refusedLow);

  // More than they hold.
  let refusedHigh = "";
  try { await redeemPoints(container, customer.id, 99999); } catch (e: any) { refusedHigh = e.message; }
  log(!!refusedHigh, "spending more than the balance is refused", refusedHigh);
  log((await balanceOf(container, customer.id)) === 7500, "a refused redemption leaves the balance alone");

  // A real redemption: writes the ledger, mints the promotion, fills the wallet.
  const r = await redeemPoints(container, customer.id, 5000);
  log(/^XP[A-Z2-9]{6}$/.test(r.code), "code shape", r.code);
  log(r.amount === 5000, "5,000 points → 5,000₮", String(r.amount));
  log((await balanceOf(container, customer.id)) === 2500, "balance drops by what was spent");

  const promotionModule = container.resolve(Modules.PROMOTION);
  const [promo] = await promotionModule.listPromotions({ code: r.code } as any, { take: 1, relations: ["application_method"] });
  log(!!promo, "the promotion exists", promo?.id);
  log((promo as any)?.application_method?.value == 5000, "the promotion is worth 5,000₮", String((promo as any)?.application_method?.value));
  log((promo as any)?.application_method?.currency_code === "mnt", "priced in MNT");

  const [c] = await customerModule.listCustomers({ id: customer.id } as any, { take: 1 });
  const wallet = ((c?.metadata as any)?.coupons || []) as any[];
  log(wallet.some(w => w.code === r.code), "the code is in the customer's wallet");

  // A manual movement, both ways.
  const afterGrant = await adjustPoints(container, customer.id, 500, "тестийн нөхөн оноо");
  log(afterGrant === 3000, "a grant adds", String(afterGrant));
  const afterDeduct = await adjustPoints(container, customer.id, -1000, "тестийн хасалт");
  log(afterDeduct === 2000, "a deduction subtracts", String(afterDeduct));
  let refusedOver = "";
  try { await adjustPoints(container, customer.id, -99999, "хэт их"); } catch (e: any) { refusedOver = e.message; }
  log(!!refusedOver, "cannot deduct below zero", refusedOver);
  let refusedHuge = "";
  try { await adjustPoints(container, customer.id, 9_000_000, "мэдээж биш"); } catch (e: any) { refusedHuge = e.message; }
  log(!!refusedHuge, "a fat-fingered grant is capped", refusedHuge);
  let refusedNaN = "";
  try { await adjustPoints(container, customer.id, Number.POSITIVE_INFINITY, "хязгааргүй"); } catch (e: any) { refusedNaN = e.message; }
  log(!!refusedNaN, "Infinity is refused", refusedNaN);

  const sum = await summaryFor(container, customer.id, 50);
  log(sum.balance === 2000, "summary balance", String(sum.balance));
  log(sum.entries.length === 5, "five ledger rows", String(sum.entries.length));

  const { holders, totals } = await topHolders(container, 20);
  const mine = holders.find(h => h.customer_id === customer.id);
  log(!!mine && mine.balance === 2000, "the holder list sees this customer", JSON.stringify(mine));
  log(totals.outstanding >= 2000, "outstanding total", String(totals.outstanding));

  // Put the shop's own settings back.
  await saveLoyaltySettings(container, before);
  console.log(`\nsettings restored: ${JSON.stringify(await loyaltySettings(container))}`);
  console.log(`test customer left in place for inspection: ${email}\n`);
}
