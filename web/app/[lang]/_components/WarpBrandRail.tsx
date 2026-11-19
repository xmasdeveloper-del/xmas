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

/* The shop is white with one warm accent, and the ring has to belong to it:
 * pale cards with a breath of the shoe's own colour in them, ink copy, and the
 * price in the same accent the rest of the site prices things in. */
const INK = "#161515";
const ACCENT = "#F1592B";
const PAPER = "#FFFFFF";

/** A card's mesh gradient: paper, warmed by the product's own accent colour. */
function meshFor(accent: string | undefined, index: number): string[] {
  const ok = !!accent && /^#[0-9a-f]{6}$/i.test(accent);
  const base = ok ? accent! : TINTS[index % TINTS.length];
  const [r, g, b] = [1, 3, 5].map(i => parseInt(base.slice(i, i + 2), 16));
  // Towards white. A black sneaker's accent would otherwise make a grey slab,
  // so nothing on the card is ever darker than a light wash of its colour.
  const wash = (t: number) => {
    const f = (c: number) => Math.round(c + (255 - c) * t);
    return `#${[f(r), f(g), f(b)].map(c => c.toString(16).padStart(2, "0")).join("")}`;
  };
  // Light at the top where the title sits, more colour low down behind the
  // price — the card reads as paper catching the colour of the shoe. Pale
  // enough for ink copy, not so pale that it dissolves into a white page.
  return [PAPER, wash(0.9), wash(0.78), wash(0.66), wash(0.72), wash(0.8)];
}

// Used when a product carries no accent colour of its own.
const TINTS = ["#F1592B", "#2F6FD0", "#2E7D5B", "#6B4FA0", "#C08A2E", "#C8102E"];

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
      copy: "dark",
      // The price in the shop's accent, the way every other price is set.
      numeral: [ACCENT, "#D8431A"],
      accent: INK,
      // A warm wash on the stage above and below, rather than one glow per
      // product: seven different neons behind a white page is a fairground.
      glow: ACCENT,
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
      // The lens flare at full strength throws neon bars across both edges —
      // handsome on the component's own black stage, a fairground on a white
      // page. Turned down to a soft smear that still says "wide lens".
      warp={0.22}
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
