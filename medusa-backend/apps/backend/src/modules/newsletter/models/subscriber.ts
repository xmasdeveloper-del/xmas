import { model } from "@medusajs/framework/utils";

/**
 * Someone who asked to hear when new stock lands.
 *
 * The footer has always invited visitors to leave an address, and the form
 * always answered "thank you" — while throwing the address away. This is the
 * table that makes the promise true. Nothing else is collected: an address,
 * the language the visitor was reading in, and where they typed it.
 */
export const NewsletterSubscriber = model
  .define("newsletter_subscriber", {
    id: model.id({ prefix: "nws" }).primaryKey(),
    email: model.text(),
    // Which language to write to them in.
    lang: model.text().nullable(),
    // Where the address came from (footer, a campaign page, the till…).
    source: model.text().nullable(),
    status: model.enum(["subscribed", "unsubscribed"]).default("subscribed"),
  })
  .indexes([
    // One row per address; re-subscribing updates the row it already has.
    { on: ["email"], unique: true, where: "deleted_at IS NULL" },
    { on: ["created_at"] },
  ]);
