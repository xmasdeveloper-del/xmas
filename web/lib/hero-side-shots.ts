// Products that have been photographed for the hero rail.
//
// Each one carries two extra images beside its catalogue photo:
//
//   <slug>-rail.webp   the front, re-canvassed for the rail
//   <slug>-side.webp   the side, so it can hang in profile and turn to face you
//
// Both are needed, and the front has to be a rail copy rather than the
// catalogue photo. The rail contains each photo inside a box of fixed shape, so
// what decides how tall a jacket hangs is the shape of its canvas — and the
// catalogue cut-outs are cropped tight to garments posed differently, which put
// the jackets 37% apart on the same rail. The rail copies all share one canvas
// shape, so every piece hangs the same height and keeps that height as it turns.
//
// The catalogue photos are untouched; the grid and the product cards still use
// them.
//
// Adding a piece to the rail means generating both files and adding the slug
// here. The list is explicit rather than guessed from the name: a slug with no
// files behind it would hang an empty hook.
export const RAIL_SHOTS = new Set([
  "tnf-nuptse-blush-black",
  "tnf-nuptse-charcoal-black",
  "tnf-nuptse-cream-camel",
  "tnf-nuptse-dusty-rose",
  "tnf-nuptse-ivory-black",
  "tnf-nuptse-pale-sage-patch",
  "tnf-nuptse-teal-petrol",
]);

/** Kept under the old name so nothing that only cares about "has a side" breaks. */
export const SIDE_SHOTS = RAIL_SHOTS;

export type RailShots = { image?: string; sideImage?: string };

/**
 * The pair of rail photos for a product. Falls back to the catalogue photo on
 * its own, which still hangs — just face-on, and sized to its own crop.
 */
export function railShotsFor(slug: string, image?: string): RailShots {
  if (!RAIL_SHOTS.has(slug)) return { image };
  const base = `/products/${slug}`;
  return { image: `${base}-rail.webp`, sideImage: `${base}-side.webp` };
}
