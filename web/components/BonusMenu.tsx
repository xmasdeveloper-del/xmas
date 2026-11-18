"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { useAuth } from "@/lib/store";
import { useT } from "@/components/LangProvider";
import { api, money } from "@/lib/api";
import type { LoyaltyAccount } from "@/lib/medusa";
import { POINTS_CHANGED } from "@/lib/points-events";

/**
 * Бонус — the points balance, in the bar, next to the account button.
 *
 * Points nobody can see are points nobody collects, so the balance sits in the
 * header rather than three clicks inside the account page. The panel answers
 * the three questions worth asking without leaving the page: how many do I
 * have, what are they worth, and where did the last ones come from.
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
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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

  // Close on an outside click or Escape — the panel is a menu, not a dialog.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  if (!user || !token || !data) return null;

  const worth = data.balance * data.pointValue;
  const toGo = Math.max(0, data.minRedeem - data.balance);
  const recent = data.entries.slice(0, 5);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${t("bonus.title")}: ${nf(data.balance)}`}
        className={`flex items-center gap-1.5 rounded-pill border px-3 py-2 text-[12px] font-semibold uppercase tracking-[.1em] transition-all duration-200 ease-elegant hover:-translate-y-px ${
          open ? "border-ink bg-ink text-white" : "border-line bg-white/70 text-ink hover:border-ink/30"
        }`}
      >
        <SparkIcon />
        <span className="hidden sm:inline">{t("bonus.title")}</span>
        <span className="num-tabular">{nf(data.balance)}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-[310px] overflow-hidden rounded-[1.1rem] border border-line bg-white shadow-lift"
          >
            <div className="p-4 text-white" style={{ background: "linear-gradient(135deg,#C8102E 0%,#7A0A1C 100%)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/70">{t("bonus.balance")}</div>
              <div className="mt-0.5 flex items-end gap-1.5">
                <div className="font-display text-[30px] leading-none num-tabular">{nf(data.balance)}</div>
                <div className="pb-1 text-[12px] font-semibold text-white/80">{t("pts.unit")}</div>
              </div>
              <div className="mt-0.5 text-[12px] text-white/80 num-tabular">≈ {money(worth)}</div>
              <div className="mt-2 text-[11.5px] text-white/80 num-tabular">
                {toGo > 0
                  ? t("bonus.toGo").replace("{n}", nf(toGo))
                  : t("bonus.ready").replace("{amount}", money(worth))}
              </div>
            </div>

            <div className="p-3">
              <div className="tiny mb-1.5">{t("bonus.recent")}</div>
              {recent.length === 0 ? (
                <p className="px-1 pb-1 text-[12.5px] text-muted">{t("bonus.empty")}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {recent.map(e => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-medium">
                          {e.kind === "earn" ? t("pts.kindEarn")
                            : e.kind === "redeem" ? t("pts.kindRedeem")
                            : e.kind === "revert" ? t("pts.kindRevert")
                            : t("pts.kindAdjust")}
                        </div>
                        <div className="tiny truncate">
                          {new Date(e.created_at).toLocaleDateString()}{e.code ? ` · ${e.code}` : ""}
                        </div>
                      </div>
                      <span className={`shrink-0 text-[12.5px] font-bold num-tabular ${e.points > 0 ? "text-green-700" : "text-muted"}`}>
                        {e.points > 0 ? "+" : ""}{nf(e.points)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href="/account?tab=points"
                onClick={() => setOpen(false)}
                className="mt-3 flex items-center justify-center rounded-pill bg-ink px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[.1em] text-white transition-colors hover:bg-accent"
              >
                {t("bonus.manage")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
