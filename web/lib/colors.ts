/**
 * Colour families for the shop filter.
 *
 * Every product carries its own accent, so the catalogue holds about as many
 * distinct colours as it holds products — 166 of them. Offering all of those
 * as swatches is a wall of dots where almost every one returns a single item,
 * which is not a filter, it is a list of products in disguise. Shoppers think
 * in a dozen colours, so the accents are grouped into those and the URL
 * carries the family name (`?color=black`) rather than a hex.
 */

export type ColorFamily =
  | "black" | "grey" | "white" | "beige" | "brown"
  | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";

/** Display order, with the swatch shown for each family. */
export const COLOR_FAMILIES: { key: ColorFamily; swatch: string }[] = [
  { key: "black", swatch: "#1A1A1A" },
  { key: "grey", swatch: "#9AA0A6" },
  { key: "white", swatch: "#F4F4F2" },
  { key: "beige", swatch: "#D9C3A5" },
  { key: "brown", swatch: "#7B4B2A" },
  { key: "red", swatch: "#C62828" },
  { key: "orange", swatch: "#F1592B" },
  { key: "yellow", swatch: "#E3B505" },
  { key: "green", swatch: "#2E7D4F" },
  { key: "blue", swatch: "#1F5FA9" },
  { key: "purple", swatch: "#7E57C2" },
  { key: "pink", swatch: "#E48AA8" },
];

const KEYS = new Set<string>(COLOR_FAMILIES.map(f => f.key));
export const isColorFamily = (v: string | undefined | null): v is ColorFamily =>
  !!v && KEYS.has(v.toLowerCase());

/** #abc / #aabbcc → [r, g, b] in 0–255, or null for anything else. */
function rgbOf(css: string): [number, number, number] | null {
  const v = css.trim();
  const hex = v.startsWith("#") ? v.slice(1) : null;
  if (hex && (hex.length === 3 || hex.length === 6)) {
    const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

/** Which family a CSS colour belongs to; null when it cannot be read. */
export function colorFamily(css: string | undefined | null): ColorFamily | null {
  if (!css) return null;
  const rgb = rgbOf(css);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(x => x / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (l <= 0.14) return "black";
  if (s < 0.12) return l >= 0.88 ? "white" : l >= 0.2 ? "grey" : "black";

  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;

  const warm = h >= 10 && h < 50;
  // A pale, soft warm tone is beige (sand, cream, oat); a dark one is brown.
  if (warm && s < 0.45 && l >= 0.62) return "beige";
  if (warm && l < 0.55) return "brown";
  if (h >= 50 && h < 70 && s < 0.35 && l < 0.5) return "brown"; // olive-ish khaki

  if (h < 10 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 255) return "blue";
  if (h < 300) return "purple";
  return "pink";
}

/** Does this product sit in the given family? Checks accent and colourways. */
export function productInFamily(
  p: { accent?: string; colors?: string[] },
  family: string,
): boolean {
  const want = family.toLowerCase();
  if (colorFamily(p.accent) === want) return true;
  return (p.colors ?? []).some(c => colorFamily(c) === want);
}
