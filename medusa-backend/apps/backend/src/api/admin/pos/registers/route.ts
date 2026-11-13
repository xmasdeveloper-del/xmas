import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

/**
 * How many tills this shop has.
 *
 * It used to be two, written into the POS as `"1" | "2"` — a shop with one
 * till had a dead button and a shop with three had nowhere to put the third.
 * The number lives on the store's own metadata, so there is no table to
 * migrate and the POS, the day-close and e-Barimt all read the same answer.
 */
const KEY = "pos_registers";
const MIN = 1;
const MAX = 12;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));

async function store(scope: MedusaRequest["scope"]) {
  const storeModule: any = scope.resolve(Modules.STORE);
  const [first] = await storeModule.listStores({}, { take: 1 });
  return { storeModule, store: first };
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { store: s } = await store(req.scope);
  const raw = Number((s?.metadata as any)?.[KEY]);
  res.json({ registers: Number.isFinite(raw) && raw > 0 ? clamp(raw) : 2, max: MAX });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const want = Number((req.body as any)?.registers);
  if (!Number.isFinite(want)) {
    res.status(400).json({ message: "Кассын тоо буруу байна" });
    return;
  }
  const registers = clamp(want);

  const { storeModule, store: s } = await store(req.scope);
  if (!s) {
    res.status(404).json({ message: "Дэлгүүр олдсонгүй" });
    return;
  }
  // Merge, never replace: the store's metadata carries other settings.
  await storeModule.updateStores(s.id, { metadata: { ...(s.metadata || {}), [KEY]: registers } });
  res.json({ registers, max: MAX });
}
