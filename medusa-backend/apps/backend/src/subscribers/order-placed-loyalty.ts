import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { awardForOrder, orderForAward } from "../lib/loyalty";

/**
 * Points for a purchase, the moment it is placed.
 *
 * This covers the website. Over-the-counter sales do NOT arrive here:
 * `createOrderWorkflow`, which the POS uses, does not emit `order.placed` —
 * only the online checkout's complete-cart does — so the till awards its own
 * points in `/admin/offline-sale`. Both call the same idempotent
 * `awardForOrder`, so the rule itself lives in one place.
 *
 * A guest order earns nothing — there is nobody to pay. Deliberately
 * best-effort, like the owner's alert next door: a failure here must never be
 * able to fail an order the customer has already paid for, and the ledger's
 * unique index means a retry cannot pay twice.
 */
export default async function orderPlacedLoyalty({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const order = await orderForAward(container, data.id);
    if (!order?.customerId) return;
    const points = await awardForOrder(container, {
      orderId: order.id,
      customerId: order.customerId,
      total: order.total,
    });
    if (points > 0) logger.info(`[loyalty] ${points} оноо → ${order.customerId} (${order.id})`);
  } catch (e: any) {
    logger.error(`[loyalty] could not award points for ${data?.id}: ${e?.message}`);
  }
}

export const config: SubscriberConfig = { event: "order.placed" };
