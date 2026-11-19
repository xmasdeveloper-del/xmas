"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WarpCarousel, type WarpCard } from "@/components/ui/warp-carousel";
import { useLang } from "@/components/LangProvider";
import { localePath } from "@/lib/i18n";
import type { Product } from "@/lib/types";

/**
 * A brand's shelf as the warp ring: cards on a wide-lens carousel that turns
 * past the viewer, each one a real pair with its photograph, its name and its
 * price, and a press on the middle card opens it.
 *
 * The ring is drawn on a canvas, which is why the photographs are loaded here
 * and handed over as decoded images: the painter runs synchronously and would
 * otherwise draw a card with a blank space where the shoe should be. Until
 * they arrive the ring shows the cards without them, then repaints — nobody
 * waits on an empty section.
 */

const MAX_ON_RING = 8;
const nf = new Intl.NumberFormat("en-US");

/** A card's mesh gradient, built from the product's own accent colour. */
function meshFor(accent: string | undefined, index: number): string[] {
  const ok = !!accent && /^#[0-9a-f]{6}$/i.test(accent);
  // A black shoe carries a near-black accent, and a card built from one is a
  // black rectangle with no light in it. Below this much luminance the card
  // takes a colour of its own instead.
  const lum = ok
    ? (0.2126 * parseInt(accent!.slice(1, 3), 16) + 0.7152 * parseInt(accent!.slice(3, 5), 16) + 0.0722 * parseInt(accent!.slice(5, 7), 16)) / 255
    : 0;
  const base = ok && lum > 0.14 ? accent! : FALLBACK[index % FALLBACK.length];
  const [r, g, b] = [1, 3, 5].map(i => parseInt(base.slice(i, i + 2), 16));
  const mix = (t: number) => {
    // t < 0 towards black, t > 0 towards white — a ramp dark enough for white
    // type to sit on it and bright enough to read as lit.
    const f = (c: number) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t);
    return `#${[f(r), f(g), f(b)].map(c => c.toString(16).padStart(2, "0")).join("")}`;
  };
  return [mix(-0.82), mix(-0.6), mix(-0.3), base, mix(-0.45), mix(-0.72)];
}

// Used when a product carries no accent colour of its own.
const FALLBACK = ["#1f2a44", "#3b1f2b", "#143027", "#2d2340", "#3a2a16", "#102a3a"];

export function WarpBrandRail({
  products,
  label,
  background = "#ffffff",
}: {
  products: Product[];
  label: string;
  background?: string;
}) {
  const router = useRouter();
  const lang = useLang();
  const picks = useMemo(() => products.filter(p => p.image).slice(0, MAX_ON_RING), [products]);

  // Decoded photographs, by product id. A miss simply leaves that card plain.
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const seen = useRef<Set<string>>(new Set());

  // Alive for the component, not for one run of the effect. `products` is a
  // fresh array on every render of the page, so this effect re-runs often; a
  // per-run flag would mark the first run's loads as abandoned while `seen`
  // stopped the next run from starting them again, and no photo ever landed.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    for (const p of picks) {
      if (!p.image || seen.current.has(p.id)) continue;
      seen.current.add(p.id);
      const img = new Image();
      // Same-origin files under /products, but the canvas is read back into a
      // WebGL texture, so ask for CORS anyway: without it a cross-origin photo
      // would taint the canvas and the whole ring would go blank.
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      const done = () => {
        if (mounted.current && img.naturalWidth > 0) setImages(prev => (prev[p.id] ? prev : { ...prev, [p.id]: img }));
      };
      // Handlers before `src`, and a check straight after: a photo already in
      // the browser's cache finishes loading before a handler added afterwards
      // could ever hear about it, and the card would stay blank for good.
      img.onload = done;
      img.src = p.image;
      if (img.complete) done();
    }
  }, [picks]);

  const cards: WarpCard[] = useMemo(() => picks.map((p, i) => {
    // The brand on the first line, the model on the second. The painter does
    // not wrap, so a long model name is cut rather than run off the card.
    const model = p.name.replace(new RegExp(`^${p.category}\\s*`, "i"), "").trim() || p.name;
    const short = model.length > 24 ? `${model.slice(0, 23).trimEnd()}…` : model;
    return {
      title: `${p.category}\n${short}`,
      value: nf.format(Math.round(p.price)),
      unit: "₮",
      // No footer: the brand and model above the photo already name the pair,
      // and a third line only crowds the card.
      footer: undefined,
      detail: "none",
      image: images[p.id] ?? null,
      mesh: meshFor(p.accent, i),
      numeral: ["#ffffff", "#ffd9cc"],
      accent: p.accent || "#ffffff",
      glow: p.accent || "#c8102e",
    } satisfies WarpCard;
  }), [picks, images]);

  if (!picks.length) return null;

  return (
    <WarpCarousel
      cards={cards}
      ariaLabel={label}
      background={background}
      interval={4}
      step={1}
      onCardActivate={(i) => {
        const p = picks[i];
        if (p) router.push(localePath(`/product/${p.slug}`, lang));
      }}
      // The stage is 5:4 by default, which on a full-width section would be
      // taller than the window. Height is set here and the ring sizes itself.
      style={{ height: "clamp(420px, 44vw, 640px)", aspectRatio: "auto", minHeight: 0 }}
    />
  );
}
