import { LocaleLink as Link } from "@/components/LocaleLink";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Photo } from "@/components/Photo";
import type { Product } from "@/lib/types";
import { api } from "@/lib/api";
import { Reveal } from "./_components/Reveal";
import { Parallax } from "./_components/Parallax";
import { ScrollProgress } from "./_components/ScrollProgress";
import { FreshFits } from "./_components/FreshFits";
import { JacketCarousel } from "./_components/JacketCarousel";
import { BrandMarquee } from "./_components/BrandMarquee";
import { HeroEditorial } from "./_components/HeroEditorial";
import { TrendingSection } from "./_components/TrendingSection";
import { Testimonials3D } from "./_components/Testimonials3D";
import { tFor, type Lang } from "@/lib/i18n";

export const revalidate = 300;

// The wall loops each column, so one or two reviews read as the same card
// repeated. Below this it stays hidden and the page simply has no wall.
const MIN_WALL = 3;
const wrap = "mx-auto max-w-[1280px] px-5 sm:px-8";

export default async function HomePage({ params }: { params: { lang: Lang } }) {
  const t = tFor(params.lang);
  const [res, testimonials] = await Promise.all([
    api.products.list({}).catch(() => ({ data: [] as Product[] })),
    api.reviews.latest(12),
  ]);
  const all = res.data;

  // Every product is a transparent cutout, so the whole catalogue reads
  // cleanly on the white canvas; the landing page is still sneaker-led.
  const cutouts = all;
  const sneakers = cutouts.filter(p =>
    p.category === "Converse" || p.category === "New Balance" || p.shape === "sneaker");
  const pool = sneakers.length >= 4 ? sneakers : cutouts;

  const bySlug = (...slugs: string[]) => slugs.map(s => pool.find(p => p.slug === s)).find(Boolean);
  const nth = (i: number) => pool[i % Math.max(pool.length, 1)];

  // The hero tile is the tallest frame on the page, so it wants a shot that is
  // nearly as tall as it is wide — the flat side-profile cutouts letterbox there.
  // `lead` floats the chosen shot to the front of a row, leaving the rest intact.
  const HERO_MEN = "converse-chuck70-hi-black";
  const HERO_WOMEN = "converse-chuck-low-black-stars";
  const lead = (list: Product[], slug: string) => {
    const i = list.findIndex(p => p.slug === slug);
    return i < 1 ? list : [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
  };

  const men = lead(pool.filter(p => p.gender === "Men" || p.gender === "Unisex"), HERO_MEN);
  const women = lead(pool.filter(p => p.gender === "Women" || p.gender === "Unisex"), HERO_WOMEN);

  const jackets = cutouts.filter(p => p.category === "The North Face").slice(0, 12);
  const uggs = cutouts.filter(p => p.category === "UGG").slice(0, 15);

  // A high-top reads as ankle support, which is what this band's copy claims;
  // the previous pick was an awkwardly angled pair.
  const bandA = bySlug("converse-retro-trainer-burgundy", "converse-suede-low-black") ?? nth(3);
  const bandB = bySlug("converse-star-player-burgundy", "ugg-lowmel-sneaker-chestnut") ?? nth(4);

  const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://xmas.mn").replace(/\/$/, "");
  const structuredData = [
    { "@context": "https://schema.org", "@type": "Organization", name: "X-MAS", url: SITE, logo: `${SITE}/icon.png` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <ScrollProgress />

      <div className="min-h-screen bg-white">
        <Nav />

        {/* ===================== HERO ===================== */}
        <HeroEditorial lang={params.lang} reviews={testimonials} />

        {/* ============ TRUSTED BY — scrolling brand marquee ============ */}
        <section className="border-y border-line bg-white py-10 sm:py-14">
          <div className={wrap}>
            <h2 className="text-center font-display text-[20px] font-bold uppercase tracking-[.02em] text-ink sm:text-[30px]">
              {t("home.trusted")}
            </h2>
          </div>
          <div className="mt-7"><BrandMarquee /></div>
        </section>

        {/* ===================== THE UPGRADES ===================== */}
        <section className={`${wrap} py-16 sm:py-24`}>
          <Reveal><h2 className="h-strike text-center text-ink">{t("strike.upgrades")}</h2></Reveal>

          {/* jacket coverflow */}
          <div className="mt-10 sm:mt-12">
            <JacketCarousel products={jackets} label={t("strike.upgrades")} />
          </div>
        </section>

        {/* ===================== FRESH FITS — bento rows per gender ===================== */}
        <section className="border-t border-line">
          <div className={`${wrap} py-16 sm:py-20`}>
            <Reveal blur>
              <FreshFits products={men} title={t("strike.freshMen")} href="/shop?gender=Men" />
            </Reveal>
          </div>
        </section>

        <section className="border-t border-line">
          <div className={`${wrap} py-16 sm:py-20`}>
            <Reveal blur>
              <FreshFits products={women} title={t("strike.freshWomen")} href="/shop?gender=Women" reverse />
            </Reveal>
          </div>
        </section>

        {/* ===================== TRENDING (seasonal UGG) ===================== */}
        {uggs.length > 0 && (
          <section className="border-t border-line">
            <div className={`${wrap} py-16 sm:py-24`}>
              <Reveal blur>
                <TrendingSection
                  products={uggs}
                  title={t("home.trending")}
                  blurb={t("home.trendingBlurb")}
                  seeAll={t("common.seeAll")}
                  seeAllHref="/shop?category=UGG"
                />
              </Reveal>
            </div>
          </section>
        )}

        {/* ===================== STAMP OF APPROVAL ===================== */}
        <section className="bg-ink text-white">
          <div className={`${wrap} py-16 text-center sm:py-24`}>
            <Reveal>
              <h2 className="h-strike-2 text-white">{t("strike.stamp")}</h2>
              <p className="mt-3 text-[11.5px] font-semibold uppercase tracking-[.22em] text-accent">{t("strike.stampSub")}</p>
            </Reveal>
            <Reveal blur delay={0.08}>
              {/* A statement about the shop, not a quote from anyone — real
                  customer reviews have their own section further down. */}
              <p className="mx-auto mt-9 max-w-[720px] font-strike text-[24px] italic uppercase leading-tight sm:text-[34px]">
                {t("strike.quote")}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ===================== FEATURE BANDS ===================== */}
        <FeatureBand img={bandA?.image} title={t("strike.f1t")} desc={t("strike.f1d")} cta={t("strike.shopNow")} href="/shop" />
        <FeatureBand img={bandB?.image} title={t("strike.f2t")} desc={t("strike.f2d")} cta={t("strike.shopNow")} href="/shop?filter=new" reverse />

        {/* ===================== COMMUNITY — real customer reviews ===================== */}
        {testimonials.length >= MIN_WALL && (
          <section className="border-t border-line py-16 sm:py-24">
            <div className={wrap}>
              <Reveal>
                <h2 className="h-strike-2 text-center text-ink">{t("home.community")}</h2>
                <p className="mx-auto mt-3 max-w-[460px] text-center text-[14px] text-muted">{t("rev.wallDesc")}</p>
              </Reveal>
            </div>
            <div className="mt-10"><Testimonials3D reviews={testimonials} /></div>
          </section>
        )}
      </div>

      <Footer />
    </>
  );
}

/* ---------- helpers ---------- */

function FeatureBand({ img, title, desc, cta, href, reverse }: {
  img?: string; title: string; desc: string; cta: string; href: string; reverse?: boolean;
}) {
  return (
    <section className="border-t border-line">
      <div className={`${wrap} grid grid-cols-1 items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-14`}>
        <Reveal blur className={reverse ? "lg:order-2" : ""}>
          <div className="relative aspect-[3/2] overflow-hidden rounded-[1.75rem] bg-mist">
            <Parallax amount={16} className="relative block h-full w-full">
              <Photo src={img} alt={title} sizes="(max-width:1024px) 92vw, 46vw"
                imgClassName="object-contain p-3 drop-shadow-[0_28px_32px_rgba(22,21,21,.22)]" />
            </Parallax>
          </div>
        </Reveal>
        <Reveal delay={0.08} className={reverse ? "lg:order-1" : ""}>
          <h2 className="h-strike-2 text-ink">{title}</h2>
          <p className="mt-4 max-w-[460px] text-[14px] leading-relaxed text-ink/65">{desc}</p>
          <Link href={href} className="pill-cta mt-8">{cta}</Link>
        </Reveal>
      </div>
    </section>
  );
}
