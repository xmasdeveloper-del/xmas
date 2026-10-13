import { LocaleLink as Link } from "@/components/LocaleLink";
import { Photo } from "@/components/Photo";
import { ArrowRight } from "@/components/Icons";
import { money } from "@/lib/api";
import { backdropFor } from "@/lib/backdrops";
import type { Product } from "@/lib/types";

/* ---------------------------------------------------------------------------
 * Four product cards in a free stagger, with the section's heading sitting in
 * the top right as the fourth element of the composition.
 *
 * Measured off the reference, whose content column is 920 wide:
 *
 *   column       width   card           top    height
 *   1            305     tall            115      432
 *   2            283     tall              8      357
 *                        + short         400      260
 *   3            280     heading          61      136
 *                        + tall          281      419
 *
 * The columns are genuinely unequal — 305 + 283 + 280 plus two 27 gaps is the
 * full 920 — so the grid keeps those proportions as fr units. Nothing is
 * bottom-aligned here, unlike the hero: each column is offset by its own
 * padding-top, given as a percentage, which CSS resolves against the column's
 * width. That makes the whole arrangement scale with the container and keeps
 * the numbers above readable in the markup.
 * ------------------------------------------------------------------------ */

/** The frosted capsule across the bottom of a card: price on the left, with the
 *  dark round button hung off the right end, taller than the capsule so it
 *  breaks the line — which is the detail that makes the reference's cards read
 *  as photographs rather than as tiles. */
function PriceBar({ price, was }: { price: number; was?: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-[11%] bottom-[7%]">
      <div className="relative flex h-[clamp(34px,5.5vw,70px)] items-center rounded-pill bg-white/55 pl-[8%] pr-[34%] shadow-[0_6px_20px_-8px_rgba(10,10,11,.35)] backdrop-blur-md">
        <span className="num-tabular truncate text-[clamp(11px,1.35vw,17px)] font-semibold text-ink">
          {money(price)}
        </span>
        {was && (
          <span className="num-tabular ml-2 hidden truncate text-[clamp(9px,1vw,13px)] text-muted line-through sm:inline">
            {money(was)}
          </span>
        )}
      </div>
      <span className="absolute right-0 top-1/2 grid aspect-square w-[clamp(44px,7.3vw,94px)] -translate-y-1/2 place-items-center rounded-full bg-ink text-white shadow-[0_10px_28px_-10px_rgba(10,10,11,.6)] transition-[background-color,transform] duration-300 group-hover:scale-105 group-hover:bg-accent">
        <ArrowRight width={18} height={18} />
      </span>
    </div>
  );
}

function TrendCard({ product, ratio, sizes, eager }: {
  product: Product;
  ratio: string;
  sizes: string;
  eager?: boolean;
}) {
  return (
    <Link
      href={`/product/${product.slug}`}
      aria-label={`${product.name} — ${money(product.price)}`}
      // The reference's ratios are a desktop composition. Below lg the cards sit
      // in a plain 2x2, where four different shapes just look unresolved — so
      // they share one portrait ratio there and take their own back at lg.
      className="group relative block w-full overflow-hidden rounded-[6%] aspect-[4/5] transition-[transform,box-shadow] duration-500 ease-elegant hover:-translate-y-1 hover:shadow-deep lg:aspect-[var(--ar)]"
      style={{
        ["--ar" as string]: ratio,
        // Our shots are cutouts, not the reference's full-bleed photography, so
        // the card supplies the setting: a generated studio plate — a bare
        // cyclorama with nothing in it — with a breath of the product's own
        // accent over it. The product on top is the real photograph.
        backgroundImage: `linear-gradient(165deg, ${product.accent}26 0%, ${product.accent}0A 60%, transparent 100%), url(${backdropFor(product.category)})`,
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
      }}
    >
      <Photo
        src={product.image}
        alt={product.name}
        sizes={sizes}
        priority={eager}
        imgClassName="object-contain p-[9%] pb-[26%] drop-shadow-[0_22px_22px_rgba(22,21,21,.16)] transition-transform duration-700 ease-elegant group-hover:scale-[1.05]"
      />
      <PriceBar price={product.price} was={product.was} />
    </Link>
  );
}

export function TrendingSection({ products, title, blurb, seeAll, seeAllHref = "/shop" }: {
  products: Product[];
  title: string;
  blurb?: string;
  seeAll: string;
  seeAllHref?: string;
}) {
  const [a, b, c, d] = products.slice(0, 4);
  if (!a || !b || !c || !d) return null;

  // Four slim cards: roughly a third of the container on a wide screen, half on
  // a phone, where the grid collapses to two columns.
  const sz = "(max-width: 1024px) 46vw, 31vw";

  return (
    <div className="grid grid-cols-2 gap-[2.93%] lg:grid-cols-[305fr_283fr_280fr]">
      {/* column 1 */}
      <div className="lg:pt-[35.1%]">
        <TrendCard product={a} ratio="305 / 432" sizes={sz} eager />
      </div>

      {/* Column 2 and column 3 are columns only at lg. Below that they are
          `display: contents`, so their cards become grid items in their own
          right and the four of them fall into a plain 2x2 under the heading —
          instead of the heading's column spanning the full width and dragging
          one card up to twice the size of the others. */}
      <div className="contents lg:flex lg:flex-col lg:gap-[12.7%]">
        <TrendCard product={b} ratio="283 / 357" sizes={sz} eager />
        <TrendCard product={c} ratio="283 / 260" sizes={sz} />
      </div>

      <div className="contents lg:block lg:pt-[18.9%]">
        <div className="order-first col-span-2 lg:order-none">
          <h2 className="font-sans text-[clamp(26px,3.3vw,42px)] font-light leading-[1.36] tracking-[-0.015em] text-ink">
            {title}
          </h2>
          {blurb && (
            <p className="mt-4 max-w-[46ch] text-[clamp(11px,1.05vw,13px)] leading-relaxed text-muted lg:max-w-none">
              {blurb}
            </p>
          )}
          <Link
            href={seeAllHref}
            className="mt-5 inline-flex items-center gap-1.5 text-[clamp(11px,1.05vw,13px)] font-semibold text-ink underline-offset-4 transition-colors hover:text-accent hover:underline"
          >
            {seeAll}
            <ArrowRight width={13} height={13} />
          </Link>
        </div>
        <div className="contents lg:block lg:mt-[30%]">
          <TrendCard product={d} ratio="280 / 419" sizes={sz} />
        </div>
      </div>
    </div>
  );
}
