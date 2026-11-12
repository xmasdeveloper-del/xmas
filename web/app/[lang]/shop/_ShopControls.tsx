"use client";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";
import { TYPES } from "@/lib/taxonomy";

// Values match Product.fabric (the sneaker silhouette type) — filtered in medusa.list.
const TECH_TAGS = [
  ["Lifestyle", "shop.tLifestyle"], ["Running", "shop.tRunning"],
  ["Skate", "shop.tSkate"], ["Canvas", "shop.tCanvas"],
] as const;

// The catalogue carries about a hundred distinct accents. All of them at once
// is a wall of dots nobody reads, so the column shows a sensible first screen
// and opens the rest on request.
const COLORS_SHOWN = 24;

// Build a new URL from the current params, setting (or clearing) the given keys.
function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
}

export function SortSelect() {
  const sp = useSearchParams();
  const t = useT();
  const setParams = useSetParams();
  return (
    <select
      value={sp.get("sort") ?? ""}
      onChange={(e) => setParams({ sort: e.target.value || null })}
      aria-label={t("shop.sort")}
      className="h-10 cursor-pointer rounded-pill border border-line bg-white pl-4 pr-2 text-[13px] font-medium outline-none"
    >
      <option value="">{t("shop.sort")}</option>
      <option value="new">{t("shop.sortNew")}</option>
      <option value="price-asc">{t("shop.sortPriceAsc")}</option>
      <option value="price-desc">{t("shop.sortPriceDesc")}</option>
      <option value="rating">{t("shop.sortRating")}</option>
    </select>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-[.12em] text-subtle">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/** One line in a filter list — the column's unit, as on any shop with a rail. */
function Row({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-lg px-2.5 py-[7px] text-[13.5px] leading-tight transition-colors ${
        active ? "bg-ink font-semibold text-white" : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * The shop's filter column.
 *
 * It used to be a drawer that dropped out of the top of the page and pushed
 * every product below the fold — a hundred colour dots wide and nothing to say
 * which brand you were in. It is a rail down the left now, in view while you
 * browse, and a sheet on a phone where there is no room for one.
 */
export function ShopFilters({ colors = [], cats = [] }: { colors?: string[]; cats?: string[] }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const t = useT();
  const setParams = useSetParams();

  const activeCategory = sp.get("category");
  const activeType = sp.get("type");
  const activeColor = sp.get("color");
  const activeTech = sp.get("tech");
  const minParam = sp.get("minPrice") ?? "";
  const maxParam = sp.get("maxPrice") ?? "";
  const filtersActive = !!(activeCategory || activeType || activeColor || activeTech || minParam || maxParam);

  const [min, setMin] = useState(minParam);
  const [max, setMax] = useState(maxParam);
  const [allColors, setAllColors] = useState(false);
  const [sheet, setSheet] = useState(false);

  // The URL is the source of truth: arriving on a filtered link, or going back,
  // must not leave the two boxes showing the previous numbers.
  useEffect(() => { setMin(minParam); setMax(maxParam); }, [minParam, maxParam]);

  // A sheet that stays open over the results it just changed is in the way.
  useEffect(() => { setSheet(false); }, [sp]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [sheet]);

  const hrefWith = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const shownColors = allColors ? colors : colors.slice(0, COLORS_SHOWN);

  const panel = (
    <div className="flex flex-col gap-4">
      {cats.length > 0 && (
        <Section title={t("shop.fBrand")}>
          <div className="flex flex-col gap-0.5">
            {cats.map(c => {
              const all = c === "all";
              const active = all ? !activeCategory : activeCategory === c;
              return (
                <Row key={c} href={hrefWith({ category: all ? null : c })} active={active}>
                  {t(`cat.${c}` as any)}
                </Row>
              );
            })}
          </div>
        </Section>
      )}

      <Section title={t("shop.fCategory")}>
        <div className="flex flex-col gap-0.5">
          <Row href={hrefWith({ type: null })} active={!activeType}>{t("shop.allTypes")}</Row>
          {TYPES.map(({ key }) => (
            <Row key={key} href={hrefWith({ type: key })} active={activeType === key}>
              {t(`type.${key}` as any)}
            </Row>
          ))}
        </div>
      </Section>

      <Section title={t("shop.fPrice")}>
        <div className="flex items-center gap-1.5">
          <input
            value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
            placeholder={t("shop.min")}
            className="h-9 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] outline-none focus:border-ink"
          />
          <span className="text-subtle">—</span>
          <input
            value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
            placeholder={t("shop.max")}
            className="h-9 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] outline-none focus:border-ink"
          />
        </div>
        <button
          onClick={() => setParams({ minPrice: min || null, maxPrice: max || null })}
          className="mt-2 h-9 w-full rounded-lg bg-surface-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-line"
        >
          {t("common.apply")}
        </button>
      </Section>

      {colors.length > 0 && (
        <Section title={t("common.colour")}>
          <div className="flex flex-wrap gap-1.5">
            {shownColors.map(c => {
              const on = activeColor?.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c} onClick={() => setParams({ color: on ? null : c })}
                  aria-label={c} aria-pressed={on}
                  className="h-7 w-7 rounded-full border-2 border-white transition hover:scale-110"
                  style={{ background: c, boxShadow: on ? "0 0 0 2px #0E0F10" : "0 0 0 1px rgba(14,15,16,.12)" }}
                />
              );
            })}
          </div>
          {colors.length > COLORS_SHOWN && (
            <button
              onClick={() => setAllColors(v => !v)}
              className="mt-2 text-[12px] font-semibold text-accent hover:underline"
            >
              {allColors ? t("shop.showLess") : `${t("shop.showAll")} (${colors.length})`}
            </button>
          )}
        </Section>
      )}

      <Section title={t("shop.fTech")}>
        <div className="flex flex-wrap gap-1.5">
          {TECH_TAGS.map(([val, key]) => {
            const on = activeTech === val;
            return (
              <button
                key={val} onClick={() => setParams({ tech: on ? null : val })} aria-pressed={on}
                className={`inline-flex h-8 items-center rounded-pill px-3 text-[12px] transition ${
                  on ? "bg-ink text-white" : "bg-surface-2 text-muted hover:text-ink"
                }`}
              >{t(key)}</button>
            );
          })}
        </div>
      </Section>
    </div>
  );

  const heading = (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="font-display text-[15px] uppercase tracking-tight">{t("shop.filters")}</h2>
      {filtersActive && (
        <Link href={pathname} className="text-[12px] font-semibold text-accent hover:underline">
          {t("shop.reset")}
        </Link>
      )}
    </div>
  );

  return (
    <>
      {/* Phone: one button, and the same column as a sheet. */}
      <button
        type="button"
        onClick={() => setSheet(true)}
        className="inline-flex h-10 items-center gap-2 self-start rounded-pill border border-line bg-white px-4 text-[13px] font-semibold text-ink shadow-soft lg:hidden"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
        {t("shop.filters")}
        {filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-accent"/>}
      </button>

      {/* Desktop: the rail, which stays with you down the page. */}
      <aside className="hidden lg:block lg:w-[236px] lg:shrink-0">
        <div className="sticky top-[88px] max-h-[calc(100vh-110px)] overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-soft">
          {heading}
          <div className="mt-4">{panel}</div>
        </div>
      </aside>

      {sheet && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label={t("shop.filters")}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setSheet(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(340px,88vw)] flex-col bg-white shadow-deep">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              {heading}
              <button
                type="button" onClick={() => setSheet(false)} aria-label={t("common.close")}
                className="ml-3 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xl leading-none"
              >×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{panel}</div>
          </div>
        </div>
      )}
    </>
  );
}
