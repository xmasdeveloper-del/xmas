import { LocaleLink as Link } from "@/components/LocaleLink";
import { Photo } from "@/components/Photo";
import { ArrowUpRight } from "@/components/Icons";
import type { CmsPromo } from "@/lib/medusa";
import { cmsText, urlOrDefault } from "@/lib/cms-text";
import type { Lang } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
 * The promotional band, driven entirely from the admin's Контент page.
 *
 * Unlike the hero, this has no built-in copy to fall back on: it exists only
 * when the owner has switched it on AND written a headline, which is why it
 * returns null rather than rendering an empty shell. The switch alone used to
 * be the only thing the admin could set that had no effect anywhere — there was
 * no component to receive it.
 *
 * The image is optional. Without one the band is a full-width text panel; with
 * one it splits, picture on the right so the headline still leads on a phone.
 * ------------------------------------------------------------------------ */

export function PromoBanner({ promo, lang }: { promo?: CmsPromo | null; lang: Lang }) {
  if (!promo?.enabled) return null;

  const title = cmsText(promo.title, lang);
  if (!title) return null; // switched on but nothing written yet

  const kicker = cmsText(promo.kicker, lang);
  const desc = cmsText(promo.desc, lang);
  const cta = cmsText(promo.cta, lang);
  const href = urlOrDefault(promo.href, "/shop");
  const img = typeof promo.img === "string" ? promo.img.trim() : "";

  return (
    <section className="border-y border-line bg-accent-soft">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <div className="flex flex-col items-start gap-8 py-12 sm:py-16 md:flex-row md:items-center md:gap-14">
          <div className="min-w-0 flex-1">
            {kicker && (
              <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-accent-deep">
                {kicker}
              </span>
            )}
            <h2 className="mt-3 text-balance font-sans text-[clamp(24px,3.4vw,42px)] font-bold leading-[1.14] tracking-[-0.02em] text-ink">
              {title}
            </h2>
            {desc && (
              <p className="mt-4 max-w-[52ch] text-[clamp(13px,1.1vw,15px)] leading-relaxed text-muted">
                {desc}
              </p>
            )}
            {/* With no label the whole band is still clickable through the
                headline link below, so the band never becomes a dead end. */}
            <Link
              href={href}
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-pill bg-ink px-7 text-[13px] font-semibold text-white transition-colors hover:bg-accent"
            >
              {cta || title}
              <ArrowUpRight width={14} height={14} />
            </Link>
          </div>

          {img && (
            <Link
              href={href}
              aria-hidden
              tabIndex={-1}
              className="relative w-full shrink-0 overflow-hidden rounded-[18px] bg-surface-2 md:w-[44%]"
              style={{ aspectRatio: "16 / 10" }}
            >
              <Photo
                src={img}
                alt=""
                sizes="(max-width: 768px) 100vw, 44vw"
                imgClassName="object-cover"
              />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
