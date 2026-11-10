import { defineWidgetConfig } from "@medusajs/admin-sdk";

// X-MAS mark — bold white "X" on the warm brand gradient badge.
const XMark = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" aria-hidden>
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
);

/**
 * X-MAS sign-in header. The default Medusa logo + "Welcome to Medusa" heading are
 * hidden via CSS (see brand-theme.tsx) so this becomes the login hero: a large
 * X mark, the X-MAS wordmark, and a Mongolian welcome line.
 */
const LoginBrand = () => {
  return (
    <div className="mb-6 flex flex-col items-center gap-3.5 text-center">
      <span
        className="grid h-16 w-16 place-items-center rounded-[1.35rem] shadow-[0_14px_30px_-8px_rgba(241,89,43,.6)]"
        style={{ background: "linear-gradient(135deg,#FF7A45 0%,#D8431A 100%)" }}
      >
        <XMark />
      </span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-ui-fg-base text-[30px] font-semibold leading-none tracking-tight">X-MAS</span>
        <span className="text-ui-fg-subtle txt-compact-small">Дэлгүүрийн удирдлагын самбар</span>
      </div>
      <span className="text-ui-fg-muted txt-compact-small">Үргэлжлүүлэхийн тулд нэвтэрнэ үү</span>
    </div>
  );
};

export const config = defineWidgetConfig({
  zone: "login.before",
});

export default LoginBrand;
