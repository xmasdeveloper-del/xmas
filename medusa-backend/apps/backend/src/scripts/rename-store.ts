import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

/**
 * Name the store.
 *
 * The seed only names a NEW store, so a database seeded before the rebrand
 * keeps whatever it was called — and the admin's whole left-hand sidebar is
 * headed with that name, so the shop's own staff were looking at "NARAN" long
 * after the shop became X-MAS.
 *
 * Idempotent, and takes the name so this does not have to be edited again:
 *
 *   npx medusa exec src/scripts/rename-store.ts
 *   STORE_NAME="X-MAS" npx medusa exec src/scripts/rename-store.ts
 */
export const STORE_NAME = "X-MAS";

export default async function renameStore({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const storeModule = container.resolve(Modules.STORE);
  const want = (process.env.STORE_NAME || STORE_NAME).trim();
  if (!want) {
    logger.warn("STORE_NAME is empty — nothing to rename to.");
    return;
  }

  const stores = await storeModule.listStores({});
  if (!stores.length) {
    logger.warn("No store found — nothing to rename.");
    return;
  }

  for (const store of stores) {
    if (store.name === want) {
      logger.info(`Store ${store.id} is already named "${want}".`);
      continue;
    }
    await storeModule.updateStores(store.id, { name: want });
    logger.info(`Renamed store ${store.id}: "${store.name}" -> "${want}".`);
  }
}
