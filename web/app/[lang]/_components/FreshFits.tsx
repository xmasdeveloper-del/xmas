"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { Photo } from "@/components/Photo";
import { HeartIcon, ArrowRight, ChevronLeft } from "@/components/Icons";
import { useWish } from "@/lib/store";
import { money } from "@/lib/api";
import { useT } from "@/components/LangProvider";
import type { Product } from "@/lib/types";

const ease: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
const PER_PAGE = 5; // one oversized tile + a 2x2 of small ones

function Wish({ id, name, small }: { id: string; name: string; small?: boolean }) {
  const toggle = useWish(s => s.toggle);
  const has = useWish(s => s.has);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wished = mounted && has(id);
  const t = useT();
  return (
    <button
      onClick={(e) => { e.preventDefault(); toggle(id); }}
      aria-label={`${t("nav.wishlist")}: ${name}`}
      aria-pressed={wished}
      className={`grid shrink-0 place-items-center rounded-full transition-all duration-200 active:scale-90 ${
        small ? "h-8 w-8" : "h-10 w-10"
      } ${wished ? "bg-red-50 text-red-500" : "bg-accent-soft/70 text-accent hover:bg-accent-soft"}`}
    >
      <HeartIcon width={small ? 14 : 17} height={small ? 14 : 17} filled={wished} />
    </button>
  );
}

/** The spec row along the card's bottom-left: the sizes it comes in and the
 *  colourways it exists in. Bags carry no sizes, so that row simply drops. */
function Specs({ product, small }: { product: Product; small?: boolean }) {
  const sizes = (product.sizes ?? []).slice(0, 3);
  const colors = (product.colors?.length ? product.colors : [product.accent]).slice(0, 4);
  return (
    <div className="min-w-0">
      {sizes.length > 0 && (
        <div className="flex items-center gap-1.5">
          {sizes.map(s => (
            <span key={s} className={`num-tabular grid place-items-center rounded-full border border-line text-ink/70 ${
              small ? "h-5 min-w-[22px] px-1 text-[9.5px]" : "h-6 min-w-[26px] px-1.5 text-[11px]"
            }`}>{s}</span>
          ))}
        </div>
      )}
      <div className={`flex items-center gap-1.5 ${sizes.length ? (small ? "mt-1.5" : "mt-2") : ""}`}>
        {colors.map((c, i) => (
          <span key={`${c}-${i}`} className={`rounded-full ring-1 ring-ink/10 ${small ? "h-3 w-3" : "h-3.5 w-3.5"}`} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

const Go = ({ small }: { small?: boolean }) => (
  <span className={`grid shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_10px_26px_-8px_rgba(241,89,43,.65)] transition-all duration-300 ease-spring group-hover:scale-105 group-hover:bg-accent-deep ${
    small ? "h-9 w-9" : "h-14 w-14"
  }`}>
    <ArrowRight width={small ? 15 : 22} height={small ? 15 : 22} />
  </span>
);

function FitCard({ product, featured }: { product: Product; featured?: boolean }) {
  const small = !featured;
  return (
    <Link
      href={`/product/${product.slug}`}
      className={`group relative flex h-full flex-col rounded-[1.5rem] border border-line transition-[transform,box-shadow] duration-500 ease-elegant hover:-translate-y-1 hover:shadow-deep ${
        featured ? "bg-surface-2 p-5 sm:p-6" : "bg-white p-3.5 sm:p-4"
      }`}
    >
      {/* name + price, wishlist on the right */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`leading-tight text-ink transition-colors group-hover:text-accent-deep ${
            featured ? "text-[21px] font-medium sm:text-[25px]" : "line-clamp-2 text-[13px] font-semibold sm:text-[14px]"
          }`}>{product.name}</h3>
          <div className={`num-tabular font-bold text-accent ${featured ? "mt-1.5 text-[19px] sm:text-[21px]" : "mt-1 text-[13px]"}`}>
            {money(product.price)}
            {product.was && <span className="ml-1.5 text-[11px] font-medium text-muted/70 line-through">{money(product.was)}</span>}
          </div>
        </div>
        <Wish id={product.id} name={product.name} small={small} />
      </div>

      {/* the shot */}
      <div className={`relative w-full overflow-hidden ${featured ? "my-3 min-h-[300px] flex-1 sm:min-h-[380px]" : "my-2 aspect-[3/2]"}`}>
        <Photo
          src={product.image}
          alt={product.name}
          sizes={featured ? "(max-width:1024px) 90vw, 40vw" : "(max-width:1024px) 45vw, 20vw"}
          // A contact shadow is what makes the reference's shots sit on the
          // tile instead of floating on it; our cutouts have none baked in.
          imgClassName={`object-contain transition-transform duration-700 ease-elegant group-hover:scale-[1.07] ${
            featured
              ? "drop-shadow-[0_26px_26px_rgba(22,21,21,.18)]"
              : "drop-shadow-[0_14px_14px_rgba(22,21,21,.14)]"
          }`}
        />
      </div>

      {/* sizes and colourways on the left, the call to action on the right */}
      <div className="mt-auto flex items-end justify-between gap-3">
        <Specs product={product} small={small} />
        <Go small={small} />
      </div>
    </Link>
  );
}

/**
 * One oversized tile beside a 2x2 of smaller ones, paged. `reverse` flips the
 * big tile to the right so two of these rows in sequence do not read the same.
 */
export function FreshFits({ products, title, href, reverse }: {
  products: Product[]; title: string; href: string; reverse?: boolean;
}) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(products.length / PER_PAGE));
  const [page, setPage] = useState(0);
  const go = (d: number) => setPage(p => (p + d + pages) % pages);
  const slice = products.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const [hero, ...rest] = slice;
  if (!hero) return null;

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-[22px] uppercase tracking-[.01em] text-ink sm:text-[32px]">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={href} className="chip hidden sm:inline-flex">
            {t("home.exploreMore")} <ArrowRight width={13} height={13} />
          </Link>
          {pages > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label={t("common.prev")}
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-ink/40">
                <ChevronLeft width={16} height={16} />
              </button>
              <button onClick={() => go(1)} aria-label={t("common.next")}
                className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white shadow-[0_10px_26px_-8px_rgba(241,89,43,.65)] transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:bg-accent-deep">
                <ChevronLeft width={16} height={16} className="rotate-180" />
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.38, ease }}
          className="mt-6 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4"
        >
          <div className={`col-span-2 row-span-2 ${reverse ? "lg:col-start-3 lg:row-start-1" : ""}`}>
            <FitCard product={hero} featured />
          </div>
          {rest.slice(0, 4).map(p => <FitCard key={p.id} product={p} />)}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
