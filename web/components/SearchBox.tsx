"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SearchIcon, ArrowRight } from "./Icons";
import { Photo } from "./Photo";
import { api, money } from "@/lib/api";
import { useT, useLang } from "./LangProvider";
import type { Product } from "@/lib/types";

const SUGGESTIONS = 3;

// The catalogue is small and rarely changes, so the "popular" strip is fetched
// once per page load and shared by every SearchBox on screen.
let popularCache: Promise<Product[]> | null = null;
const popular = () =>
  (popularCache ??= api.products
    .list({})
    .then(r => r.data.slice(0, SUGGESTIONS))
    .catch(() => []));

/**
 * Nav search field with a preview dropdown: product shots and prices as you
 * type, so a shopper can jump straight to an item instead of landing on a
 * results page. Renders its own <form>, so submitting still works without JS.
 */
export function SearchBox({
  className = "",
  inputClassName = "",
  iconSize = 16,
  trailing,
  panelClassName = "",
}: {
  className?: string;
  inputClassName?: string;
  iconSize?: number;
  trailing?: React.ReactNode;
  panelClassName?: string;
}) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const listId = useId();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement | null>(null);

  // Debounced lookup. An empty field previews the popular strip instead, so the
  // dropdown has something to show the moment it opens.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    let dropped = false;
    setActive(-1);

    if (!term) {
      popular().then(p => { if (!dropped) { setItems(p); setBusy(false); } });
      return () => { dropped = true; };
    }

    setBusy(true);
    const id = window.setTimeout(() => {
      api.products
        .list({ q: term })
        .then(r => { if (!dropped) setItems(r.data.slice(0, SUGGESTIONS)); })
        .catch(() => { if (!dropped) setItems([]); })
        .finally(() => { if (!dropped) setBusy(false); });
    }, 220);

    return () => { dropped = true; window.clearTimeout(id); };
  }, [q, open]);

  // Close on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const hit = items[active];
    if (hit) return go(`/${lang}/product/${hit.slug}`);
    const term = q.trim();
    go(term ? `/${lang}/shop?q=${encodeURIComponent(term)}` : `/${lang}/shop`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(i => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(i => (i <= 0 ? items.length : i) - 1);
    }
  }

  const term = q.trim();

  return (
    <div ref={box} className="relative">
      <form onSubmit={submit} className={className} role="search">
        <button type="submit" className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-subtle transition hover:text-ink active:scale-90" aria-label={t("nav.search")}>
          <SearchIcon width={iconSize} height={iconSize} />
        </button>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label={t("nav.search")}
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          data-search-input
          className={inputClassName}
          placeholder={t("nav.searchShort")}
        />
        {trailing}
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            id={listId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            className={`absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[1.25rem] border border-line bg-white shadow-[0_24px_60px_-24px_rgba(22,21,21,.45)] ${panelClassName}`}
          >
            <p className="px-4 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[.14em] text-subtle">
              {term ? t("nav.searchResults") : t("nav.searchSuggest")}
            </p>

            {busy && items.length === 0 ? (
              <div className="space-y-1 px-2 pb-2 pt-2">
                {Array.from({ length: SUGGESTIONS }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-surface-2" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3 w-3/5 animate-pulse rounded bg-surface-2" />
                      <div className="h-3 w-1/4 animate-pulse rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-5 text-center text-[13px] text-muted">{t("nav.searchNone")}</p>
            ) : (
              <ul className="px-2 pb-1 pt-2">
                {items.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(`/${lang}/product/${p.slug}`)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                        active === i ? "bg-surface-2" : "hover:bg-surface-2"
                      }`}
                    >
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                        <Photo src={p.image} alt="" sizes="48px" imgClassName="object-contain p-1" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                        <span className="block truncate text-[11.5px] text-subtle">{p.category}</span>
                      </span>
                      <span className="num-tabular shrink-0 text-[13px] font-bold text-accent">{money(p.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => go(term ? `/${lang}/shop?q=${encodeURIComponent(term)}` : `/${lang}/shop`)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-surface-2 hover:text-accent-deep"
            >
              {t("nav.searchAll")} <ArrowRight width={13} height={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
