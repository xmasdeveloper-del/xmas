"use client";
import { CoverflowCarousel } from "@/components/ui/coverflow-carousel";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { Photo } from "@/components/Photo";
import { BagIcon } from "@/components/Icons";
import { useCart, useToast, flyToCart } from "@/lib/store";
import { money } from "@/lib/api";
import { useT } from "@/components/LangProvider";
import type { Product } from "@/lib/types";

/**
 * Coverflow of full product cards (name · blurb · price · colourways · cart).
 * Lives in a client component because each card carries its own handlers, which
 * cannot be handed to the carousel from a server component.
 */
export function JacketCarousel({ products, label }: { products: Product[]; label: string }) {
  const t = useT();
  const add = useCart(s => s.add);
  const showToast = useToast(s => s.show);
  if (!products.length) return null;

  const slides = products.map(p => {
    // Sibling colourways, shown as the small thumbnail strip on the reference.
    const ways = [p, ...products.filter(x => x.id !== p.id)].slice(0, 3);
    return {
    src: p.image ?? "",
    alt: p.name,
    content: (
      <div className="flex h-full flex-col p-4">
        <div className="flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-semibold leading-tight text-ink">{p.name}</h3>
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink/55">{p.shortDesc || p.description}</p>
            <div className="num-tabular mt-1.5 text-[14px] font-bold text-accent">{money(p.price)}</div>
          </div>
          {p.badge && (
            <span className="shrink-0 rounded-pill bg-ink px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[.1em] text-white">
              {p.badge}
            </span>
          )}
        </div>

        <Link href={`/product/${p.slug}`} className="relative my-2 block min-h-0 flex-1">
          <Photo src={p.image} alt={p.name} sizes="(max-width:768px) 60vw, 300px" imgClassName="object-contain" />
        </Link>

        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {ways.map(w => (
              <Link
                key={w.id}
                href={`/product/${w.slug}`}
                aria-label={w.name}
                className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-mist transition-colors ${
                  w.id === p.id ? "border-accent" : "border-line hover:border-ink/30"
                }`}
              >
                <Photo src={w.image} alt="" sizes="40px" imgClassName="object-contain p-0.5" />
              </Link>
            ))}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              add(p);
              flyToCart(e.currentTarget, p.accent);
              showToast(`${p.name} · ${t("strike.addToCart")}`);
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-accent px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            {t("strike.addToCart")}
            <BagIcon width={12} height={12} />
          </button>
        </div>
      </div>
      ),
    };
  });

  return (
    <CoverflowCarousel
      slides={slides}
      cardWidth="clamp(286px, 33vw, 410px)"
      cardAspect="0.82"
      gap={0.2}
      rotate={38}
      depth={0.55}
      showNavigation
      showPagination
      label={label}
    />
  );
}
