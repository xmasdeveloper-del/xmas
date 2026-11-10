import { LocaleLink as Link } from "@/components/LocaleLink";
import { ClothingRailHero, type RailGarment } from "@/components/ui/product-rail-gallery";
import { orDefault, urlOrDefault } from "@/lib/cms-text";
import type { HomepageCms } from "@/lib/medusa";
import type { Product } from "@/lib/types";
import { money } from "@/lib/api";
import { railShotsFor } from "@/lib/hero-side-shots";
import { tFor, type Lang } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
 * The hero as a clothing rail you can handle: the shop's own outerwear hanging
 * in a row, one piece turned to the front at a time.
 *
 * It is fed from the live catalogue rather than a fixed list, so the rail is
 * never showing something the shop has stopped selling. Every product photo
 * here is a transparent cut-out on a plain canvas, which is exactly what this
 * component needs — anything with its own background would read as a floating
 * rectangle instead of a hanging pair.
 *
 * `hanger="none"` because these cut-outs are shot flat, with no hanger of
 * their own and no shoulders for a drawn one to sit on. Without it the photo
 * simply hangs from the rail, which is the look the demo uses too.
 *
 * Copy comes from the same CMS fields as the editorial hero, so whatever the
 * owner typed on the Контент page still rules — and a blank field still keeps
 * the shipped wording.
 * ------------------------------------------------------------------------ */

// Past about ten the rail turns into slivers too thin to read, and every extra
// piece is another full-size image the visitor downloads before anything moves.
const MAX_ON_RAIL = 9;

export function HeroRail({
  products,
  lang,
  cms,
}: {
  products: Product[];
  lang: Lang;
  cms?: HomepageCms | null;
}) {
  const t = tFor(lang);
  const h = cms?.hero;
  const txt = (key: keyof NonNullable<typeof h>, fallbackKey: string) =>
    orDefault(h?.[key] as any, lang, t(fallbackKey as any));

  const heading = [txt("titleA", "hero.titleA"), txt("titleB", "hero.titleB")]
    .filter(Boolean)
    .join(" ");
  const ctaHref = urlOrDefault(h?.ctaHref, "/shop");

  // A piece with no photo would hang as an empty hook, so it never reaches the
  // rail. `shortDesc` is the one-liner the cards use; the detail view shows it
  // under the name when a visitor lifts the piece off.
  const items: RailGarment[] = products
    .filter((p) => !!p.image)
    .slice(0, MAX_ON_RAIL)
    .map((p) => ({
      id: p.slug,
      name: p.name,
      description: p.shortDesc,
      // The rail copies, not the catalogue photos: they share one canvas shape,
      // which is what makes every piece hang the same height and keep it while
      // turning. `sideImage` is what lets it hang in profile at all — without
      // one the rail turns the front shot away, a bare sliver for a cut-out.
      ...railShotsFor(p.slug, p.image),
      tag: money(p.price),
      color: p.accent,
      details: [p.category, p.fabric, ...p.sizes.slice(0, 3)].filter(Boolean),
    }));

  // Nothing to hang (the catalogue call failed, or the shop carries no
  // outerwear yet) — render nothing rather than an empty rail with a caption.
  if (items.length === 0) return null;

  return (
    <ClothingRailHero
      items={items}
      hanger="none"
      autoplay
      eyebrow={txt("ring", "hero.ring")}
      heading={heading}
      caption={txt("blurb", "hero.blurb")}
      labels={{
        front: t("rail.front" as any),
        back: t("rail.back" as any),
        close: t("rail.close" as any),
        show: t("rail.show" as any),
      }}
      action={
        <Link href={ctaHref} className="pill-cta">
          {txt("cta", "hero.explore")}
        </Link>
      }
    />
  );
}
