import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows";

/**
 * Adds a RETURN shipping option to the Mongolia service zone (is_return=true).
 * Required before customers can request returns (POST /store/returns needs a
 * return_shipping.option_id). Free returns — the store covers return postage.
 * Idempotent.
 */
export default async function seedReturnShipping({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const fulfillment = container.resolve(Modules.FULFILLMENT);

  const [profile] = await fulfillment.listShippingProfiles({});
  // seed-mnt owns the zone and names it "Монгол". Stores seeded before that
  // rename still carry the English name, so accept either — this used to throw
  // on a database that was in fact set up correctly.
  const [zone] = [
    ...(await fulfillment.listServiceZones({ name: "Монгол" })),
    ...(await fulfillment.listServiceZones({ name: "Mongolia" })),
  ];
  if (!profile || !zone) {
    throw new Error(
      'No Mongolian service zone (looked for "Монгол" and "Mongolia") or no shipping profile — run seed-mnt first.',
    );
  }

  const existing = await fulfillment.listShippingOptions({ name: "Буцаалт (MN)" });
  if (existing.length) { logger.info("Return shipping option already exists."); return; }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Буцаалт (MN)",
        service_zone_id: zone.id,
        shipping_profile_id: profile.id,
        provider_id: "manual_manual",
        type: { label: "Буцаалт", description: "Free return shipping", code: "return" },
        price_type: "flat",
        prices: [{ currency_code: "mnt", amount: 0 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "true", operator: "eq" },
        ],
      },
    ],
  });
  logger.info("Created return shipping option: Буцаалт (MN)");
}
