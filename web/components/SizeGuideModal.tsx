"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "./LangProvider";
import { useFocusTrap } from "@/lib/useFocusTrap";

// Sneaker size conversion (EU · US · UK · foot length cm). Demo reference chart,
// consistent across products. Values are approximate — brands vary slightly.
const ROWS: [string, string, string, string][] = [
  ["39", "6.5", "6", "24.5"],
  ["40", "7", "6.5", "25"],
  ["41", "8", "7", "26"],
  ["42", "8.5", "8", "26.5"],
  ["43", "9.5", "9", "27.5"],
  ["44", "10", "9.5", "28"],
  ["45", "11", "10.5", "29"],
];

export function SizeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  useFocusTrap(ref, open);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const id = setTimeout(() => closeRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // preventScroll: giving focus back must not move the page. The button
      // that opened this sits far down a long page, and when the overlay is
      // dismissed by navigating (quick view -> "view details"), React can hand
      // the same DOM node to the page that just arrived — so a plain focus()
      // dropped the shopper into the footer of a product page they had only
      // just opened.
      const back = lastFocused.current;
      if (back && back.isConnected) back.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[86] grid place-items-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            role="dialog" aria-modal="true" aria-label={t("common.sizeGuide")}
            className="relative w-[min(480px,96vw)] bg-white rounded-3xl shadow-deep p-6 sm:p-7"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-[20px] tracking-tight">{t("common.sizeGuide")}</h2>
              <button ref={closeRef} onClick={onClose} aria-label={t("common.close")}
                className="w-9 h-9 rounded-full grid place-items-center hover:bg-surface-2 text-xl leading-none">×</button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wide text-muted border-b border-line">
                  <th className="py-2 font-semibold num-tabular">{t("sg.eu")}</th>
                  <th className="py-2 font-semibold num-tabular">{t("sg.us")}</th>
                  <th className="py-2 font-semibold num-tabular">{t("sg.uk")}</th>
                  <th className="py-2 font-semibold num-tabular">{t("sg.cm")}</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([eu, us, uk, cm]) => (
                  <tr key={eu} className="border-b border-line last:border-none">
                    <td className="py-2.5 font-semibold num-tabular">{eu}</td>
                    <td className="py-2.5 num-tabular">{us}</td>
                    <td className="py-2.5 num-tabular">{uk}</td>
                    <td className="py-2.5 num-tabular">{cm}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="tiny mt-4">{t("sg.note")}</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
