import { Modules } from "@medusajs/framework/utils";

// Editable homepage content (spec A4 / A-22), stored on the Store's metadata
// (metadata.cms_homepage) — no migration, easy to grow.
//
// This model mirrors the homepage the shop actually has, field for field. The
// first version described a carousel of "hero slides" with kicker/accent/desc,
// which matched nothing on the page: the real hero is a fixed editorial wall —
// a two-line headline, a paragraph, seven studio shots, a rotating badge, one
// CTA and a panel on the right. Those slide fields could never appear anywhere,
// which is why saving appeared to do nothing.
//
// Every field is an OVERRIDE, not a replacement. An empty string means "keep
// the storefront's built-in wording or image", so an untouched CMS renders the
// page exactly as it ships, and the owner can change one headline without
// having to fill in twenty boxes. Text is bilingual { mn, en } and each
// language falls back on its own.

export type Bi = { mn: string; en: string };

/** One slot in the hero wall. Order matters: slots map to wall positions 1..7. */
export type HeroImage = { img: string; alt: Bi };

export type HeroContent = {
  titleA: Bi;       // headline, first line
  titleB: Bi;       // headline, second line
  blurb: Bi;        // paragraph under the wall (shown when no review is featured)
  ring: Bi;         // text circling the badge
  cta: Bi;          // label on the pill button
  ctaShort: Bi;     // phone-width label — the full one truncates mid-word
  ctaHref: string;
  panelLabel: Bi;   // small label in the right-hand block
  panelTitle: Bi;   // its headline
  panelHref: string;
  images: HeroImage[];
};

export type Promo = {
  enabled: boolean;
  kicker: Bi;
  title: Bi;
  desc: Bi;
  cta: Bi;
  href: string;
  img: string;
};

export type HomepageContent = {
  hero: HeroContent;
  promo: Promo;
};

/** The hero wall has seven image slots; extra entries are dropped. */
export const HERO_SLOTS = 7;

const KEY = "cms_homepage";
const TEXT_CAP = 300;

const bi = (mn = "", en = ""): Bi => ({ mn, en });

export function emptyHero(): HeroContent {
  return {
    titleA: bi(), titleB: bi(), blurb: bi(), ring: bi(),
    cta: bi(), ctaShort: bi(), ctaHref: "",
    panelLabel: bi(), panelTitle: bi(), panelHref: "",
    images: Array.from({ length: HERO_SLOTS }, () => ({ img: "", alt: bi() })),
  };
}

// Empty scaffold returned when nothing has been saved yet. Every field blank,
// so the storefront uses its own copy and images.
export function emptyHomepage(): HomepageContent {
  return {
    hero: emptyHero(),
    promo: { enabled: false, kicker: bi(), title: bi(), desc: bi(), cta: bi(), href: "/shop", img: "" },
  };
}

async function getStore(scope: { resolve: (k: any) => any }) {
  const storeModule = scope.resolve(Modules.STORE);
  const [store] = await storeModule.listStores({}, { take: 1, select: ["id", "metadata"] as any });
  return { storeModule, store };
}

export async function readHomepage(scope: { resolve: (k: any) => any }): Promise<HomepageContent> {
  const { store } = await getStore(scope);
  const saved = (store?.metadata as any)?.[KEY];
  if (!saved) return emptyHomepage();
  // Run saved data back through sanitize: it fills in anything the stored shape
  // is missing and discards the legacy slide array (hero used to be an Array,
  // and those fields have no home on the page).
  return sanitize(saved);
}

export async function writeHomepage(scope: { resolve: (k: any) => any }, content: HomepageContent) {
  const { storeModule, store } = await getStore(scope);
  if (!store) throw new Error("Store not found");
  await storeModule.updateStores(store.id, {
    metadata: { ...(store.metadata || {}), [KEY]: content },
  } as any);
  return content;
}

/**
 * Only allow links and images the storefront can safely render: an http(s) URL
 * or a site-relative path. Anything else — `javascript:`, `data:`, a bare
 * word — falls back. Without this a link pasted into the Холбоос field would
 * become an anchor href verbatim, so a `javascript:` URL would execute for
 * every visitor to the home page.
 */
export function safeUrl(raw: unknown, fallback: string): string {
  const v = String(raw ?? "").trim();
  if (!v) return fallback;
  if (v.startsWith("/") && !v.startsWith("//")) return v; // site-relative
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch { /* not an absolute URL */ }
  return fallback;
}

const text = (v: unknown): string => String(v ?? "").slice(0, TEXT_CAP);

// Normalize/validate an incoming payload into a safe HomepageContent.
export function sanitize(input: any): HomepageContent {
  const b = (v: any): Bi => bi(text(v?.mn), text(v?.en));

  // `hero` was an array of slides in the first version of this model. Those
  // fields render nowhere, so a legacy value is discarded rather than migrated.
  const h = (input?.hero && !Array.isArray(input.hero)) ? input.hero : {};

  const images: HeroImage[] = Array.from({ length: HERO_SLOTS }, (_, i) => {
    const s = Array.isArray(h.images) ? h.images[i] : undefined;
    return { img: safeUrl(s?.img, ""), alt: b(s?.alt) };
  });

  const hero: HeroContent = {
    titleA: b(h.titleA), titleB: b(h.titleB), blurb: b(h.blurb), ring: b(h.ring),
    cta: b(h.cta), ctaShort: b(h.ctaShort), ctaHref: safeUrl(h.ctaHref, ""),
    panelLabel: b(h.panelLabel), panelTitle: b(h.panelTitle),
    panelHref: safeUrl(h.panelHref, ""),
    images,
  };

  const p = input?.promo || {};
  const promo: Promo = {
    enabled: !!p.enabled,
    kicker: b(p.kicker), title: b(p.title), desc: b(p.desc), cta: b(p.cta),
    href: safeUrl(p.href, "/shop"), img: safeUrl(p.img, ""),
  };

  return { hero, promo };
}

/** True when the owner has actually enabled a promo with something to show. */
export function promoIsLive(promo: Promo): boolean {
  return !!promo.enabled && !!(promo.title.mn || promo.title.en);
}
