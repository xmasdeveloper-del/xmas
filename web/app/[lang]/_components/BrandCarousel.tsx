"use client";
import { CoverflowCarousel } from "@/components/ui/coverflow-carousel";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { Photo } from "@/components/Photo";
import { BagIcon } from "@/components/Icons";
import { useQuickView } from "@/lib/store";
import { money } from "@/lib/api";
import { useT } from "@/components/LangProvider";
import type { Product } from "@/lib/types";

/**
 * One brand's shelf: a coverflow of full product cards.
 *
 * Sized to keep five pairs on screen at once rather than three — the shop
 * carries eight brands, and a row that shows three of them says less about
 * what is in stock than the same strip half a size down.
 *
 * Client-side because each card carries its own handlers, which a server
 * component cannot hand to the carousel.
 */
export function BrandCarousel({ products, label }: { products: Product[]; label: string }) {
  const t = useT();
  const openQuickView = useQuickView(s => s.open);
  if (!products.length) return null;

  const slides = products.map(p => {
    // Stablemates, shown as the small thumbnail strip under the photo.
    const ways = [p, ...products.filter(x => x.id !== p.id)].slice(0, 3);
    return {
      src: p.image ?? "",
      alt: p.name,
      content: (
        <div className="flex h-full flex-col p-3.5">
          <div className="flex shrink-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold leading-tight text-ink">{p.name}</h3>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink/55">{p.shortDesc || p.description}</p>
              <div className="num-tabular mt-1 text-[13.5px] font-bold text-accent">{money(p.price)}</div>
            </div>
            {p.badge && (
              <span className="shrink-0 rounded-pill bg-ink px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[.1em] text-white">
                {p.badge}
              </span>
            )}
          </div>

          <Link href={`/product/${p.slug}`} className="relative my-2 block min-h-0 flex-1">
            <Photo src={p.image} alt={p.name} sizes="(max-width:768px) 55vw, 240px" imgClassName="object-contain" />
          </Link>

          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {ways.map(w => (
                <Link
                  key={w.id}
                  href={`/product/${w.slug}`}
                  aria-label={w.name}
                  className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border bg-mist transition-colors ${
                    w.id === p.id ? "border-accent" : "border-line hover:border-ink/30"
                  }`}
                >
                  <Photo src={w.image} alt="" sizes="36px" imgClassName="object-contain p-0.5" />
                </Link>
              ))}
            </div>
            <button
              onClick={(e) => {
                // Same rule as the grid: this opens the product, it never
                // decides on the shopper's behalf what goes in the bag.
                e.preventDefault();
                openQuickView(p);
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-accent px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-accent-deep"
            >
              {t("strike.addToCart")}
              <BagIcon width={11} height={11} />
            </button>
          </div>
        </div>
      ),
    };
  });

  return (
    <CoverflowCarousel
      slides={slides}
      // Sized so five cards span the window rather than huddling in the
      // middle of it: the width follows the viewport (19vw) instead of
      // stopping at a fixed 300px, which on a wide screen left a band of
      // empty page down either side.
      cardWidth="clamp(230px, 19vw, 380px)"
      cardAspect="0.76"
      gap={0.12}
      rotate={32}
      depth={0.48}
      falloff={0.78}
      // It turns over by itself; the first drag, arrow or key stops it for
      // good, and hovering pauses it while a card is being read.
      autoplay
      interval={3400}
      showNavigation
      showPagination
      label={label}
    />
  );
}
