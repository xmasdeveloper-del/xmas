import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { revertForOrder } from "../lib/loyalty";

/**
 * A cancelled order keeps no points.
 *
 * Only cancellation is handled automatically: there is nothing to apportion,
 * the whole sale is undone. A partial return is a judgement call about how
 * much of the purchase still stands, so it is left to the owner on the
 * Онооны систем page, where a deduction is written to the audit log with a
 * reason — rather than guessing a proportion here.
 *
 * Best-effort, like the other order subscribers: this must never be able to
 * fail a cancellation.
 */
export default async function orderCanceledLoyalty({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const taken = await revertForOrder(container, data.id);
    if (taken > 0) logger.info(`[loyalty] ${taken} оноо буцаагдлаа (${data.id} цуцлагдсан)`);
  } catch (e: any) {
    logger.error(`[loyalty] could not revert points for ${data?.id}: ${e?.message}`);
  }
}

export const config: SubscriberConfig = { event: "order.canceled" };
