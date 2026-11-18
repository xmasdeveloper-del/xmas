import { model } from "@medusajs/framework/utils";

/**
 * One movement of a customer's points.
 *
 * A ledger, not a balance column: the balance is the sum of these rows, so it
 * can always be explained — "where did my points go" has an answer, and a
 * double-award or a bad adjustment can be found and reversed rather than
 * argued about. Shops lose customers over points they cannot account for.
 *
 * `order_id` is what makes earning idempotent: the subscriber that awards
 * points runs whenever an order is placed, and a retry must not pay twice.
 */
export const LoyaltyEntry = model
  .define("loyalty_entry", {
    id: model.id({ prefix: "lylt" }).primaryKey(),
    customer_id: model.text(),
    // Positive to earn, negative to spend. Never zero.
    points: model.number(),
    kind: model.enum(["earn", "redeem", "adjust", "revert"]).default("earn"),
    // The order that earned them, the code they were spent on, or neither.
    order_id: model.text().nullable(),
    code: model.text().nullable(),
    note: model.text().nullable(),
  })
  .indexes([
    { on: ["customer_id", "created_at"] },
    // One earning per order, ever.
    { on: ["order_id"], unique: true, where: "order_id IS NOT NULL AND kind = 'earn' AND deleted_at IS NULL" },
  ]);
