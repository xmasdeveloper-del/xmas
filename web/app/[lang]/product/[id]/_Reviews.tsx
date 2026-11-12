"use client";
import { useState } from "react";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { Stars } from "@/components/Stars";
import { useAuth, useToast } from "@/lib/store";
import { useT } from "@/components/LangProvider";
import { api } from "@/lib/api";
import type { Review, ReviewSummary } from "@/lib/types";

const MAX_BODY = 1200;

/** Initials avatar — no stock photos of people who never wrote the review. */
function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-deep">
      {initials || "?"}
    </span>
  );
}

function ReviewRow({ r, lang }: { r: Review; lang: string }) {
  const t = useT();
  return (
    <li className="flex gap-3.5 border-t border-line py-5 first:border-t-0 first:pt-0">
      <Avatar name={r.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[14px] font-semibold text-ink">{r.name}</span>
          {r.verified && (
            <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[.08em] text-accent-deep">
              {t("rev.verified")}
            </span>
          )}
          <time className="text-[12px] text-subtle" dateTime={r.created_at}>
            {new Date(r.created_at).toLocaleDateString(lang === "mn" ? "mn-MN" : "en-GB", { year: "numeric", month: "short", day: "numeric" })}
          </time>
        </div>
        <Stars rating={r.rating} size={13} />
        {r.title && <h4 className="mt-1.5 text-[14px] font-semibold text-ink">{r.title}</h4>}
        <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/75">{r.body}</p>
      </div>
    </li>
  );
}

/** Star picker for the write form. */
function RatingInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[12px] font-medium text-subtle">{label}</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} / 5`}
            aria-pressed={value === n}
            className={`grid h-10 w-10 place-items-center rounded-full text-[22px] leading-none transition-colors ${
              n <= value ? "text-[#F4B400]" : "text-ink/20 hover:text-ink/40"
            }`}
          >★</button>
        ))}
      </div>
    </fieldset>
  );
}

export function Reviews({ productId, summary, lang }: {
  productId: string;
  summary: ReviewSummary;
  lang: string;
}) {
  const t = useT();
  const token = useAuth(s => s.token);
  const user = useAuth(s => s.user);
  const signOut = useAuth(s => s.signOut);
  const showToast = useToast(s => s.show);

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.reviews.create(
        { product_id: productId, rating, body: body.trim(), title: title.trim() || undefined },
        token,
      );
      setSent(true);
      setOpen(false);
      showToast(t("rev.pending"));
    } catch (err: any) {
      if (err?.status === 401) {
        // The 24-hour token ran out while the page still showed them signed
        // in. Say what actually happened and drop the dead session, instead
        // of passing on a "please sign in" that makes no sense to someone
        // whose name is in the header.
        signOut();
        setOpen(false);
        setError(t("toast.sessionExpired"));
        showToast(t("toast.sessionExpired"));
      } else {
        setError(err?.message || t("toast.authFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  const { rating: mean, count, reviews } = summary;

  return (
    <section className="mt-12 rounded-[1.5rem] border border-line bg-white p-6 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-[22px] uppercase tracking-tight sm:text-[26px]">{t("rev.title")}</h2>
          {count > 0 && mean !== null ? (
            <div className="mt-2 flex items-center gap-2.5">
              <Stars rating={mean} size={16} />
              <span className="num-tabular text-[15px] font-bold text-ink">{mean}</span>
              <span className="text-[13px] text-muted">
                {count.toLocaleString()} {count === 1 ? t("rev.countOne") : t("rev.countMany")}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-[13.5px] text-muted">{t("rev.none")} {t("rev.beFirst")}</p>
          )}
        </div>

        {token ? (
          !sent && !open && (
            <button type="button" onClick={() => setOpen(true)} className="chip shrink-0">{t("rev.write")}</button>
          )
        ) : (
          <Link href="/auth" className="chip shrink-0">{t("rev.signIn")}</Link>
        )}
      </div>

      {sent && (
        <p role="status" className="mt-5 rounded-xl border border-accent/25 bg-accent-soft/50 px-4 py-3 text-[13.5px] text-accent-deep">
          {t("rev.pending")}
        </p>
      )}

      {open && token && (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-surface-2 p-5">
          <RatingInput value={rating} onChange={setRating} label={t("rev.yourRating")} />

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-subtle">{t("rev.titleField")}</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={90}
              className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[14px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-subtle">{t("rev.bodyField")}</span>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              rows={4}
              maxLength={MAX_BODY}
              className="w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] leading-relaxed outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
            <span className="mt-1 block text-right text-[11px] text-subtle num-tabular">{body.length}/{MAX_BODY}</span>
          </label>

          {error && <p role="alert" className="text-[12.5px] text-red-600">{error}</p>}

          <div className="flex items-center gap-2.5">
            <button type="submit" disabled={busy || !body.trim()} className="pill-cta h-11 px-6 text-[13px] disabled:opacity-60">
              {busy ? t("common.pleaseWait") : t("rev.submit")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-pill px-5 text-[13px] font-medium text-muted transition-colors hover:text-ink">
              {t("rev.cancel")}
            </button>
          </div>
          {user && <p className="text-[11.5px] text-subtle">{user.firstName} {user.lastName}</p>}
        </form>
      )}

      {reviews.length > 0 && (
        <ul className="mt-7">
          {reviews.map(r => <ReviewRow key={r.id} r={r} lang={lang} />)}
        </ul>
      )}
    </section>
  );
}
