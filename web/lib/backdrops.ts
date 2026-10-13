import type { Category } from "./types";

/**
 * Empty studio plates that sit behind a product card's shot.
 *
 * These are generated backgrounds — a seamless cyclorama and nothing else. The
 * product itself is always the real photograph, drawn on top untouched, which
 * is the line that matters: a shopper paying for a Chuck 70 has to be looking
 * at the Chuck 70 that will arrive, not at a convincing drawing of one.
 *
 * Only light plates are mapped, so dark text stays readable on top of them.
 */
const PLATES = {
  sand: "/backdrops/sand.webp",
  slate: "/backdrops/slate.webp",
  cream: "/backdrops/cream.webp",
} as const;

const BY_BRAND: Partial<Record<Category, keyof typeof PLATES>> = {
  UGG: "sand",
  "The North Face": "cream",
  "Christian Dior": "cream",
};

export const backdropFor = (category: Category): string =>
  PLATES[BY_BRAND[category] ?? "slate"];
