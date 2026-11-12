"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A thin bar across the top while a page is on its way.
 *
 * The shop page is rendered per request, so a brand in the nav takes the best
 * part of a second to come back — and until it did, absolutely nothing on the
 * screen changed: same URL, same list, no spinner. People read that as a dead
 * link and clicked again. This answers the click immediately.
 *
 * It watches clicks rather than the router so it needs no `useSearchParams`,
 * which would opt every page that renders the layout out of static rendering.
 */
export function NavProgress() {
  const [progress, setProgress] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

    const finish = () => {
      clear();
      setProgress(100);
      timers.current.push(window.setTimeout(() => setProgress(null), 220));
    };

    const start = (from: string) => {
      clear();
      setProgress(8);
      // Creep towards the end without ever claiming to have arrived.
      let at = 8;
      const creep = () => {
        at = at + Math.max(0.6, (88 - at) * 0.12);
        setProgress(Math.min(at, 88));
        timers.current.push(window.setTimeout(creep, 90));
      };
      timers.current.push(window.setTimeout(creep, 90));

      // Done when the address actually changes. Give up after ten seconds so a
      // click that never navigates can't leave the bar sitting there.
      const began = Date.now();
      const watch = () => {
        if (location.href !== from) { finish(); return; }
        if (Date.now() - began > 10_000) { finish(); return; }
        timers.current.push(window.setTimeout(watch, 60));
      };
      timers.current.push(window.setTimeout(watch, 60));
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      let url: URL;
      try { url = new URL(anchor.href, location.href); } catch { return; }
      if (url.origin !== location.origin) return;
      if (url.href === location.href) return;
      start(location.href);
    };

    // Capture, so the bar still starts for links whose own handler takes over
    // the navigation (and calls preventDefault) on the way back up.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", finish);
    return () => {
      clear();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", finish);
    };
  }, []);

  if (progress === null) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[3px]"
    >
      <div
        className="h-full bg-accent shadow-[0_0_10px_rgba(241,89,43,.7)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
      />
    </div>
  );
}
