"use client";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ArrowRight } from "@/components/Icons";
import { useT } from "@/components/LangProvider";
import type { Product } from "@/lib/types";

const PAGE = 24;

/**
 * The filtered grid, revealed a page at a time.
 *
 * Rendering the whole set at once meant a brand or type page mounted 50–90
 * cards, and every card that scrolled into view paid a fresh image transcode.
 * The data is already on the client, so paging is a slice — no extra request,
 * and the first screen stays server-rendered.
 */
export function ShopGrid({ products }: { products: Product[] }) {
  const t = useT();
  const [shown, setShown] = useState(PAGE);

  // A new filter is a new list; start from the top again.
  useEffect(() => { setShown(PAGE); }, [products]);

  const visible = products.slice(0, shown);
  const left = products.length - visible.length;

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {visible.map((p, i) => <ProductCard key={p.id} product={p} index={i % PAGE} />)}
      </div>

      {left > 0 && (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={() => setShown(s => s + PAGE)} className="pill-cta gap-2">
            {t("shop.loadMore")}
            <span className="num-tabular opacity-70">({left})</span>
            <ArrowRight width={14} height={14} />
          </button>
        </div>
      )}
    </>
  );
}
