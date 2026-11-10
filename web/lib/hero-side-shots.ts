// Products that have a side-on photo to go with their front cut-out.
//
// The hero rail turns a piece from side to front. Without a side photo it has
// to fake one by rotating the front shot away from the viewer, which for a flat
// cut-out is a thin sliver — recognisable as nothing at all. With one, the
// piece hangs the way it would on a real rail and turns to face you.
//
// The two photos are a matched pair: `<slug>.webp` and `<slug>-side.webp` are
// cropped to the same aspect so the jacket keeps its size through the turn.
// Adding a side shot means putting the file next to its front in
// /public/products and adding the slug here — a slug with no file would hang an
// empty hook, so this list is explicit rather than guessed from the name.
export const SIDE_SHOTS = new Set([
  "tnf-nuptse-blush-black",
  "tnf-nuptse-charcoal-black",
  "tnf-nuptse-cream-camel",
  "tnf-nuptse-dusty-rose",
  "tnf-nuptse-ivory-black",
  "tnf-nuptse-pale-sage-patch",
  "tnf-nuptse-teal-petrol",
]);

/** The side photo for a product, or undefined when it has none. */
export function sideShotFor(slug: string, image?: string): string | undefined {
  if (!SIDE_SHOTS.has(slug)) return undefined;
  // Derived from the front's own path so the two never point at different
  // folders if the images ever move.
  return image?.replace(/\.webp$/, "-side.webp") ?? `/products/${slug}-side.webp`;
}
