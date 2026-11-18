import { MedusaService } from "@medusajs/framework/utils";
import { LoyaltyEntry } from "./models/entry";

class LoyaltyModuleService extends MedusaService({ LoyaltyEntry }) {}

export default LoyaltyModuleService;
