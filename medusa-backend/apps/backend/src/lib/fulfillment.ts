import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
  createReservationsWorkflow,
} from "@medusajs/medusa/core-flows";

// Shared helpers for the admin fulfillment queue (spec A1 / A-05..A-07).
// Fulfillment lifecycle: not_fulfilled → (fulfill) → fulfilled → (ship) →
// shipped → (deliver) → delivered.

export type OrderScope = { resolve: (k: any) => any };

// Fulfillments linked to an order (lifecycle timestamps + which line items and
// how many each one covers), via query graph. The item rows are what make
// partial fulfillment safe: without them we cannot tell a complete order from
// one where only size 42 has been packed.
export async function fulfillmentsOfOrder(scope: OrderScope, orderId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "fulfillments.id",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "fulfillments.items.line_item_id",
      "fulfillments.items.quantity",
    ],
    filters: { id: orderId },
  });
  return ((data?.[0] as any)?.fulfillments || []) as any[];
}

export type OrderItemQty = { id: string; quantity: number };

/**
 * What of an order is still unpacked: ordered quantity per line item minus
 * everything already covered by a live (non-cancelled) fulfillment.
 *
 * Pure so it can be unit-tested — the bug it replaces shipped goods that were
 * never picked, and that must not be able to come back unnoticed.
 */
export function remainingQuantities(
  items: OrderItemQty[],
  fulfillments: any[],
): OrderItemQty[] {
  const done = new Map<string, number>();
  for (const f of fulfillments || []) {
    if (f?.canceled_at) continue;
    for (const fi of f?.items || []) {
      const id = fi?.line_item_id;
      if (!id) continue;
      done.set(id, (done.get(id) || 0) + Number(fi.quantity || 0));
    }
  }
  return items
    .map((i) => ({ id: i.id, quantity: Number(i.quantity || 0) - (done.get(i.id) || 0) }))
    .filter((i) => i.quantity > 0);
}

/** The line items a single fulfillment covers, shaped for the shipment workflow. */
export function fulfillmentItems(ful: any): OrderItemQty[] {
  return (ful?.items || [])
    .filter((fi: any) => fi?.line_item_id)
    .map((fi: any) => ({ id: fi.line_item_id as string, quantity: Number(fi.quantity || 0) }));
}

// Line items (id + quantity) for a fulfillment/shipment workflow.
export async function orderItems(scope: OrderScope, orderId: string) {
  const orderModule = scope.resolve(Modules.ORDER);
  const order = await orderModule.retrieveOrder(orderId, { relations: ["items"] });
  return (order.items || []).map((i: any) => ({ id: i.id, quantity: i.quantity }));
}

// Reserve stock for an order's inventory-managed line items (linked by
// line_item_id) so createOrderFulfillmentWorkflow can consume the reservation.
// Direct orders (e.g. offline sales) have no reservations otherwise. Unmanaged
// variants need none and are skipped. Returns how many reservations were made.
export async function reserveOrderItems(scope: OrderScope, orderId: string): Promise<{ reserved: number }> {
  const orderModule = scope.resolve(Modules.ORDER);
  const stockLocationModule = scope.resolve(Modules.STOCK_LOCATION);
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const [location] = await stockLocationModule.listStockLocations({});
  if (!location) return { reserved: 0 };

  const order = await orderModule.retrieveOrder(orderId, { relations: ["items"] });
  const lineItems = (order.items || []).filter((i: any) => i.variant_id);
  if (!lineItems.length) return { reserved: 0 };

  const wanted = new Set(lineItems.map((i: any) => i.variant_id));
  const invByVariant = new Map<string, string>();
  for (let skip = 0; ; skip += 500) {
    const { data } = await query.graph({
      entity: "variant",
      fields: ["id", "manage_inventory", "inventory_items.inventory_item_id"],
      pagination: { skip, take: 500 },
    });
    for (const v of data as any[]) {
      if (!wanted.has(v.id) || !v.manage_inventory) continue;
      const iid = (v.inventory_items || [])[0]?.inventory_item_id;
      if (iid) invByVariant.set(v.id, iid);
    }
    if (data.length < 500) break;
  }

  const reservations = lineItems
    .filter((i: any) => invByVariant.has(i.variant_id))
    .map((i: any) => ({
      line_item_id: i.id,
      inventory_item_id: invByVariant.get(i.variant_id)!,
      location_id: location.id,
      quantity: i.quantity,
    }));
  if (!reservations.length) return { reserved: 0 };
  await createReservationsWorkflow(scope as any).run({ input: { reservations } });
  return { reserved: reservations.length };
}

// Fulfil whatever of the order is still unpacked.
//
// This used to refuse outright if any fulfillment existed, which meant a
// remainder could never be packed: staff who fulfilled size 42 from Medusa's
// own order page had no way to then fulfil size 41, and the queue treated the
// order as finished. Working from the outstanding quantities covers both the
// first fulfillment and any remainder, and is still a no-op once the order is
// complete.
export async function fulfillOrder(scope: OrderScope, orderId: string) {
  const fulfillments = await fulfillmentsOfOrder(scope, orderId);
  const items = await orderItems(scope, orderId);
  if (!items.length) return { fulfilled: false, reason: "no_items" };
  const remaining = remainingQuantities(items, fulfillments);
  if (!remaining.length) return { fulfilled: false, reason: "already_fulfilled" };
  await createOrderFulfillmentWorkflow(scope as any).run({
    input: { order_id: orderId, items: remaining },
  });
  return { fulfilled: true, items: remaining.length };
}

// Ship every not-yet-shipped fulfillment of the order, attaching tracking (if any).
export async function shipOrder(
  scope: OrderScope,
  orderId: string,
  tracking?: { tracking_number?: string; tracking_url?: string },
  opts: { noNotification?: boolean } = {},
) {
  const fulfillments = (await fulfillmentsOfOrder(scope, orderId)).filter((f) => !f.canceled_at);
  if (!fulfillments.length) return { shipped: 0, reason: "not_fulfilled" };
  const labels =
    tracking?.tracking_number || tracking?.tracking_url
      ? [{ tracking_number: tracking?.tracking_number || "", tracking_url: tracking?.tracking_url || "", label_url: "" }]
      : undefined;
  let shipped = 0;
  for (const ful of fulfillments) {
    if (ful.shipped_at) continue;
    // Ship only what THIS fulfillment holds. Passing the order's full item list
    // to every fulfillment is what previously marked an unpicked size as
    // shipped and then dropped the order out of the queue entirely.
    const items = fulfillmentItems(ful);
    if (!items.length) continue;
    await createOrderShipmentWorkflow(scope as any).run({
      input: {
        order_id: orderId, fulfillment_id: ful.id, items, labels,
        ...(opts.noNotification ? { no_notification: true } : {}),
      },
    });
    shipped++;
  }
  return { shipped };
}

// Mark every shipped-not-delivered fulfillment of the order as delivered.
//
// A fulfillment that was never shipped must not jump straight to delivered:
// that skips `shipment.created`, so the customer never gets the dispatch
// notice, and it contradicts the route's own "ship it first" error. The
// offline-sale path legitimately needs the shortcut — goods leave over the
// counter — so it passes allowUnshipped explicitly.
export async function deliverOrder(
  scope: OrderScope,
  orderId: string,
  opts: { allowUnshipped?: boolean } = {},
) {
  const fulfillments = (await fulfillmentsOfOrder(scope, orderId)).filter((f) => !f.canceled_at);
  let delivered = 0;
  for (const ful of fulfillments) {
    if (ful.delivered_at) continue;
    if (!ful.shipped_at && !opts.allowUnshipped) continue;
    await markOrderFulfillmentAsDeliveredWorkflow(scope as any).run({
      input: { orderId, fulfillmentId: ful.id },
    });
    delivered++;
  }
  return { delivered };
}
