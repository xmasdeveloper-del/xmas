import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { sendNewOrderEmail } from "../lib/email";
import { mnt, orderRevenue } from "../lib/money";

// Tell the shop an order has arrived.
//
// Until now nothing did. The admin's notifications page is pull-only — the
// owner had to remember to open it — and there was no badge, toast or message
// anywhere. For a shop quoting 1-5 day delivery in Ulaanbaatar that gap decides
// whether a pair goes out today or tomorrow.
//
// Deliberately best-effort: an alert must never be able to fail an order that
// the customer has already paid for.
export default async function orderPlacedAlert({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "total", "refunded_total", "shipping_total",
        "items.title", "items.product_title", "items.quantity",
        "items.quantity", "items.unit_price", "items.total", "items.adjustments.amount",
        // Order money is computed from this; without it every figure in the
        // owner's new-order email is ₮0 (see lib/order-scan).
        "items.detail.quantity",
        "shipping_address.first_name", "shipping_address.last_name",
        "shipping_address.address_1", "shipping_address.city", "shipping_address.phone",
      ],
      filters: { id: data.id },
    });

    const o = orders?.[0] as any;
    if (!o) return;

    const a = o.shipping_address || {};
    const backend = (process.env.MEDUSA_BACKEND_URL || "").replace(/\/+$/, "");

    await sendNewOrderEmail({
      id: o.display_id ? `#${o.display_id}` : o.id,
      total: `₮${new Intl.NumberFormat("mn-MN").format(mnt(orderRevenue(o)))}`,
      customer: [a.first_name, a.last_name].filter(Boolean).join(" ") || "—",
      phone: a.phone || "",
      address: [a.address_1, a.city].filter(Boolean).join(", "),
      items: (o.items || []).map((i: any) => ({
        title: i.product_title || i.title || "Бараа",
        // The size matters more than anything else when picking.
        variant: i.title && i.product_title && i.title !== i.product_title ? i.title : undefined,
        quantity: Number(i.quantity || 0),
      })),
      adminUrl: backend ? `${backend}/app/orders/${o.id}` : undefined,
    });
  } catch (e) {
    logger.warn(`[new-order alert] ${data.id}: ${(e as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
