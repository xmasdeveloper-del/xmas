"use client";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BagIcon, UserIcon, HeartIcon } from "./Icons";
import { SearchBox } from "./SearchBox";
import { useAuth, useCart, useWish, useUI } from "@/lib/store";
import { useT, useLang } from "./LangProvider";
import { LangToggle } from "./LangToggle";

function Sliders({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>
    </svg>
  );
}

// The shop links, in the order they sit in the pill. Kept out of the component
// so the labels, the hrefs and the index the pill reports can never drift.
const NAV_LINKS: [href: string, key: string][] = [
  ["/shop", "nav.shop"],
  ["/shop?category=Converse", "cat.Converse"],
  ["/shop?category=Nike", "cat.Nike"],
  ["/shop?category=UGG", "cat.UGG"],
  ["/shop?category=The%20North%20Face", "cat.The North Face"],
];

// The pill hands back an index, not an href, so the locale prefix LocaleLink
// would normally add has to be put on by hand before pushing.
function localePath(href: string, lang: string) {
  return href.startsWith(`/${lang}`) ? href : `/${lang}${href}`;
}

// Small circular icon button that carries an animated count badge (shared by the
// wishlist + cart controls).
function CountBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 14 }}
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold grid place-items-center border-2 border-white num-tabular"
        >{count}</motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * `activeHref` lets a page say which nav link it IS, query and all — the shop
 * passes "/mn/shop?category=UGG" so the brand lights up rather than Дэлгүүр.
 * The nav cannot work that out for itself: reading the query here means
 * useSearchParams, and that would drop every page carrying this nav out of
 * static rendering for the sake of one highlight.
 */
export function Nav({ activeHref }: { activeHref?: string } = {}) {
  const pathname = usePathname();
  const items = useCart(s => s.items);
  const wishIds = useWish(s => s.ids);
  const user = useAuth(s => s.user);
  const openCart = useUI(s => s.openCart);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? items.reduce((a, b) => a + b.qty, 0) : 0;
  const wishCount = mounted ? wishIds.length : 0;
  const t = useT();
  const lang = useLang();
  // Which link the water sits under on arrival. Read from the path only —
  // useSearchParams would force every page that renders the nav to opt out of
  // static rendering, so a deep link straight to ?category=Nike starts the
  // drop on Дэлгүүр and moves the moment anything is picked.
  // -1 when this page is none of them. It used to be Math.max(0, …), which
  // turned "no match" into "the first one", so the homepage and every product
  // page opened with Дэлгүүр lit as though that were where you are.
  const here = activeHref ?? pathname;
  const activeLink = NAV_LINKS.findIndex(([h]) => localePath(h, lang) === here);

  // Keyboard: Cmd/Ctrl+K or "/" focuses the visible search input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const cmdK = k === "k" && (e.metaKey || e.ctrlKey);
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (cmdK || (e.key === "/" && !typing)) {
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-search-input]"));
        const visible = inputs.find(i => i.offsetParent !== null) ?? inputs[0];
        if (visible) { e.preventDefault(); visible.focus(); visible.select(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const iconBtn = "liquid-chip relative w-11 h-11 rounded-full grid place-items-center text-ink hover:-translate-y-px active:scale-90 transition-all duration-200 ease-elegant";

  const Wish = (
    <Link href="/wishlist" aria-label={t("nav.wishlist")} className={iconBtn}>
      <HeartIcon width={18} height={18} filled={wishCount > 0}/>
      <CountBadge count={wishCount}/>
    </Link>
  );
  const Bag = (
    <button onClick={openCart} data-cart-anchor className={iconBtn} aria-label={t("nav.cart")}>
      <BagIcon width={18} height={18}/>
      <CountBadge count={count}/>
    </button>
  );

  return (
    <div className="sticky top-0 z-40 px-3 sm:px-4 lg:px-5 pt-3 pb-1">
     <div className="liquid-glass mx-auto max-w-[1280px] rounded-[1.75rem] px-3 sm:px-4 py-2">
      {/* ---------- Mobile bar ---------- */}
      <div className="lg:hidden flex items-center gap-2">
        <Link href="/" aria-label="X-MAS" className="-mx-1 shrink-0 px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="X-MAS" className="h-10 w-auto object-contain" />
        </Link>
        <div className="min-w-0 flex-1">
          <SearchBox
            iconSize={17}
            className="flex h-11 items-center gap-2.5 rounded-pill border border-white/60 bg-white/70 px-4 shadow-soft backdrop-blur transition focus-within:bg-white"
            inputClassName="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle"
            trailing={
              <Link href="/shop" className="-mr-2 grid h-11 w-9 shrink-0 place-items-center text-subtle transition hover:text-ink" aria-label={t("shop.filters")}><Sliders size={18}/></Link>
            }
          />
        </div>
        {Wish}
        {Bag}
      </div>

      {/* ---------- Desktop bar — floating glass pill ----------
          3-column grid (links · centered logo · controls) so the centered logo
          always has reserved space and can never be overlapped by the side
          content. Secondary links, search width and the account name scale down
          between lg and xl so nothing ever collides at tighter widths. */}
      <nav className="hidden lg:flex items-center gap-4 xl:gap-5 pl-4 pr-3 py-0.5">
        <Link href="/" aria-label="X-MAS" className="group flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="X-MAS" className="h-14 xl:h-16 w-auto object-contain transition-transform duration-300 ease-spring group-hover:scale-105" />
        </Link>

        {/* Plain links. These were a pill of water with a drop that slid
            between them — a WebGL canvas, a physics loop and a ripple on every
            tap, for a row of five words. It never settled: the drop sat under
            the wrong item, took a frame to catch up with the page, and needed
            a click handler on a wrapper to navigate at all. Five links that
            look like links do the job, and do it the same way every time.

            Below xl they would crowd the search and the account button off the
            bar, so the single Дэлгүүр link carries that width on its own. */}
        <div className="hidden min-w-0 items-center gap-0.5 xl:flex">
          {NAV_LINKS.map(([href, key], i) => {
            const here = i === activeLink;
            return (
              <Link
                key={href}
                href={href}
                aria-current={here ? "page" : undefined}
                prefetch
                className={`whitespace-nowrap rounded-pill px-4 py-2.5 text-[13.5px] leading-none transition-colors ${
                  here ? "bg-ink font-semibold text-white" : "text-muted hover:bg-white/70 hover:text-ink"
                }`}
              >
                {t(key)}
              </Link>
            );
          })}
        </div>
        <Link
          href="/shop"
          // pathname is locale-prefixed ("/mn/shop"), so the old
          // `pathname === "/shop"` was a comparison that could never be true.
          aria-current={activeLink === 0 ? "page" : undefined}
          className={`relative whitespace-nowrap text-[12px] uppercase tracking-[.12em] font-medium transition-colors xl:hidden ${activeLink === 0 ? "text-ink" : "text-muted hover:text-ink"}`}
        >{t("nav.shop")}</Link>

        <div className="ml-auto flex items-center gap-2 xl:gap-2.5">
          <SearchBox
            className="flex w-[132px] items-center gap-2.5 rounded-pill border border-transparent bg-surface-2 px-4 py-2.5 transition-all duration-300 focus-within:w-[190px] focus-within:border-line focus-within:bg-white xl:w-[160px] xl:focus-within:w-[220px] 2xl:w-[200px] 2xl:focus-within:w-[260px]"
            inputClassName="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
            panelClassName="min-w-[320px]"
          />
          <LangToggle/>
          {Wish}
          {Bag}
          <Link href={user ? "/account" : "/auth"} aria-label={t("nav.account")} className="group flex items-center gap-2.5 bg-ink text-white rounded-pill pl-1.5 xl:pl-4 pr-1.5 py-1.5 text-[12px] font-semibold uppercase tracking-[.1em] hover:-translate-y-px hover:shadow-lift active:scale-[.98] transition-all duration-200 ease-elegant">
            <span className="hidden xl:inline">{user ? user.firstName : t("nav.signin")}</span>
            <span className="w-8 h-8 rounded-full bg-white/15 grid place-items-center transition-colors group-hover:bg-accent"><UserIcon width={15} height={15}/></span>
          </Link>
        </div>

      </nav>
     </div>
    </div>
  );
}
