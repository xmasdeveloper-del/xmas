"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, money } from "@/lib/api";
import { useT } from "@/components/LangProvider";
import { useAuth, useToast } from "@/lib/store";
import { Skeleton } from "@/components/Skeleton";
import { CountUp } from "@/components/CountUp";
import type { LoyaltyAccount } from "@/lib/medusa";
import { POINTS_CHANGED } from "@/lib/points-events";

/**
 * Оноо — the points tab.
 *
 * Spending points does not discount the cart. It mints a single-use code worth
 * `points × pointValue`, which is why this panel is built around one action:
 * turn a balance into a code you can read out at the till or paste at
 * checkout. Showing the code immediately, with a copy button, is the whole
 * point — a number that cannot be turned into anything is just a score.
 */

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
const nf = (n: number) => Math.round(n || 0).toLocaleString("en-US");

export function PointsPanel() {
  const t = useT();
  const token = useAuth(s => s.token);
  const showToast = useToast(s => s.show);

  const [data, setData] = useState<LoyaltyAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [want, setWant] = useState("");
  const [busy, setBusy] = useState(false);
  const [minted, setMinted] = useState<{ code: string; amount: number } | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const d = await api.loyalty.get(token);
      setData(d);
      setFailed(null);
      // Default the box to everything spendable, which is what people want.
      setWant(d.balance >= d.minRedeem ? String(d.balance) : "");
    } catch (e: any) {
      setFailed(e?.message || t("pts.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const wanted = Math.max(0, Math.floor(Number(want.replace(/[^0-9]/g, "")) || 0));
  const canRedeem = !!data && data.enabled && wanted >= data.minRedeem && wanted <= data.balance;
  const worth = (p: number) => (data ? p * data.pointValue : 0);

  const usable = useMemo(() => (data?.coupons || []).filter(c => c.state === "usable"), [data]);

  const redeem = async () => {
    if (!token || !data || !canRedeem) return;
    setBusy(true);
    try {
      const r = await api.loyalty.redeem(token, wanted);
      setMinted({ code: r.code, amount: r.amount });
      showToast(t("pts.minted").replace("{code}", r.code));
      await load();
      // The header carries the same balance and fetched it when it mounted;
      // without this it keeps showing what the points were before this click.
      window.dispatchEvent(new Event(POINTS_CHANGED));
    } catch (e: any) {
      showToast(e?.message || t("pts.redeemError"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(t("pts.copied").replace("{code}", code));
    } catch {
      // Clipboard blocked (http, or permission denied): the code is on screen,
      // so say so rather than failing silently.
      showToast(code);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[168px] rounded-[1.4rem]" />
        <Skeleton className="h-[120px] rounded-[1.4rem]" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="rounded-[1.4rem] border border-line bg-white p-6 text-center">
        <p className="text-sm text-muted">{failed}</p>
        <button onClick={() => void load()} className="mt-3 text-sm font-semibold underline">
          {t("pts.retry")}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const toGo = Math.max(0, data.minRedeem - data.balance);
  const pct = Math.min(100, Math.round((data.balance / Math.max(1, data.minRedeem)) * 100));

  return (
    <div className="space-y-4">
      {/* The balance */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="relative overflow-hidden rounded-[1.4rem] p-6 text-white"
        style={{ background: "linear-gradient(135deg,#C8102E 0%,#7A0A1C 100%)" }}
      >
        {/* A soft disc behind the number — decoration only. */}
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-xl" />
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-white/70">{t("pts.balance")}</div>
          <div className="mt-1 flex items-end gap-2">
            <div className="font-display text-[44px] leading-none tracking-tight num-tabular">
              <CountUp value={data.balance} format={nf} />
            </div>
            <div className="pb-1.5 text-sm font-semibold text-white/80">{t("pts.unit")}</div>
          </div>
          <div className="mt-1 text-sm text-white/80 num-tabular">≈ {money(worth(data.balance))}</div>

          {data.balance < data.minRedeem ? (
            <div className="mt-4" ref={liveRef} aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white/80 transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 text-xs text-white/80 num-tabular">
                {t("pts.toGo").replace("{n}", nf(toGo)).replace("{min}", nf(data.minRedeem))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-xs text-white/80 num-tabular">
              {t("pts.spendable").replace("{amount}", money(worth(data.balance)))}
            </div>
          )}
        </div>
      </motion.div>

      {/* How it works, in the shop's own numbers */}
      <div className="rounded-[1.4rem] border border-line bg-white p-5">
        <h3 className="font-display text-[17px] tracking-tight">{t("pts.howTitle")}</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-muted">
          <li className="num-tabular">
            {t("pts.how1").replace("{pct}", String(data.earnPercent)).replace("{points}", nf((100000 * data.earnPercent) / 100 / Math.max(1, data.pointValue)))}
          </li>
          <li className="num-tabular">{t("pts.how2").replace("{value}", money(data.pointValue))}</li>
          <li className="num-tabular">{t("pts.how3").replace("{min}", nf(data.minRedeem))}</li>
        </ul>
        {!data.enabled && (
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-muted">{t("pts.paused")}</p>
        )}
      </div>

      {/* Spend them */}
      {data.enabled && data.balance >= data.minRedeem && (
        <div className="rounded-[1.4rem] border border-line bg-white p-5">
          <h3 className="font-display text-[17px] tracking-tight">{t("pts.spendTitle")}</h3>
          <p className="mt-1 text-sm text-muted">{t("pts.spendNote")}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {[data.minRedeem, Math.floor(data.balance / 2), data.balance]
              .filter((v, i, a) => v >= data.minRedeem && v <= data.balance && a.indexOf(v) === i)
              .map(v => (
                <button
                  key={v}
                  onClick={() => setWant(String(v))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold num-tabular transition ${
                    wanted === v ? "border-ink bg-ink text-white" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {v === data.balance ? t("pts.all") : nf(v)}
                </button>
              ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex-1 min-w-[160px]">
              <span className="sr-only">{t("pts.amountLabel")}</span>
              <input
                inputMode="numeric"
                value={want}
                onChange={e => setWant(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder={nf(data.minRedeem)}
                aria-label={t("pts.amountLabel")}
                className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm num-tabular outline-none focus:border-ink"
              />
            </label>
            <button
              onClick={() => void redeem()}
              disabled={!canRedeem || busy}
              className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-40"
            >
              {busy ? t("pts.minting") : t("pts.redeem")}
            </button>
          </div>

          <div className="mt-2 text-xs text-muted num-tabular" aria-live="polite">
            {wanted > data.balance
              ? t("pts.tooMany").replace("{n}", nf(data.balance))
              : wanted > 0 && wanted < data.minRedeem
                ? t("pts.tooFew").replace("{min}", nf(data.minRedeem))
                : wanted > 0
                  ? t("pts.willMint").replace("{amount}", money(worth(wanted)))
                  : ""}
          </div>

          {minted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="mt-4 rounded-xl border border-dashed border-ink/30 bg-surface-2 p-4"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">
                {t("pts.yourCode")}
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <div className="font-mono text-[22px] font-bold tracking-[.12em]">{minted.code}</div>
                <button onClick={() => void copy(minted.code)} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-ink">
                  {t("pts.copy")}
                </button>
              </div>
              <div className="mt-1 text-sm text-muted num-tabular">
                {t("pts.codeWorth").replace("{amount}", money(minted.amount))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Codes in hand */}
      {usable.length > 0 && (
        <div className="rounded-[1.4rem] border border-line bg-white p-5">
          <h3 className="font-display text-[17px] tracking-tight">{t("pts.couponsTitle")}</h3>
          <div className="mt-3 divide-y divide-line">
            {usable.map(c => (
              <div key={c.code} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="font-mono text-[15px] font-bold tracking-[.1em]">{c.code}</div>
                  <div className="tiny num-tabular">
                    {c.type === "fixed" && c.value != null
                      ? money(c.value)
                      : c.type === "percentage" && c.value != null
                        ? `${c.value}%`
                        : c.note || ""}
                    {c.expires_at ? ` · ${t("pts.until")} ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <button onClick={() => void copy(c.code)} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-ink">
                  {t("pts.copy")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The ledger */}
      <div className="rounded-[1.4rem] border border-line bg-white p-5">
        <h3 className="font-display text-[17px] tracking-tight">{t("pts.historyTitle")}</h3>
        {data.entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("pts.historyEmpty")}</p>
        ) : (
          <div className="mt-3 divide-y divide-line">
            {data.entries.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {e.kind === "earn" ? t("pts.kindEarn")
                      : e.kind === "redeem" ? t("pts.kindRedeem")
                      : e.kind === "revert" ? t("pts.kindRevert")
                      : t("pts.kindAdjust")}
                  </div>
                  <div className="tiny truncate">
                    {new Date(e.created_at).toLocaleDateString()}
                    {e.code ? ` · ${e.code}` : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
                <div className={`shrink-0 text-sm font-bold num-tabular ${e.points > 0 ? "text-green-700" : "text-muted"}`}>
                  {e.points > 0 ? "+" : ""}{nf(e.points)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
