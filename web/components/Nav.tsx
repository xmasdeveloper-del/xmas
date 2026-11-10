"use client";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LiquidNavbar } from "@/components/ui/liquid-navbar";
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

export function Nav() {
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
  const router = useRouter();
  // Which link the water sits under on arrival. Read from the path only —
  // useSearchParams would force every page that renders the nav to opt out of
  // static rendering, so a deep link straight to ?category=Nike starts the
  // drop on Дэлгүүр and moves the moment anything is picked.
  const activeLink = Math.max(0, NAV_LINKS.findIndex(([h]) => localePath(h, lang) === pathname));

  // The pill's items are real links, so they would work on their own — but a
  // bare anchor reloads the whole page. Catch a plain left-click on the way up
  // and route it instead; anything the visitor meant for a new tab or window
  // (middle click, ctrl/cmd/shift/alt) is left to the browser.
  const followPill = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    router.push(href);
  };

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
  const iconBtn = "relative w-11 h-11 rounded-full bg-white/70 border border-white/60 shadow-soft grid place-items-center text-ink hover:bg-white hover:-translate-y-px active:scale-90 transition-all duration-200 ease-elegant";

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
     <div className="mx-auto max-w-[1280px] rounded-[1.5rem] bg-white/90 backdrop-blur-xl border border-line shadow-[0_14px_34px_-18px_rgba(22,21,21,.35)] px-3 sm:px-4 py-2">
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

        {/* The links as a pill of water. Below xl the pill would crowd the
            search and the account button off the bar, so the single Дэлгүүр
            link carries that width on its own — same as it did before.

            Every item carries a real href, so the pill is made of links: they
            open in a new tab, they can be copied, and a crawler can follow
            them. They also always navigate — the pill's own callback only
            fires when the chosen index CHANGES, which left the shop's main
            link dead on the homepage (where it starts selected) and every link
            dead the second time it was clicked. */}
        <div className="min-w-0 items-center hidden xl:flex" onClick={followPill}>
          <LiquidNavbar
            items={NAV_LINKS.map(([href, k]) => ({ label: t(k), href: localePath(href, lang) }))}
            defaultActive={activeLink}
            style={{
              // the pill ships navy-on-glass; this is the shop's own ink/accent
              ["--n-fg" as string]: "#161515",
              ["--n-fg-soft" as string]: "rgba(22,21,21,.55)",
              ["--n-tint" as string]: "rgba(255,255,255,.10)",
            }}
          />
        </div>
        <Link
          href="/shop"
          aria-current={pathname === "/shop" ? "page" : undefined}
          className={`relative whitespace-nowrap text-[12px] uppercase tracking-[.12em] font-medium transition-colors xl:hidden ${pathname === "/shop" ? "text-ink" : "text-muted hover:text-ink"}`}
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
