"use client";
import { useEffect, useState } from "react";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { useAuth } from "@/lib/store";
import { useT } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { POINTS_CHANGED } from "@/lib/points-events";
import type { LoyaltyAccount } from "@/lib/medusa";

/**
 * Бонус — the points balance, in the bar, next to the account button.
 *
 * Points nobody can see are points nobody collects, so the balance sits in the
 * header rather than three clicks inside the account page. It is a link, not a
 * menu: a panel here only repeated what the points page already says in full,
 * and put a dropdown between the owner and the page they wanted.
 *
 * Signed out there is nothing to show, so it renders nothing — the sign-in
 * button beside it is the whole story at that point.
 */

const nf = (n: number) => Math.round(n || 0).toLocaleString("en-US");

export function BonusMenu() {
  const t = useT();
  const token = useAuth(s => s.token);
  const user = useAuth(s => s.user);
  const [data, setData] = useState<LoyaltyAccount | null>(null);

  useEffect(() => {
    if (!token) { setData(null); return; }
    let dropped = false;
    const load = () => {
      api.loyalty.get(token)
        .then(d => { if (!dropped) setData(d); })
        // The bar must never break over points: no balance simply means no chip.
        .catch(() => { if (!dropped) setData(null); });
    };
    load();
    // Spending points on the account page changes this number too.
    window.addEventListener(POINTS_CHANGED, load);
    return () => { dropped = true; window.removeEventListener(POINTS_CHANGED, load); };
  }, [token]);

  if (!user || !token || !data) return null;

  return (
    <Link
      href="/account?tab=points"
      aria-label={`${t("bonus.title")}: ${nf(data.balance)}`}
      className="flex items-center gap-1.5 rounded-pill border border-line bg-white/70 px-3 py-2 text-[12px] font-semibold uppercase tracking-[.1em] text-ink transition-all duration-200 ease-elegant hover:-translate-y-px hover:border-ink/30"
    >
      <SparkIcon />
      <span className="hidden sm:inline">{t("bonus.title")}</span>
      <span className="num-tabular">{nf(data.balance)}</span>
    </Link>
  );
}

function SparkIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.6l2.4 5.9 5.9 2.4-5.9 2.4-2.4 5.9-2.4-5.9L3.7 10.9l5.9-2.4L12 2.6z"
        fill="currentColor" />
    </svg>
  );
}
