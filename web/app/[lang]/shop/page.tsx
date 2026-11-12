import { LocaleLink as Link } from "@/components/LocaleLink";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { ArrowRight, SearchIcon } from "@/components/Icons";
import { api } from "@/lib/api";
import { tFor, type Lang } from "@/lib/i18n";
import type { Product } from "@/lib/types";
import { TYPES, typeOf, isType, type ProductType } from "@/lib/taxonomy";
import { COLOR_FAMILIES, colorFamily } from "@/lib/colors";
import { SortSelect, ShopFilters } from "./_ShopControls";
import { ShopGrid } from "./_ShopGrid";
import { Reveal } from "@/app/[lang]/_components/Reveal";
import type { Metadata } from "next";

// Reads searchParams (filters) → dynamic; product data is still fetch-cached.
export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://xmas.mn").replace(/\/$/, "");

export function generateMetadata(
  { params, searchParams }: { params: { lang: Lang }; searchParams: { type?: string } },
): Metadata {
  const t = tFor(params.lang);
  const type = isType(searchParams.type) ? searchParams.type : undefined;
  const title = `${type ? t(`type.${type}`) : t("shop.titleAll")} — X-MAS`;
  const description = params.lang === "mn"
    ? "X-MAS дэлгүүрийн бүх бараа — Converse, UGG, The North Face. Пүүз, гутал, куртик. 100% оригинал, QPay-ээр төлнө."
    : "Browse all X-MAS products — Converse, UGG & The North Face. Sneakers, boots & down jackets. 100% authentic, pay with QPay.";
  const url = `${SITE}/${params.lang}/shop`;
  return {
    title,
    description,
    alternates: { canonical: url, languages: { mn: `${SITE}/mn/shop`, en: `${SITE}/en/shop` } },
    openGraph: { title, description, url, type: "website", siteName: "X-MAS" },
  };
}

const cats = ["all", "Converse", "Nike", "New Balance", "UGG", "The North Face", "ASICS", "Salomon", "Christian Dior"];

export default async function ShopPage({
  params,
  searchParams,
}: { params: { lang: Lang }; searchParams: { category?: string; sort?: string; q?: string; gender?: string; filter?: string; color?: string; tech?: string; minPrice?: string; maxPrice?: string; type?: string } }) {
  const t = tFor(params.lang);
  // Resilient: a catalog outage degrades to the empty state, never a 500.
  const [listRes, allForColors] = await Promise.all([
    api.products.list({
      category: searchParams.category,
      sort: searchParams.sort,
      q: searchParams.q,
      gender: searchParams.gender,
      filter: searchParams.filter,
      color: searchParams.color,
      tech: searchParams.tech,
      minPrice: searchParams.minPrice,
      maxPrice: searchParams.maxPrice,
    }).catch(() => ({ data: [] as Product[], total: 0 })),
    api.products.list({}).catch(() => ({ data: [] as Product[] })),
  ]);
  const { data: all, total: allTotal } = listRes;

  // The type axis is applied here rather than in the API layer: it is derived
  // from each product's shape, which both backends already return.
  const activeType = isType(searchParams.type) ? searchParams.type : undefined;
  const products = activeType ? all.filter(p => typeOf(p) === activeType) : all;
  const total = activeType ? products.length : allTotal;

  // Browse by type whenever nothing but a brand is selected — so "all products"
  // AND a brand page both split into Пүүз / Гутал / Куртик / Цүнх sections
  // rather than one undifferentiated grid. Any sharper filter drops to a grid.
  const activeCategory = searchParams.category && searchParams.category !== "all"
    ? searchParams.category : undefined;
  const BROWSE_SAFE = new Set(["sort", "category"]);
  const browsing = !activeType && !Object.entries(searchParams)
    .some(([k, v]) => !BROWSE_SAFE.has(k) && v);
  const sections = browsing
    ? TYPES.map(({ key }) => ({ key, items: products.filter(p => typeOf(p) === key) }))
        .filter(s => s.items.length > 0)
    : [];

  // Links keep whichever axis is already set, so the two narrow together.
  const shopHref = (next: { category?: string; type?: string }) => {
    const q = new URLSearchParams();
    const c = "category" in next ? next.category : activeCategory;
    const ty = "type" in next ? next.type : activeType;
    if (c) q.set("category", c);
    if (ty) q.set("type", ty);
    const qs = q.toString();
    return qs ? `/shop?${qs}` : "/shop";
  };
  // Colour families rather than raw accents: every product carries its own
  // accent, so "all the colours" was 166 swatches, most of them matching a
  // single item. Only the families the catalogue actually holds are offered,
  // in a fixed order, so each one is worth pressing.
  const present = new Set(
    allForColors.data.flatMap(p => [colorFamily(p.accent), ...(p.colors ?? []).map(colorFamily)])
      .filter(Boolean) as string[],
  );
  const availableColors = COLOR_FAMILIES.filter(f => present.has(f.key));

  return (
    <>
      <div className="px-3 pt-3 sm:px-4 sm:pt-4 lg:px-5 lg:pt-5 pb-2 mesh-light min-h-screen">
        <div className="max-w-[1280px] mx-auto">
          {/* Tell the nav which of its links this page is, so a brand page
              lights that brand instead of the generic Дэлгүүр. */}
          <Nav activeHref={`/${params.lang}/shop${activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : ""}`} />

          {/* Title */}
          <header className="mt-6 sm:mt-8">
            <Reveal>
              <div className="text-[11px] font-mono tracking-wider text-subtle flex items-center gap-2">
                <Link href="/" className="hover:text-ink uppercase">{t("bc.home")}</Link><span className="opacity-40">/</span>
                <span className="text-ink uppercase">{t("bc.shop")}</span><span className="opacity-40 mx-1">·</span><span>{total} {t("shop.items")}</span>
              </div>
              <h1 className="font-display text-[34px] sm:text-[52px] tracking-tight leading-[.95] uppercase mt-3">
                {activeCategory ? activeCategory : t("shop.titlePre")}{" "}
                <span className="text-accent">
                  {activeType ? t(`type.${activeType}`) : t("shop.titleAll")}
                </span>
              </h1>
            </Reveal>
          </header>

          {/* The filters stand beside the results rather than on top of them:
              a rail down the left on a desktop, a sheet behind one button on a
              phone. The brand row used to be a scrolling strip of pills above
              the grid, which left no room to say what else was being filtered. */}
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-7">
            <ShopFilters colors={availableColors} cats={cats} />

            <div className="min-w-0 flex-1">
              {/* What is on screen, and the order it is in. */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">
                  <span className="num-tabular font-semibold text-ink">{total}</span> {t("shop.items")}
                </p>
                <SortSelect/>
              </div>

              {products.length === 0 ? (
                <Reveal className="mt-6 bg-white border border-line rounded-2xl p-12 text-center">
                  <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-ink/40">
                    <SearchIcon width={26} height={26}/>
                  </span>
                  <h3 className="font-display text-[22px]">{t("shop.emptyTitle")}</h3>
                  <p className="text-muted mt-2 text-sm max-w-[320px] mx-auto">{t("shop.emptyDesc")}</p>
                  <Link href="/shop" className="btn btn-primary mt-6 inline-flex">{t("shop.reset")} <ArrowRight width={14} height={14}/></Link>
                </Reveal>
              ) : sections.length > 0 ? (
                sections.map(({ key, items }) => (
                  <TypeSection key={key} type={key} items={items} lang={params.lang} href={shopHref({ type: key })} />
                ))
              ) : (
                <ShopGrid products={products} />
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

/** Two rows of one product type, with a way through to the rest of it. */
function TypeSection({ type, items, lang, href }: { type: ProductType; items: Product[]; lang: Lang; href: string }) {
  const t = tFor(lang);
  // Two rows at the widest grid; narrower screens simply show more rows.
  const PREVIEW = 8;
  const shown = items.slice(0, PREVIEW);

  return (
    <section className="mt-10 first:mt-6">
      <Reveal className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-[22px] uppercase leading-none tracking-tight sm:text-[30px]">
            {t(`type.${type}`)}
          </h2>
          <p className="mt-1.5 text-[12.5px] text-muted">{items.length} {t("shop.items")}</p>
        </div>
        <Link href={href} className="chip shrink-0">
          {t("common.viewDetails")} <ArrowRight width={13} height={13} />
        </Link>
      </Reveal>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {shown.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
      </div>
    </section>
  );
}
