import type { CmsBi } from "./medusa";
import type { Lang } from "./i18n";

// Resolving the admin's homepage overrides against the storefront's own copy.
//
// The rule, in one place so the hero and the promo banner cannot drift: a field
// the owner left blank is not an instruction to show nothing — it means "keep
// what the site already says". Each language falls back on its own, so writing
// only the Mongolian headline leaves the English page untouched rather than
// blanking it.

/** The owner's text for this language, or "" when they left it blank. */
export function cmsText(bi: CmsBi | null | undefined, lang: Lang): string {
  if (!bi || typeof bi !== "object") return "";
  const v = lang === "mn" ? bi.mn : bi.en;
  return typeof v === "string" ? v.trim() : "";
}

/** The owner's override when they set one, otherwise the built-in default. */
export function orDefault(bi: CmsBi | null | undefined, lang: Lang, fallback: string): string {
  return cmsText(bi, lang) || fallback;
}

/** A URL the owner set, or the built-in one. Blank and junk both fall back. */
export function urlOrDefault(href: string | null | undefined, fallback: string): string {
  const v = typeof href === "string" ? href.trim() : "";
  return v || fallback;
}

/**
 * The image for one hero wall slot: the owner's upload if there is one, else
 * the shot the site ships with. `alt` follows the same rule independently, so a
 * replaced photo with no description still has the original's wording rather
 * than none at all.
 */
export function heroSlot(
  images: { img: string; alt: CmsBi }[] | null | undefined,
  index: number,
  lang: Lang,
  defaults: { src: string; alt: string },
): { src: string; alt: string } {
  const slot = Array.isArray(images) ? images[index] : undefined;
  const src = typeof slot?.img === "string" && slot.img.trim() ? slot.img.trim() : defaults.src;
  return { src, alt: orDefault(slot?.alt, lang, defaults.alt) };
}
