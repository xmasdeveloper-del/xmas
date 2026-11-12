"use client";
import { useLang, setLang } from "./LangProvider";

export function LangToggle({ className = "" }: { className?: string }) {
  const lang = useLang();
  return (
    // Same glass as the bar it sits in, so it reads as part of the surface
    // rather than a grey tile dropped onto it.
    <div className={`liquid-chip flex items-center rounded-pill p-0.5 text-[11px] font-semibold ${className}`}>
      <button
        onClick={() => lang !== "mn" && setLang("mn")}
        className={`px-3 h-9 rounded-pill transition ${lang === "mn" ? "bg-ink text-white" : "text-muted"}`}
        aria-label="МН — Монгол хэл"
      >МН</button>
      <button
        onClick={() => lang !== "en" && setLang("en")}
        className={`px-3 h-9 rounded-pill transition ${lang === "en" ? "bg-ink text-white" : "text-muted"}`}
        aria-label="EN — English"
      >EN</button>
    </div>
  );
}
