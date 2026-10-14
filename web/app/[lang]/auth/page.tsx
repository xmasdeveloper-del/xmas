"use client";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useToast } from "@/lib/store";
import { useT, useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { EyeIcon, EyeOffIcon, ChevronLeft } from "@/components/Icons";

function pwScore(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12 || (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw))) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) s++;
  return Math.min(3, s) as 0 | 1 | 2 | 3;
}

const MailCheckIcon = ({ width = 24, height = 24 }: { width?: number; height?: number }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8" />
    <path d="m3.5 7.5 8.5 6 8.5-6" />
    <path d="m16 17 2 2 4-4" />
  </svg>
);

const TickIcon = ({ width = 16, height = 16 }: { width?: number; height?: number }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m4 12.5 5.2 5.2L20 7" />
  </svg>
);

// The shot that carries the panel — a cutout, so it sits on the ink field with
// no box around it.

// Medusa returns its auth failures in English. Translate the ones a shopper
// can reach; anything else is already one of our own Mongolian messages (the
// rate limiter's, for one) and passes straight through.
function authErrorKey(raw: string): "auth.wrongCreds" | "auth.emailTaken" | null {
  const m = (raw || "").toLowerCase();
  if (m.includes("invalid email or password") || m.includes("unauthorized")) return "auth.wrongCreds";
  if (m.includes("already exists")) return "auth.emailTaken";
  return null;
}

export default function AuthPage() {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const setSession = useAuth(s => s.setSession);
  const showToast = useToast(s => s.show);
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  // Unchecked means the sign-in lasts for this browser session only.
  const [remember, setRemember] = useState(true);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const isReg = mode === "register";
  const isForgot = mode === "forgot";

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setErrors(er => ({ ...er, [k]: "" }));
  };

  function validate() {
    const er: Record<string, string> = {};
    if (isReg && !form.name.trim()) er.name = t("common.required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) er.email = t("auth.invalidEmail");
    if (!isForgot && form.password.length < (isReg ? 8 : 1)) er.password = isReg ? t("auth.min8") : t("common.required");
    setErrors(er);
    return Object.keys(er).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setFormError("");
    setBusy(true);
    try {
      if (isForgot) {
        // Always resolves (no info leak); show the confirmation regardless.
        await api.auth.resetRequest(form.email);
        setSent(true);
        setBusy(false);
        return;
      }
      let result;
      if (isReg) {
        const parts = form.name.trim().split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ") || firstName;
        result = await api.auth.signup({ firstName, lastName, email: form.email, password: form.password });
      } else {
        result = await api.auth.login(form.email, form.password);
      }
      setSession(result.user, result.token, remember);
      showToast(`${t("auth.welcomeName")}, ${result.user.firstName}!`);
      router.push(`/${lang}/account`);
    } catch (err: any) {
      const key = authErrorKey(err?.message);
      const msg = key ? t(key) : (err.message || t("toast.authFailed"));
      showToast(msg);
      setFormError(msg);
      setBusy(false);
    }
  }

  const goForgot = () => { setMode("forgot"); setSent(false); setErrors({}); setFormError(""); };
  const backToLogin = () => { setMode("login"); setSent(false); setErrors({}); setFormError(""); };

  const score = pwScore(form.password);
  const strengthLabel = [t("auth.pwWeak"), t("auth.pwWeak"), t("auth.pwFair"), t("auth.pwStrong")][score];
  const strengthColor = ["#9aa0a6", "#ef4444", "#f59e0b", "#16a34a"][score];

  const toggle = () => { setMode(isReg ? "login" : "register"); setErrors({}); setFormError(""); };

  return (
    <div className="grid min-h-screen place-items-center bg-mist px-4 py-8 sm:py-12">
      <div className="relative w-full max-w-[1000px] overflow-hidden rounded-[1.75rem] bg-white shadow-[0_40px_90px_-34px_rgba(22,21,21,.35)] sm:rounded-[2rem] lg:grid lg:min-h-[580px] lg:grid-cols-2">

        {/* ============ BRAND PANEL (desktop) — the logo, large ============ */}
        <div className="relative hidden place-items-center overflow-hidden bg-ink lg:grid">
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-[420px] w-[420px] rounded-full bg-accent/25 blur-[100px]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-[360px] w-[360px] rounded-full bg-accent/15 blur-[100px]" />
          <Link href="/" aria-label="X-MAS" className="relative z-10 block transition-transform duration-500 hover:scale-[1.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="X-MAS" className="w-[clamp(180px,22vw,300px)] object-contain brightness-0 invert drop-shadow-[0_24px_48px_rgba(0,0,0,.5)]" />
          </Link>
        </div>

        {/* ============ FORM ============ */}
        <div className="relative flex flex-col px-6 py-9 sm:px-10 lg:px-11 lg:py-12 lg:pb-[108px]">
          {/* Mobile top: back · mark */}
          <div className="mb-7 flex items-center justify-between lg:hidden">
            <Link href="/" aria-label={t("bc.home")} className="-ml-1 grid h-10 w-10 place-items-center rounded-full text-ink/70 transition hover:bg-surface-2">
              <ChevronLeft width={20} height={20} />
            </Link>
            <Link href="/" aria-label="X-MAS">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="X-MAS" className="h-10 w-auto object-contain" />
            </Link>
            <span className="w-10" aria-hidden />
          </div>

          <h1 className="font-display text-[30px] leading-[1.05] tracking-tight text-ink sm:text-[36px]">
            {isForgot ? t("auth.forgotTitle") : isReg ? t("auth.createAccount") : t("auth.welcomeBack")}
          </h1>
          <p className="mt-2.5 max-w-[360px] text-[13.5px] leading-relaxed text-muted">
            {isForgot ? t("auth.forgotDesc") : isReg ? t("auth.createDesc") : t("auth.signInDesc")}
          </p>

          {isForgot && sent ? (
            <div className="mt-8 flex flex-col items-start text-left">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
                <MailCheckIcon width={24} height={24} />
              </span>
              <h2 className="mt-4 font-display text-[20px] tracking-tight">{t("auth.resetSentTitle")}</h2>
              <p className="mt-2 max-w-[340px] text-[14px] leading-relaxed text-muted">{t("auth.resetSentDesc")}</p>
              <p className="mt-3 break-all text-[13px] font-medium text-ink">{form.email}</p>
              <button type="button" onClick={backToLogin}
                className="mt-7 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline">
                <ChevronLeft width={16} height={16} /> {t("auth.backToSignIn")}
              </button>
            </div>
          ) : (
          <>
            {/* The submit button sits in the card's corner, outside this element,
                so it is tied back to the form by id. */}
            <form id="auth-form" onSubmit={submit} noValidate className="mt-7 space-y-3.5">
              <FloatingField label={t("co.email")} name="email" type="email" inputMode="email" autoComplete="email"
                value={form.email} onChange={update("email")} error={errors.email}/>

              {isReg && (
                <FloatingField label={t("auth.yourName")} name="name" autoComplete="name"
                  value={form.name} onChange={update("name")} error={errors.name}/>
              )}

              {!isForgot && (
              <FloatingField
                label={t("auth.password")} name="password" type={showPw ? "text" : "password"}
                autoComplete={isReg ? "new-password" : "current-password"}
                value={form.password} onChange={update("password")} error={errors.password}
                labelRight={isReg && form.password ? (
                  <span className="flex items-center gap-2">
                    <span className="flex gap-1" aria-hidden>
                      {[1, 2, 3].map(i => <span key={i} className="h-[3px] w-4 rounded-full" style={{ background: i <= score ? strengthColor : "#E3E3E6" }}/>)}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
                  </span>
                ) : undefined}
                right={
                  <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? t("auth.hidePw") : t("auth.showPw")}
                    className="-mr-1 grid h-9 w-9 place-items-center rounded-full text-subtle transition-colors hover:text-ink">
                    {showPw ? <EyeOffIcon width={18} height={18}/> : <EyeIcon width={18} height={18}/>}
                  </button>
                }
              />
              )}

              {!isReg && !isForgot && (
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <label className="inline-flex cursor-pointer select-none items-center gap-2.5 py-1 text-[13px] text-ink/75">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      className="h-[17px] w-[17px] cursor-pointer rounded-[5px] border-line accent-accent"/>
                    {t("auth.remember")}
                  </label>
                  <button type="button" onClick={goForgot}
                    className="-mr-1 px-1 py-1.5 text-[12.5px] text-muted underline-offset-2 transition-colors hover:text-accent hover:underline">
                    {t("auth.forgot")}
                  </button>
                </div>
              )}

              {formError && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
                  <span>{formError}</span>
                </div>
              )}

              {/* On a phone there is no corner to anchor to. */}
              <button disabled={busy} type="submit"
                className="grid h-[52px] w-full place-items-center rounded-pill bg-accent text-[13px] font-semibold uppercase tracking-[.12em] text-white transition-colors hover:bg-accent-deep disabled:opacity-60 lg:hidden">
                {busy ? t("common.pleaseWait") : isForgot ? t("auth.sendResetLink") : isReg ? t("auth.signUp") : t("auth.signIn")}
              </button>
            </form>

            <div className="mt-7 text-[13px] lg:absolute lg:bottom-9 lg:left-11 lg:mt-0 lg:max-w-[46%]">
              {isForgot ? (
                <button type="button" onClick={backToLogin}
                  className="inline-flex items-center gap-1.5 font-medium text-muted transition-colors hover:text-accent">
                  <ChevronLeft width={16} height={16} /> {t("auth.backToSignIn")}
                </button>
              ) : (
                <>
                  <span className="block text-muted">{isReg ? t("auth.haveAccount") : t("auth.noAccount")}</span>
                  <button type="button" onClick={toggle}
                    className="mt-0.5 inline-flex items-center gap-1 font-semibold text-ink transition-colors hover:text-accent">
                    {isReg ? t("auth.signIn") : t("auth.signUp")}
                    <span aria-hidden className="tracking-[-.08em] text-accent">›››</span>
                  </button>
                </>
              )}
            </div>

            {/* Anchored to the card's bottom-right corner, as the reference has it. */}
            <button form="auth-form" disabled={busy} type="submit"
              className="absolute bottom-0 right-0 hidden h-[84px] min-w-[190px] place-items-center rounded-tl-[1.5rem] rounded-br-[2rem] bg-accent px-10 text-[15px] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-60 lg:grid">
              {busy ? t("common.pleaseWait") : isForgot ? t("auth.sendResetLink") : isReg ? t("auth.signUp") : t("auth.signIn")}
            </button>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function FloatingField({ label, error, right, labelRight, name, ...props }: {
  label: string; error?: string; right?: React.ReactNode; labelRight?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className={`rounded-2xl border bg-surface-2 px-4 py-2 transition focus-within:border-accent focus-within:bg-white focus-within:ring-4 focus-within:ring-accent/10 ${error ? "border-red-400" : "border-line"}`}>
        <div className="flex items-center justify-between">
          <label htmlFor={name} className="block text-[11px] font-medium text-subtle">{label}</label>
          {labelRight}
        </div>
        <div className="flex items-center">
          <input id={name} name={name} {...props}
            aria-invalid={!!error} aria-describedby={error ? `${name}-err` : undefined}
            className="flex-1 min-w-0 bg-transparent outline-none focus-visible:outline-none border-0 p-0 text-[15px] text-ink placeholder:text-subtle"/>
          {right}
        </div>
      </div>
      {error && <span id={`${name}-err`} role="alert" className="text-[11px] text-red-500 mt-1 block px-1">{error}</span>}
    </div>
  );
}
