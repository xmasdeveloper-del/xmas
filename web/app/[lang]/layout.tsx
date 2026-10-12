import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import "../fonts.css";
import { Toast } from "@/components/Toast";
import { MobileTabBar } from "@/components/MobileTabBar";
import { CartDrawer } from "@/components/CartDrawer";
import { QuickViewModal } from "@/components/QuickViewModal";
import { FlyLayer } from "@/components/FlyLayer";
import { SmoothScroll } from "@/components/SmoothScroll";
import { LangProvider } from "@/components/LangProvider";
import { Consent } from "@/components/Consent";
import { LOCALES, isLang, tFor } from "@/lib/i18n";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://xmas.mn"),
  // Tab label is the bare wordmark; the descriptive line lives in the
  // description and the Open Graph title, where search and link previews use it.
  title: "X-MAS",
  description: "Converse, UGG, The North Face — оригинал пүүз, гутал, куртик нэг дороос. QPay-ээр төлж, хурдан хүргүүлээрэй.",
  openGraph: {
    title: "X-MAS — Оригинал пүүз, гутал, куртик",
    description: "Converse, UGG, The North Face — оригинал пүүз, гутал, куртик нэг дороос.",
    type: "website",
    siteName: "X-MAS",
  },
};

// Pre-render both locales → static/ISR pages, no cookies() (fast LCP).
export function generateStaticParams() {
  return LOCALES.map(lang => ({ lang }));
}

// Fonts are self-hosted in public/fonts and declared in app/fonts.css. They
// used to come from next/font/google, which fetches them from Google during
// the production build — a transient failure there broke two deploys, so the
// build no longer touches the network for them.

export default function LangLayout({ children, params }: { children: React.ReactNode; params: { lang: string } }) {
  if (!isLang(params.lang)) notFound();
  const lang = params.lang;
  const t = tFor(lang);
  return (
    <html lang={lang}>
      <body className="font-sans pb-24 lg:pb-0">
        <a href="#main" className="skip-link">{t("a11y.skip")}</a>
        <LangProvider lang={lang}>
          <SmoothScroll />
          <main id="main">{children}</main>
          <Toast />
          <CartDrawer />
          <QuickViewModal />
          <FlyLayer />
          <MobileTabBar />
          <Consent />
        </LangProvider>
      </body>
    </html>
  );
}
