"use client";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { usePathname } from "next/navigation";
import { HomeIcon, SearchIcon, BagIcon, UserIcon } from "./Icons";
import { useLang, useT } from "./LangProvider";

export function MobileTabBar() {
  const path = usePathname();
  const lang = useLang();
  const t = useT();
  // The PDP shows its own sticky add-to-bag bar in this slot.
  if (path.startsWith("/product/")) return null;

  // usePathname gives the real URL, which carries the locale ("/mn/shop"),
  // while these hrefs are locale-less because LocaleLink adds the prefix. The
  // two were compared directly, so nothing ever matched: no tab ever lit up,
  // and Home in particular looked dead because tapping it while already on the
  // home page is a no-op that showed no state either.
  const rel = path.replace(new RegExp(`^/${lang}(?=/|$)`), "") || "/";

  const items = [
    { href: "/",         label: t("tab.home"), icon: HomeIcon },
    { href: "/shop",     label: t("tab.shop"), icon: SearchIcon },
    { href: "/cart",     label: t("tab.cart"), icon: BagIcon },
    { href: "/account",  label: t("tab.me"),   icon: UserIcon },
  ];

  return (
    <nav className="lg:hidden fixed bottom-4 inset-x-4 z-40 bg-ink text-white rounded-pill p-2 flex justify-around items-center shadow-deep">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? rel === "/" : rel === href || rel.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-label={label}
            aria-current={active ? "page" : undefined}
            // Tapping the tab you are already on should still do something —
            // take you back to the top rather than nothing at all.
            onClick={(e) => {
              if (!active) return;
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex items-center justify-center gap-2 h-11 rounded-pill text-[12px] font-semibold transition-all ${
              active ? "bg-accent text-ink px-5 flex-[1.4]" : "text-white/60 flex-1"
            }`}>
            <Icon width={19} height={19}/>
            {active && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
