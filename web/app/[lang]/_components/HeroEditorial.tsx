import { LocaleLink as Link } from "@/components/LocaleLink";
import { Photo } from "@/components/Photo";
import { ArrowUpRight } from "@/components/Icons";
import type { Review } from "@/lib/types";
import type { HomepageCms } from "@/lib/medusa";
import { heroSlot, orDefault, urlOrDefault } from "@/lib/cms-text";
import { tFor, type Lang } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
 * The editorial hero: a five-column wall of studio shots, stepped so the
 * silhouette rises towards the edges, under a centred headline.
 *
 * Every number below was measured off the reference rather than guessed. The
 * reference art board is 796px of content wide; the cards are 150 wide with a
 * 12 gap, which is why the ratios read as odd fractions — they are the real
 * pixel sizes, kept as ratios so the whole thing scales.
 *
 *   column 1   tall 150x207  + short 150x97
 *   column 2   tall 150x270
 *   column 3   plain 152x181 + the pill beneath it
 *   column 4   tall 150x271
 *   column 5   tall 150x205  + short 150x97
 *
 * The columns are bottom-aligned and nothing is positioned by hand: because
 * each card carries its own aspect ratio, `items-end` reproduces the staggered
 * tops of the original to within a couple of pixels.
 * ------------------------------------------------------------------------ */

const RATIO = {
  tall: "150 / 207",
  tallRight: "150 / 205", // column 5's is a shade shorter in the original
  short: "150 / 97",
  mid: "150 / 270",
  centre: "152 / 181",
} as const;

/* Cards are folder-shaped: one half of the top edge sits higher, stepping down
 * to the other half through an S-curve. Columns 1 and 2 carry the tab on the
 * left, 4 and 5 mirror it, 3 is a plain rounded rectangle.
 *
 * The path is in objectBoundingBox units, so it has to know the card's aspect
 * ratio: one x unit is the card's width and one y unit its height, and a corner
 * only looks circular when the y radius is scaled by width/height. */
function tabPath(aspect: number, side: "left" | "right") {
  const r = 0.1; // corner radius, as a fraction of the card's width
  const rx = r;
  const ry = r * aspect;
  const sy = 0.08 * aspect; // how far the lower half drops
  const f = 0.07; // half-width of the S-curve between the two halves
  const tab = 0.56; // where the step sits across the card
  const n = (v: number) => +v.toFixed(4);

  if (side === "left") {
    return [
      `M ${n(rx)},0`,
      `L ${n(tab - f)},0`,
      `C ${n(tab)},0 ${n(tab)},${n(sy)} ${n(tab + f)},${n(sy)}`,
      `L ${n(1 - rx)},${n(sy)}`,
      `A ${n(rx)},${n(ry)} 0 0 1 1,${n(sy + ry)}`,
      `L 1,${n(1 - ry)}`,
      `A ${n(rx)},${n(ry)} 0 0 1 ${n(1 - rx)},1`,
      `L ${n(rx)},1`,
      `A ${n(rx)},${n(ry)} 0 0 1 0,${n(1 - ry)}`,
      `L 0,${n(ry)}`,
      `A ${n(rx)},${n(ry)} 0 0 1 ${n(rx)},0`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${n(rx)},${n(sy)}`,
    `L ${n(1 - tab - f)},${n(sy)}`,
    `C ${n(1 - tab)},${n(sy)} ${n(1 - tab)},0 ${n(1 - tab + f)},0`,
    `L ${n(1 - rx)},0`,
    `A ${n(rx)},${n(ry)} 0 0 1 1,${n(ry)}`,
    `L 1,${n(1 - ry)}`,
    `A ${n(rx)},${n(ry)} 0 0 1 ${n(1 - rx)},1`,
    `L ${n(rx)},1`,
    `A ${n(rx)},${n(ry)} 0 0 1 0,${n(1 - ry)}`,
    `L 0,${n(sy + ry)}`,
    `A ${n(rx)},${n(ry)} 0 0 1 ${n(rx)},${n(sy)}`,
    "Z",
  ].join(" ");
}

const TALL_A = 150 / 207;
const MID_A = 150 / 270;

const CLIPS = [
  { id: "xmas-tab-tall-l", d: tabPath(TALL_A, "left") },
  { id: "xmas-tab-tall-r", d: tabPath(TALL_A, "right") },
  { id: "xmas-tab-mid-l", d: tabPath(MID_A, "left") },
  { id: "xmas-tab-mid-r", d: tabPath(MID_A, "right") },
];

function Card({
  src, alt, ratio, clip, priority, sizes,
}: {
  src: string;
  alt: string;
  ratio: string;
  clip?: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden bg-surface-2 ${clip ? "" : "rounded-[10.5%]"}`}
      style={{ aspectRatio: ratio, ...(clip ? { clipPath: `url(#${clip})` } : null) }}
    >
      <Photo src={src} alt={alt} sizes={sizes} priority={priority} imgClassName="object-cover" />
    </div>
  );
}

/* The ring of type around the badge. A real <textPath> rather than letters
 * rotated one by one, so it stays legible at any size. */
function RingBadge({ label, href }: { label: string; href: string }) {
  const text = `${label.toUpperCase()} · `.repeat(2);
  return (
    <Link
      href={href}
      aria-label={label}
      className="group relative grid aspect-square w-[clamp(56px,6.8vw,84px)] place-items-center"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full motion-safe:animate-[spin_18s_linear_infinite]" aria-hidden>
        <defs>
          <path id="xmas-ring" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
        </defs>
        <text className="fill-ink/55 text-[8.6px] font-semibold uppercase tracking-[.22em]">
          <textPath href="#xmas-ring" startOffset="0">{text}</textPath>
        </text>
      </svg>
      <span className="grid aspect-square w-[64%] place-items-center rounded-full bg-ink text-white transition-colors group-hover:bg-accent">
        <ArrowUpRight width={15} height={15} />
      </span>
    </Link>
  );
}

/* Initials, never a stock portrait — these are the people who actually left a
 * review. With no reviews yet there is nobody to show, so the cluster is left
 * out rather than filled with invented faces. */
function Reviewers({ reviews }: { reviews: Review[] }) {
  if (reviews.length < 2) return null;
  const shown = reviews.slice(0, 3);
  return (
    <div className="flex items-center -space-x-2.5">
      {shown.map((r, i) => (
        <span
          key={r.id ?? i}
          title={r.name}
          className="grid aspect-square w-[clamp(26px,2.6vw,34px)] place-items-center rounded-full border-2 border-white bg-accent-soft text-[10px] font-bold uppercase text-accent-deep"
        >
          {r.name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? "").join("")}
        </span>
      ))}
      <span className="grid aspect-square w-[clamp(26px,2.6vw,34px)] place-items-center rounded-full border-2 border-white bg-ink text-[10px] font-bold text-white">
        +
      </span>
    </div>
  );
}

/* The seven wall slots, in render order, with the shot and description each
 * ships with. The admin's Контент page edits these positions by index, so this
 * order is the contract between the two — slot 1 is the top of column one. */
const WALL_DEFAULTS = [
  "/hero/orange-runner.webp",
  "/hero/amber-grin.webp",
  "/hero/sage-coat.webp",
  "/hero/gold-portrait.webp",
  "/hero/blue-puffer.webp",
  "/hero/green-hearts.webp",
  "/hero/pine-jacket.webp",
] as const;

export function HeroEditorial({
  lang, reviews, cms,
}: { lang: Lang; reviews: Review[]; cms?: HomepageCms | null }) {
  const t = tFor(lang);
  const quote = reviews[0];
  // Five slim columns: ask the browser for roughly a fifth of the viewport.
  const sizes = "(max-width: 640px) 33vw, (max-width: 1280px) 19vw, 240px";

  // Everything the owner can change from the admin, resolved against the copy
  // this component ships with. A blank field keeps the default, so an untouched
  // CMS renders exactly what it rendered before any of this existed.
  const h = cms?.hero;
  const txt = (key: keyof NonNullable<typeof h>, fallbackKey: string) =>
    orDefault(h?.[key] as any, lang, t(fallbackKey as any));

  const copy = {
    ring: txt("ring", "hero.ring"),
    titleA: txt("titleA", "hero.titleA"),
    titleB: txt("titleB", "hero.titleB"),
    blurb: txt("blurb", "hero.blurb"),
    cta: txt("cta", "hero.explore"),
    ctaShort: txt("ctaShort", "hero.exploreShort"),
    ctaHref: urlOrDefault(h?.ctaHref, "/shop"),
    panelLabel: txt("panelLabel", "hero.rightLabel"),
    panelTitle: txt("panelTitle", "hero.rightTitle"),
    panelHref: urlOrDefault(h?.panelHref, "/shop"),
  };

  // slot(n) is 1-based to match the numbering the admin shows the owner.
  const slot = (n: number) =>
    heroSlot(h?.images, n - 1, lang, {
      src: WALL_DEFAULTS[n - 1],
      alt: t(`hero.alt${n}` as any),
    });
  const s1 = slot(1), s2 = slot(2), s3 = slot(3), s4 = slot(4);
  const s5 = slot(5), s6 = slot(6), s7 = slot(7);

  return (
    <section className="relative">
      <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
        <defs>
          {CLIPS.map(c => (
            <clipPath key={c.id} id={c.id} clipPathUnits="objectBoundingBox">
              <path d={c.d} />
            </clipPath>
          ))}
        </defs>
      </svg>

      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        {/* ---------- headline, with the badge and reviewers on the shoulders ---------- */}
        <div className="relative pt-[clamp(26px,7.5vw,100px)]">
          <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 sm:block">
            <RingBadge label={copy.ring} href="/shop?sort=new" />
          </div>
          <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 sm:block">
            <Reviewers reviews={reviews} />
          </div>

          <h1 className="text-balance text-center font-sans text-[clamp(32px,6.1vw,79.4px)] font-bold leading-[1.13] tracking-[-0.022em] text-ink">
            {copy.titleA}
            <br />
            {copy.titleB}
          </h1>
        </div>

        {/* ---------- the wall ---------- */}
        {/* The reference gap is 12 against 796 of content, and content is about
            (viewport - 64), so 1.42vw tracks it to within a pixel from 800 up
            to 1280 — where the clamp takes over, because the container stops
            growing but vw does not. A fixed px gap was 19% too wide on a
            narrower screen and skewed the stepped tops. */}
        <div className="mt-[clamp(10px,1vw,12px)] grid grid-cols-3 items-end gap-[clamp(6px,1.42vw,18.3px)] sm:grid-cols-5">
          {/* 1 — tab left */}
          <div className="flex flex-col gap-[clamp(6px,1.42vw,18.3px)]">
            <Card src={s1.src} alt={s1.alt} ratio={RATIO.tall} clip="xmas-tab-tall-l" sizes={sizes} priority />
            <Card src={s2.src} alt={s2.alt} ratio={RATIO.short} sizes={sizes} />
          </div>

          {/* 2 — tab left */}
          <div className="hidden sm:flex sm:flex-col">
            <Card src={s3.src} alt={s3.alt} ratio={RATIO.mid} clip="xmas-tab-mid-l" sizes={sizes} />
          </div>

          {/* 3 — plain, with the pill under it */}
          <div className="flex flex-col gap-[clamp(6px,1.42vw,18.3px)]">
            <span aria-hidden className="mx-auto -mb-1 block text-accent sm:-mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                {Array.from({ length: 12 }).map((_, i) => (
                  <line key={i} x1="12" y1="3.5" x2="12" y2="7" transform={`rotate(${i * 30} 12 12)`} />
                ))}
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            </span>
            <Card src={s4.src} alt={s4.alt} ratio={RATIO.centre} sizes={sizes} priority />
            <Link
              href={copy.ctaHref}
              className="inline-flex h-[clamp(36px,4.2vw,56px)] w-full items-center justify-center gap-1.5 rounded-pill bg-ink px-2 text-[clamp(10px,1.08vw,14px)] font-semibold text-white transition-colors hover:bg-accent"
            >
              {/* The pill is only a column wide, and on a phone a column is
                  about 105px — the full label truncates mid-word there. */}
              <span className="sm:hidden">{copy.ctaShort}</span>
              <span className="hidden truncate sm:inline">{copy.cta}</span>
              <ArrowUpRight width={13} height={13} />
            </Link>
          </div>

          {/* 4 — tab right */}
          <div className="hidden sm:flex sm:flex-col">
            <Card src={s5.src} alt={s5.alt} ratio={RATIO.mid} clip="xmas-tab-mid-r" sizes={sizes} />
          </div>

          {/* 5 — tab right */}
          <div className="flex flex-col gap-[clamp(6px,1.42vw,18.3px)]">
            <Card src={s6.src} alt={s6.alt} ratio={RATIO.tallRight} clip="xmas-tab-tall-r" sizes={sizes} priority />
            <Card src={s7.src} alt={s7.alt} ratio={RATIO.short} sizes={sizes} />
          </div>
        </div>

        {/* ---------- the strip under the wall ---------- */}
        <div className="mt-[clamp(28px,6.6vw,92px)] flex flex-col gap-8 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
          <div className="max-w-[46ch] sm:max-w-[34ch]">
            <span aria-hidden className="block font-serif text-[34px] leading-[.6] text-ink/20">&ldquo;</span>
            <p className="mt-3 text-[clamp(12px,1.1vw,14px)] leading-relaxed text-muted">
              {quote ? quote.body : copy.blurb}
            </p>
            {quote && (
              <p className="mt-2 text-[clamp(12px,1.05vw,14px)] italic text-ink/70">— {quote.name}</p>
            )}
          </div>

          <Link href={copy.panelHref} className="group block sm:max-w-[30ch]">
            <div className="flex items-baseline gap-2.5">
              <span className="font-sans text-[clamp(30px,3.9vw,49px)] font-semibold leading-none tracking-[-0.03em] text-ink">01</span>
              <span className="text-[clamp(11px,1vw,13px)] text-muted">{copy.panelLabel}</span>
              <span className="ml-auto hidden text-ink transition-transform group-hover:translate-x-1 sm:block">
                <ArrowUpRight width={18} height={18} />
              </span>
            </div>
            <p className="mt-3 text-[clamp(14px,1.8vw,23px)] font-semibold leading-snug tracking-[-0.01em] text-ink">
              {copy.panelTitle}
            </p>
          </Link>
        </div>
      </div>
    </section>
  );
}
