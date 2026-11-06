import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows";

/**
 * Capture the payment as soon as an order is placed.
 *
 * QPay/Botxon take the money before the Express gateway completes the cart —
 * by the time an order exists, the customer has already paid. Medusa, though,
 * only ever saw an authorization, so orders sat in the admin as "Authorized"
 * with `captured_at` null: the dashboard said the money had not been collected
 * when it had, and every order needed a manual capture click before the
 * numbers lined up.
 *
 * Capturing here keeps Medusa's record matching reality. The workflow is
 * idempotent enough for our purposes — an already-captured payment throws and
 * is logged rather than retried, so a double webhook cannot double-capture.
 */
export default async function captureOnOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id",
        "payment_collections.id",
        "payment_collections.status",
        "payment_collections.payments.id",
        "payment_collections.payments.amount",
        "payment_collections.payments.captured_at",
      ],
      filters: { id: data.id },
    });

    const order = orders?.[0] as any;
    if (!order) return;

    const payments = (order.payment_collections || [])
      .flatMap((pc: any) => pc.payments || [])
      .filter((p: any) => p && !p.captured_at);

    if (!payments.length) return;

    for (const payment of payments) {
      try {
        await capturePaymentWorkflow(container).run({
          input: { payment_id: payment.id, amount: payment.amount },
        });
        logger.info(`[capture] order #${order.display_id}: captured payment ${payment.id}`);
      } catch (e) {
        // Never let this fail the order — the money is already with the gateway.
        logger.warn(`[capture] order #${order.display_id}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    logger.warn(`[capture] could not process order ${data.id}: ${(e as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
