import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { remainingQuantities } from "../../../../lib/fulfillment";
import { optionalRowsById } from "../../../../lib/graph";

// GET /admin/fulfillment/queue — orders that still need work.
//
// Note: `fulfillment_status`/`payment_status` are COMPUTED fields that the query
// graph does not populate (they come back undefined), so we derive the next
// action from the `fulfillments` relation instead, which IS populated:
//   anything still unpacked            → "fulfill"  (includes partly packed orders)
//   all packed, any not shipped        → "ship"
//   shipped but not delivered          → "deliver"  (the in-transit bucket)
//   every fulfillment delivered        → done (excluded from the queue)
//
// The first and third rules are new. Previously "a fulfillment exists" counted
// as fully packed, so an order where only one size had been picked was treated
// as ready to ship; and "all shipped" was treated as finished, so an order with
// the courier vanished from the only screen staff use and could never be
// closed. We scan recent orders newest-first and cap the scan for scale.
const MAX_SCAN = 2000;
const PAGE = 200;

// Payment collection statuses that mean "safe to ship".
const PAID = new Set(["authorized", "captured", "partially_captured"]);

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const out: any[] = [];
  let scanned = 0;
  let capped = false;

  for (let skip = 0; skip < MAX_SCAN; skip += PAGE) {
    // The worklist itself, from plain columns. Everything beyond that — a
    // payment, an address, a fulfillment, a tracking label — is something an
    // order can legitimately be without, and is fetched separately so one slow
    // or failing lookup cannot take the whole queue down with it.
    const pagination = { take: PAGE, skip, order: { created_at: "DESC" as const } };
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "email", "created_at", "status",
        "items.id", "items.title", "items.product_title", "items.variant_sku", "items.quantity", "items.thumbnail",
      ],
      pagination,
    });
    const batch = (data || []) as any[];

    // Asked for by id rather than by re-running the page window, so the second
    // query cannot answer about a different set of orders than the first.
    const ids = batch.map((o) => o.id);
    const [payments, addresses, packed, labelled] = await Promise.all([
      optionalRowsById(req.scope, "order", ["id", "payment_collections.status"], ids),
      optionalRowsById(req.scope, "order", [
        "id", "shipping_address.first_name", "shipping_address.last_name",
        "shipping_address.address_1", "shipping_address.city", "shipping_address.phone",
      ], ids),
      optionalRowsById(req.scope, "order", [
        "id", "fulfillments.id", "fulfillments.shipped_at", "fulfillments.delivered_at",
        "fulfillments.canceled_at", "fulfillments.items.line_item_id", "fulfillments.items.quantity",
      ], ids),
      optionalRowsById(req.scope, "order", ["id", "fulfillments.id", "fulfillments.labels.tracking_number"], ids),
    ]);
    for (const o of batch) {
      scanned++;
      if (o.status === "canceled") continue;

      // Stitch them back on. An order with none of them is a perfectly ordinary
      // order that nobody has packed yet.
      const tracking = new Map<string, any[]>(
        ((labelled.get(o.id)?.fulfillments || []) as any[]).map((f) => [f.id, f.labels || []]),
      );
      const allFuls = ((packed.get(o.id)?.fulfillments || []) as any[])
        .map((f) => ({ ...f, labels: tracking.get(f.id) || [] }));
      const paymentCollections = (payments.get(o.id)?.payment_collections || []) as any[];
      const shippingAddress = addresses.get(o.id)?.shipping_address || {};

      const fuls = allFuls.filter((f: any) => !f.canceled_at);
      const orderLines = (o.items || []).map((i: any) => ({ id: i.id, quantity: i.quantity }));
      // What is still unpacked. An order where only size 42 was fulfilled must
      // stay on the worklist — it used to disappear and the other size never
      // shipped.
      const remaining = remainingQuantities(orderLines, fuls);
      const hasUnshipped = fuls.some((f: any) => !f.shipped_at);
      const inTransit = fuls.filter((f: any) => f.shipped_at && !f.delivered_at);

      // Pick/pack first, then dispatch, then close out the delivery. "deliver"
      // is a real bucket now: previously a shipped order dropped out of the
      // queue entirely and nothing could mark it delivered.
      const action =
        remaining.length ? "fulfill"
          : hasUnshipped ? "ship"
            : inTransit.length ? "deliver"
              : "done";
      if (action === "done") continue;

      // Oldest dispatch still outstanding, so staff can chase a late courier.
      const shippedAt = inTransit
        .map((f: any) => new Date(f.shipped_at).getTime())
        .filter((t: number) => Number.isFinite(t))
        .sort((a: number, b: number) => a - b)[0];
      const daysInTransit = shippedAt
        ? Math.floor((Date.now() - shippedAt) / 86_400_000)
        : null;

      const a = shippingAddress;
      const payStatuses = paymentCollections.map((p: any) => p.status);
      const paid = payStatuses.some((s: string) => PAID.has(s));
      out.push({
        id: o.id,
        display_id: o.display_id,
        email: o.email,
        created_at: o.created_at,
        action,
        // True when some of the order is packed and some is not — the state
        // that used to be invisible.
        partial: remaining.length > 0 && fuls.length > 0,
        days_in_transit: daysInTransit,
        // Tracking lives on the shipment label, and staff need to read it back
        // to a customer who phones — it was previously write-only.
        tracking: inTransit
          .flatMap((f: any) => (f.labels || []).map((l: any) => l.tracking_number))
          .filter(Boolean)
          .join(", "),
        paid,
        payment_status: payStatuses[0] || "—",
        customer: [a.first_name, a.last_name].filter(Boolean).join(" ") || o.email,
        address: [a.address_1, a.city].filter(Boolean).join(", "),
        phone: a.phone || "",
        items: (o.items || []).map((i: any) => ({
          id: i.id,
          title: i.product_title || i.title || "Бараа",
          variant: i.title && i.product_title && i.title !== i.product_title ? i.title : "",
          sku: i.variant_sku || "",
          quantity: i.quantity,
          thumbnail: i.thumbnail || "",
        })),
      });
    }
    if (batch.length < PAGE) break;
    if (skip + PAGE >= MAX_SCAN) capped = true;
  }

  const toFulfill = out.filter((o) => o.action === "fulfill").length;
  const toShip = out.filter((o) => o.action === "ship").length;
  const toDeliver = out.filter((o) => o.action === "deliver").length;
  res.json({
    orders: out,
    scanned,
    capped,
    counts: { toFulfill, toShip, toDeliver, total: out.length },
  });
}
