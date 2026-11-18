"use client";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { ClothingRailHero, type ClothingRailHeroProps, type RailGarment } from "@/components/ui/product-rail-gallery";
import { useLang } from "@/components/LangProvider";
import { localePath } from "@/lib/i18n";

/**
 * The hero rail, wired to the router.
 *
 * `HeroRail` is a server component and cannot hand the rail a click handler,
 * so this thin client layer exists to do one thing: send a click on a jacket
 * to that jacket's page. It used to lift the piece into a 3D view with a
 * "Дэлгэрэнгүй үзэх" button inside it — two more presses to reach the thing
 * the visitor had already pointed at.
 *
 * Hovering a piece prefetches its page, so by the time the click lands the
 * route is usually warm.
 */
export function HeroRailStage({
  items,
  hrefs,
  ...rest
}: Omit<ClothingRailHeroProps, "onItemActivate" | "onItemIntent"> & {
  items: RailGarment[];
  /** One path per item, in the same order. */
  hrefs: string[];
}) {
  const router = useRouter();
  const lang = useLang();
  // Prefetch once per piece; the rail fires hover on every pointer re-entry.
  const warmed = useRef<Set<string>>(new Set());

  const pathFor = useCallback((i: number) => {
    const href = hrefs[i];
    return href ? localePath(href, lang) : null;
  }, [hrefs, lang]);

  const warm = useCallback((i: number) => {
    const path = pathFor(i);
    if (!path || warmed.current.has(path)) return;
    warmed.current.add(path);
    try { router.prefetch(path); } catch { /* prefetch is a nicety, never a failure */ }
  }, [pathFor, router]);

  const go = useCallback((i: number) => {
    const path = pathFor(i);
    if (path) router.push(path);
  }, [pathFor, router]);

  return <ClothingRailHero {...rest} items={items} onItemActivate={go} onItemIntent={warm} />;
}
