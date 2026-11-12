"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { useUI, useQuickView } from "@/lib/store";

// Premium smooth scrolling (Lenis). Disabled entirely under reduced-motion, and
// paused while a full-height overlay is open so the background can't scroll.
export function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const cartOpen = useUI(s => s.cartOpen);
  const qvOpen = useQuickView(s => !!s.product);
  const pathname = usePathname();
  const firstPath = useRef(true);
  const wentBack = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Touch devices already have buttery native momentum scrolling; intercepting it
    // with JS only adds perceptible lag. Run Lenis on fine-pointer (desktop) only.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    // Premium glide: framerate-independent lerp smoothing (modern Lenis default
    // style) gives a soft, continuous deceleration that settles gracefully —
    // smoother than duration+easing, without feeling floaty or laggy.
    const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 1, smoothWheel: true });
    lenisRef.current = lenis;
    let raf = 0;
    const loop = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    // Smoothly glide to in-page anchors (#section) instead of the browser's instant jump.
    const onAnchorClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -80, duration: 1.4 });
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onAnchorClick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Back/forward is the one case where the router is right to restore a
  // position rather than go to the top.
  useEffect(() => {
    const onPop = () => { wentBack.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Lenis keeps its own idea of where the page is scrolled to, and nothing told
  // it about a route change: the router sets the window back to the top, then
  // Lenis's animation loop writes the previous page's offset straight back on
  // the next frame. Opening a product from halfway down the shop therefore
  // landed you in the footer. Put Lenis where the new page actually starts.
  useEffect(() => {
    if (firstPath.current) { firstPath.current = false; return; }
    const l = lenisRef.current;
    if (!l) return;

    if (wentBack.current) {
      wentBack.current = false;
      // Let the router restore its remembered offset first, then adopt it.
      const sync = () => l.scrollTo(window.scrollY, { immediate: true, force: true });
      requestAnimationFrame(() => requestAnimationFrame(sync));
      return;
    }

    // Hold the top for a few frames. A page that grows as its images and
    // in-view animations settle can otherwise drag the viewport down with it
    // right after the router put us at the top. Any scroll the visitor makes
    // themselves ends it immediately.
    let frames = 0;
    let raf = 0;
    const hold = () => {
      if (window.scrollY !== 0) { window.scrollTo(0, 0); l.scrollTo(0, { immediate: true, force: true }); }
      if (++frames < 6) raf = requestAnimationFrame(hold);
    };
    const release = () => { frames = 99; };
    window.addEventListener("wheel", release, { passive: true, once: true });
    window.addEventListener("touchstart", release, { passive: true, once: true });
    window.addEventListener("keydown", release, { once: true });

    window.scrollTo(0, 0);
    l.scrollTo(0, { immediate: true, force: true });
    raf = requestAnimationFrame(hold);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
    };
  }, [pathname]);

  useEffect(() => {
    const l = lenisRef.current;
    if (!l) return;
    if (cartOpen || qvOpen) l.stop(); else l.start();
  }, [cartOpen, qvOpen]);

  return null;
}
