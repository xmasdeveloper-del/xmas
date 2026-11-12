"use client";
import { useState } from "react";
import { useToast } from "@/lib/store";
import { useT, useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";

/**
 * White capsule with the CTA tucked inside — sits on the dark footer card.
 *
 * It used to clear the box and say thank you without sending the address
 * anywhere: the shop promised to write when new stock landed and had no list
 * to write to. The address now reaches /store/newsletter, and the thank-you
 * only appears once it has.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast(s => s.show);
  const lang = useLang();
  const t = useT();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.newsletter.subscribe(address, lang);
      setDone(true);
      setEmail("");
      showToast(t("news.subscribed"));
    } catch (err: any) {
      setError(err?.message || t("news.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative z-10 mx-auto w-full max-w-[440px]">
      <div className="flex items-center gap-2 rounded-pill bg-white p-1.5 pl-5 shadow-[0_18px_40px_-16px_rgba(0,0,0,.55)] transition-shadow focus-within:shadow-[0_18px_44px_-14px_rgba(241,89,43,.5)]">
        <input
          type="email" required value={email}
          onChange={e => { setEmail(e.target.value); setDone(false); setError(""); }}
          placeholder={t("news.placeholder")}
          aria-label={t("news.placeholder")}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-ink outline-none placeholder:text-subtle"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-10 shrink-0 rounded-pill bg-accent px-5 text-[13.5px] font-semibold text-white transition-all duration-300 ease-spring hover:bg-accent-deep hover:scale-[1.03] active:scale-95 disabled:opacity-60"
        >
          {busy ? t("common.pleaseWait") : t("news.alerts")}
        </button>
      </div>

      {done && (
        <p role="status" className="mt-2.5 text-center text-[12.5px] text-white/80">
          {t("news.subscribed")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2.5 text-center text-[12.5px] text-accent">
          {error}
        </p>
      )}
    </form>
  );
}
