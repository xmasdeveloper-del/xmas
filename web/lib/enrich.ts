import type { Category, Shape } from "./types";

/**
 * Presentation metadata keyed by Medusa product handle.
 * Medusa is the source of truth for catalog, price, image and availability;
 * these fields enrich the storefront UX (accent, badge, specs). Ratings are NOT
 * here — they are computed from real customer reviews.
 */
export type Enrich = {
  category: Category;
  shape: Shape;
  gender: "Men" | "Women" | "Unisex";
  season: "Winter" | "Summer" | "All-Season";
  accent: string;
  fabric: string; // sneaker type: Canvas, Suede, Retro, Platform, Running
  colors: string[];
  bullets: string[];
  specs: Record<string, string>;
  badge?: "Sale" | "New" | null;
  wasMultiplier?: number; // original price = price * multiplier
};

// Generic copy keyed by sneaker type — keeps 30 entries concise.
const BULLETS: Record<string, string[]> = {
  Canvas: ["Оригинал Converse", "Даавуун гадаргуу", "Сонгодог силуэт"],
  Suede: ["Оригинал Converse", "Suede гадаргуу", "Street силуэт"],
  Retro: ["Оригинал Converse", "Retro гүйлтийн силуэт", "Gum тал улавчтай"],
  Platform: ["Оригинал Converse", "Өндөрсгөсөн platform тал улавч", "Bold силуэт"],
  Running: ["Оригинал New Balance", "N-ergy дэрлэг", "Y2K гүйлтийн силуэт"],
};
const SPECS: Record<string, Record<string, string>> = {
  Canvas: { "Брэнд": "Converse", "Гадна": "Даавуу", "Тал улавч": "Резин" },
  Suede: { "Брэнд": "Converse", "Гадна": "Suede", "Тал улавч": "Резин" },
  Retro: { "Брэнд": "Converse", "Төрөл": "Retro trainer", "Тал улавч": "Gum резин" },
  Platform: { "Брэнд": "Converse", "Гадна": "Даавуу", "Тал улавч": "Platform резин" },
  Running: { "Брэнд": "New Balance", "Загвар": "1906A", "Дэрлэг": "N-ergy" },
};

const e = (
  category: Category, shape: Shape, accent: string, fabric: string,
  extra: Partial<Enrich> = {},
): Enrich => ({
  category, shape, gender: "Unisex", season: "All-Season", accent, fabric,
  colors: [accent], badge: null,
  bullets: BULLETS[fabric], specs: SPECS[fabric], ...extra,
});

const CV = "Converse" as const;
const NBB = "New Balance" as const;

// UGG helper — winter footwear. Brand-correct bullets/specs are generated from
// the material label so we don't collide with the sneaker BULLETS/SPECS maps.
// Default gender Women / season Winter; override via `extra`.
const u = (
  shape: Shape, accent: string, fabric: string,
  extra: Partial<Enrich> = {},
): Enrich => ({
  category: "UGG", shape, gender: "Women", season: "Winter", accent, fabric,
  colors: [accent], badge: null,
  bullets: ["Оригинал UGG", `${fabric} гадаргуу`, "Хонины арьсан дулаалгатай"],
  specs: { "Брэнд": "UGG", "Гадна": fabric, "Дотор": "Хонины арьс/ноос" },
  ...extra,
});

// The North Face helper — down outerwear. Default gender Unisex / season Winter.
const t = (
  shape: Shape, accent: string, fabric: string,
  extra: Partial<Enrich> = {},
): Enrich => ({
  category: "The North Face", shape, gender: "Unisex", season: "Winter", accent, fabric,
  colors: [accent], badge: null,
  bullets: ["Оригинал The North Face", "700-fill хөвөн дүүргэгч", "Усны хальсан гадаргуу"],
  specs: { "Брэнд": "The North Face", "Дүүргэгч": "Down 700-fill", "Загвар": fabric },
  ...extra,
});

// Silhouette copy, so a new brand needs no new BULLETS/SPECS entry.
const SHAPE_NOTE: Record<Shape, string> = {
  runner: "Гүйлтийн силуэт", trail: "Бартаат замын барьц", lowtop: "Намхан хийц",
  hightop: "Өндөр хийц", chunky: "Зузаан тал улавч", skate: "Скейт хийц",
  slide: "Задгай шаахай", boot: "Өвлийн гутал", slipper: "Гэрийн шаахай",
  clog: "Ар нь задгай", sneaker: "Өдөр тутмын пүүз", jacket: "Богино куртик",
  parka: "Урт парка", bag: "Өдөр тутмын багтаамж",
};
const SHAPE_KIND: Record<Shape, string> = {
  runner: "Гүйлтийн пүүз", trail: "Trail пүүз", lowtop: "Намхан пүүз",
  hightop: "Өндөр пүүз", chunky: "Chunky пүүз", skate: "Скейт пүүз",
  slide: "Шаахай", boot: "Гутал", slipper: "Гэрийн шаахай", clog: "Clog",
  sneaker: "Пүүз", jacket: "Куртик", parka: "Парка", bag: "Үүргэвч",
};

/** Generic entry — works for any brand; bag shapes carry no size options. */
const n = (
  category: Category, shape: Shape, accent: string, material: string,
  extra: Partial<Enrich> = {},
): Enrich => ({
  category, shape, gender: "Unisex", season: "All-Season", accent, fabric: material,
  colors: [accent], badge: null,
  bullets: [`Оригинал ${category}`, `${material} гадаргуу`, SHAPE_NOTE[shape]],
  specs: { "Брэнд": category, "Гадна": material, "Төрөл": SHAPE_KIND[shape] },
  ...extra,
});

export const ENRICH: Record<string, Enrich> = {
  // Converse — Chuck 70 Hi
  "converse-chuck70-hi-black": e(CV, "hightop", "#111111", "Canvas"),
  // Converse — Chuck Low
  "converse-chuck-low-blue-check": e(CV, "lowtop", "#2233AA", "Canvas", { badge: "New" }),
  // Converse — Platform
  "converse-chuck-low-black-stars": e(CV, "chunky", "#141414", "Platform"),
  // Converse — One Star / Star Player (suede)
  "converse-star-player-burgundy": e(CV, "lowtop", "#6B2233", "Suede"),
  // Converse — Suede low / futsal
  "converse-suede-low-black": e(CV, "lowtop", "#151515", "Suede"),
  // Converse — Retro trainer
  "converse-retro-trainer-burgundy": e(CV, "runner", "#6B2233", "Retro"),
  // New Balance 1906A (on sale: 359,000 → 250,000)

  // ── UGG — winter boots, platforms, puffers, sneakers & slippers ──
  "ugg-classic-knit-aztec": u("boot", "#8A5A3B", "Нэхмэл", { badge: "New" }),
  "ugg-platform-mini-sage": u("boot", "#8E8C6D", "Suede"),
  "ugg-leather-heel-boot-black": u("boot", "#1A1A1A", "Арьс", { badge: "New" }),
  "ugg-platform-clog-chestnut": u("clog", "#B5712C", "Suede"),
  "ugg-sneaker-boot-black": u("sneaker", "#171717", "Suede", { gender: "Unisex" }),
  "ugg-sweater-knit-tall-sand": u("boot", "#D8C3A5", "Нэхмэл"),
  "ugg-sweater-knit-tall-black": u("boot", "#1C1C1C", "Нэхмэл"),
  "ugg-sweater-knit-tall-chocolate": u("boot", "#5A3A2E", "Нэхмэл"),
  "ugg-ultra-mini-chestnut": u("boot", "#B5712C", "Suede", { gender: "Unisex" }),
  "ugg-mini-fairisle-chestnut": u("boot", "#BE7A38", "Suede", { badge: "New" }),
  "ugg-tazz-chestnut": u("clog", "#B06A2E", "Suede"),
  "ugg-puffer-mini-white": u("boot", "#EDE7DD", "Куртик"),
  "ugg-puffer-mini-black": u("boot", "#141414", "Куртик"),
  "ugg-puffer-mini-sand": u("boot", "#CBB393", "Куртик"),
  "ugg-lowmel-sneaker-chestnut": u("sneaker", "#9C6B3F", "Suede", { gender: "Unisex", badge: "New" }),
  "ugg-lowmel-sneaker-pink": u("sneaker", "#C98BB0", "Suede"),
  "ugg-lowmel-sneaker-sand": u("sneaker", "#CBB393", "Suede", { gender: "Unisex" }),
  "ugg-lowmel-sneaker-black": u("sneaker", "#1A1A1A", "Suede", { gender: "Unisex" }),
  "ugg-lowmel-sneaker-cow": u("sneaker", "#6B4A33", "Үслэг", { badge: "New" }),
  "ugg-lowmel-sneaker-black-leather": u("sneaker", "#141414", "Арьс", { gender: "Unisex" }),
  "ugg-leather-laceup-brown": u("boot", "#5A3D27", "Арьс", { gender: "Men" }),
  "ugg-weather-mini-chestnut": u("boot", "#B06A2E", "Suede", { gender: "Unisex" }),
  "ugg-classic-mini-chocolate": u("boot", "#5A4438", "Suede", { gender: "Unisex" }),
  "ugg-classic-mini-chestnut": u("boot", "#B5712C", "Suede", { gender: "Unisex" }),
  "ugg-classic-mini-black": u("boot", "#141414", "Suede", { gender: "Unisex" }),
  "ugg-tasman-fluff-chestnut": u("clog", "#B06A2E", "Suede"),
  "ugg-tasman-fluff-taupe": u("clog", "#A99685", "Suede"),
  "ugg-weather-mini-black": u("boot", "#161616", "Suede", { gender: "Unisex" }),
  "ugg-weather-hybrid-chestnut": u("boot", "#B06A2E", "Suede", { gender: "Unisex" }),
  "ugg-sweater-knit-tall-pink": u("boot", "#E3A9BE", "Нэхмэл", { badge: "New" }),
  "ugg-tasman-clog-pink": u("clog", "#E59BB5", "Suede"),
  "ugg-ultra-mini-sand": u("boot", "#C3B18C", "Suede", { gender: "Unisex" }),
  "ugg-cozy-slipper-dark-brown": u("slipper", "#4A3528", "Suede", { gender: "Unisex" }),
  "ugg-cozy-slipper-taupe": u("slipper", "#9E8B78", "Suede", { gender: "Unisex" }),
  "ugg-hiker-tassel-olive": u("boot", "#6A6A47", "Suede", { badge: "New" }),
  "ugg-tasman-chestnut": u("clog", "#B06A2E", "Suede", { gender: "Unisex" }),
  "ugg-moc-laceup-chestnut": u("sneaker", "#A96B38", "Suede", { gender: "Unisex" }),

  // ── The North Face — 1996 Nuptse puffers, cropped & long down parkas ──
  "tnf-nuptse-blush-black": t("jacket", "#E9C9C5", "1996 Nuptse", { gender: "Women", badge: "New" }),
  "tnf-nuptse-olive-black": t("jacket", "#6B7445", "1996 Nuptse", { gender: "Men" }),
  "tnf-nuptse-ivory-black": t("jacket", "#EDE8DB", "1996 Nuptse"),
  "tnf-nuptse-cream-camel": t("jacket", "#D9C7A0", "1996 Nuptse"),
  "tnf-nuptse-cropped-charcoal": t("jacket", "#2B2B2E", "Cropped Nuptse", { gender: "Women", badge: "New" }),
  "tnf-nuptse-cropped-burgundy": t("jacket", "#5A2A33", "Cropped Nuptse", { gender: "Women" }),
  "tnf-nuptse-graphite-patch": t("jacket", "#4A4F55", "1996 Nuptse Patch"),
  "tnf-nuptse-ice-blue-patch": t("jacket", "#BFD6E8", "1996 Nuptse Patch", { badge: "New" }),
  "tnf-nuptse-pale-sage-patch": t("jacket", "#C6CDB4", "1996 Nuptse Patch"),
  "tnf-nuptse-dusty-rose": t("jacket", "#C98A86", "1996 Nuptse", { gender: "Women" }),
  "tnf-nuptse-purple-black": t("jacket", "#5B2A9E", "1996 Nuptse"),
  "tnf-nuptse-navy-black": t("jacket", "#34425F", "1996 Nuptse", { gender: "Men" }),
  "tnf-nuptse-emerald-black": t("jacket", "#1E7A4D", "1996 Nuptse", { gender: "Men" }),
  "tnf-nuptse-charcoal-black": t("jacket", "#36393D", "1996 Nuptse"),
  "tnf-nuptse-orange-black": t("jacket", "#F0531C", "1996 Nuptse", { gender: "Men", badge: "New" }),
  "tnf-long-parka-ivory": t("parka", "#ECE9E0", "Himalayan Parka", { gender: "Women" }),
  "tnf-long-parka-cream-camel": t("parka", "#D8C49B", "Himalayan Parka"),
  "tnf-long-parka-navy": t("parka", "#2B3147", "Himalayan Parka", { gender: "Men" }),
  "tnf-long-parka-rose-brown": t("parka", "#B5745F", "Himalayan Parka", { gender: "Women" }),
  "tnf-nuptse-teal-petrol": t("jacket", "#1F8FB0", "1996 Nuptse"),
  "tnf-nuptse-cropped-ivory": t("jacket", "#E7DFCD", "Cropped Nuptse", { gender: "Women", badge: "New" }),

  // Converse — added Oct 2026
  "converse-one-star-ox-white-red":          n("Converse", "lowtop", "#D6202F", "Suede"),
  "converse-chuck70-hi-sky-blue":            n("Converse", "hightop", "#8EC5E6", "Canvas"),
  "converse-chuck-low-floral-print":         n("Converse", "lowtop", "#C8BFD6", "Canvas", { gender: "Women", season: "Summer" }),
  "converse-chuck-low-navy-print":           n("Converse", "lowtop", "#2A3147", "Canvas"),
  "converse-chuck70-hi-forest-green":        n("Converse", "hightop", "#1F5B43", "Canvas"),
  "converse-chuck-hi-burgundy":              n("Converse", "hightop", "#6E1F2B", "Canvas"),
  "converse-chuck70-hi-maroon":              n("Converse", "hightop", "#7A2434", "Canvas"),
  "converse-chuck70-hi-black-egret":         n("Converse", "hightop", "#161616", "Canvas"),
  "converse-chuck70-hi-chocolate":           n("Converse", "hightop", "#4A2F26", "Canvas"),
  "converse-chuck-hi-cream":                 n("Converse", "hightop", "#EFE7D7", "Canvas"),
  "converse-chuck-hi-charcoal":              n("Converse", "hightop", "#4B4B4D", "Canvas"),
  "converse-chuck70-hi-olive":               n("Converse", "hightop", "#5A5A32", "Canvas"),
  "converse-hello-kitty-one-star-red":       n("Converse", "lowtop", "#E23B49", "Suede", { gender: "Women" }),
  "converse-hello-kitty-low-black":          n("Converse", "lowtop", "#1A1A1A", "Canvas", { gender: "Women" }),
  "converse-one-star-suede-navy":            n("Converse", "lowtop", "#3A3E63", "Suede"),
  "converse-chuck-low-pink-fade":            n("Converse", "lowtop", "#E8B4C8", "Canvas", { gender: "Women", season: "Summer" }),
  "converse-chuck-low-vintage-white":        n("Converse", "lowtop", "#E3DDCE", "Canvas"),
  "converse-chuck70-hi-grey-wash":           n("Converse", "hightop", "#6E737B", "Canvas"),
  "converse-one-star-low-navy":              n("Converse", "lowtop", "#1C2340", "Suede"),
  "converse-chuck-low-mocha":                n("Converse", "lowtop", "#8A6C5C", "Canvas"),
  "converse-chuck70-hi-star-black":          n("Converse", "hightop", "#141414", "Canvas"),
  "converse-chuck70-hi-metallic":            n("Converse", "hightop", "#A8A9AD", "Canvas", { gender: "Women" }),
  "converse-chuck-hi-white-grey":            n("Converse", "hightop", "#D8D8D4", "Canvas"),
  "converse-chuck-hi-daisy-sky":             n("Converse", "hightop", "#AFD3EA", "Canvas", { gender: "Women", season: "Summer" }),
  "converse-chuck-hi-daisy-white":           n("Converse", "hightop", "#F0EDE4", "Canvas", { gender: "Women", season: "Summer" }),
  "converse-chuck-hi-pink-platform":         n("Converse", "chunky", "#E9C3CE", "Platform", { gender: "Women" }),
  "converse-chuck-low-lilac":                n("Converse", "lowtop", "#C6A8D4", "Canvas", { gender: "Women", season: "Summer" }),
  "converse-one-star-platform-mustard":      n("Converse", "chunky", "#C9971F", "Suede", { gender: "Women" }),
  "converse-chuck-low-black-slip":           n("Converse", "lowtop", "#1B1B1B", "Canvas"),
  "converse-chuck70-hi-white-stud":          n("Converse", "hightop", "#F2F2EE", "Canvas", { gender: "Women" }),
  "converse-chuck-hi-caramel":               n("Converse", "hightop", "#B5712F", "Canvas"),
  "converse-chuck70-hi-classic-black":       n("Converse", "hightop", "#121212", "Canvas"),
  "converse-hello-kitty-low-pink":           n("Converse", "lowtop", "#E86C8E", "Canvas", { gender: "Women" }),
  "converse-chuck-hi-natural":               n("Converse", "hightop", "#E8E2D4", "Canvas"),
  "converse-chuck70-deluxe-black":           n("Converse", "chunky", "#171717", "Platform"),
  "converse-chuck70-deluxe-grey":            n("Converse", "chunky", "#8C8C8C", "Platform"),
  "converse-chuck70-hi-red":                 n("Converse", "hightop", "#C8202C", "Canvas"),
  "converse-chuck70-hi-sand":                n("Converse", "hightop", "#D9C9A8", "Canvas"),
  "converse-chuck70-hi-coral":               n("Converse", "hightop", "#E2645E", "Canvas", { gender: "Women", season: "Summer" }),
  "converse-chuck70-hi-pistachio":           n("Converse", "hightop", "#B8C87E", "Canvas", { season: "Summer" }),
  "converse-chuck70-hi-lilac":               n("Converse", "hightop", "#BFA9DD", "Canvas", { gender: "Women", season: "Summer" }),
  "converse-chuck70-hi-cobalt":              n("Converse", "hightop", "#2B4CC4", "Canvas"),
  "converse-chuck70-hi-utility-black":       n("Converse", "hightop", "#1C1C1C", "Canvas", { season: "Winter" }),
  "converse-one-star-low-black":             n("Converse", "lowtop", "#131313", "Suede"),
  "converse-one-star-ox-black":              n("Converse", "lowtop", "#101010", "Suede"),
  "converse-one-star-low-cream":             n("Converse", "lowtop", "#EDE4D6", "Suede", { gender: "Women" }),
  "converse-one-star-low-black-stars":       n("Converse", "lowtop", "#151515", "Suede"),
  "converse-one-star-pro-red":               n("Converse", "lowtop", "#C01F2E", "Suede", { gender: "Women" }),
  "converse-one-star-pro-pink":              n("Converse", "lowtop", "#E7B9C9", "Suede", { gender: "Women", season: "Summer" }),
  "converse-backpack-navy":                  n("Converse", "bag", "#243356", "Nylon"),
  "converse-flap-bag-black-white":           n("Converse", "bag", "#1D1D1D", "Nylon"),
  "converse-backpack-black":                 n("Converse", "bag", "#141414", "Nylon"),
  "converse-backpack-white":                 n("Converse", "bag", "#F1F1EF", "Nylon"),
  "converse-backpack-black-street":          n("Converse", "bag", "#1A1A1A", "Nylon"),
  "converse-backpack-blue":                  n("Converse", "bag", "#5B86C4", "Nylon"),
  "converse-backpack-red":                   n("Converse", "bag", "#D52B28", "Nylon"),
  "converse-backpack-pink":                  n("Converse", "bag", "#E99CA6", "Nylon", { gender: "Women" }),
  "converse-backpack-orange":                n("Converse", "bag", "#E8821F", "Nylon"),

  // Nike — added Oct 2026
  "nike-pegasus-white-orange":               n("Nike", "runner", "#E8552E", "Running"),
  "nike-metcon-brown":                       n("Nike", "runner", "#4A3A2E", "Training", { gender: "Men" }),
  "nike-metcon-red":                         n("Nike", "runner", "#C62434", "Training", { gender: "Men" }),
  "nike-metcon-black":                       n("Nike", "runner", "#151515", "Training", { gender: "Men" }),
  "nike-court-white":                        n("Nike", "lowtop", "#EFEFEA", "Leather"),
  "nike-air-max-black":                      n("Nike", "chunky", "#1A1A1A", "Running"),
  "nike-air-max-white":                      n("Nike", "chunky", "#F2F2F0", "Running"),
  "nike-structure-black":                    n("Nike", "runner", "#17181A", "Running"),
  "nike-air-force-1-black":                  n("Nike", "lowtop", "#121212", "Leather"),
  "nike-air-force-1-white":                  n("Nike", "lowtop", "#F4F4F2", "Leather"),
  "nike-acg-boot-black-teal":                n("Nike", "boot", "#17A2B8", "Gore-Tex", { season: "Winter" }),
  "nike-acg-boot-olive":                     n("Nike", "boot", "#6B6240", "Gore-Tex", { season: "Winter" }),

  // New Balance — added Oct 2026
  "nb-530-black":                            n("New Balance", "runner", "#161616", "Running"),
  "nb-530-white-navy":                       n("New Balance", "runner", "#2C3E63", "Running"),
  "nb-530-silver":                           n("New Balance", "runner", "#C4C7CC", "Running"),
  "nb-9060-black":                           n("New Balance", "chunky", "#141414", "Running"),
  "nb-9060-grey":                            n("New Balance", "chunky", "#6F7176", "Running"),
  "nb-1906-check":                           n("New Balance", "chunky", "#3A3A3C", "Running"),

  // ASICS — added Oct 2026
  "asics-gel-kayano-silver":                 n("ASICS", "runner", "#B9BEC4", "Running"),
  "asics-gel-nyc-black":                     n("ASICS", "runner", "#1B1B1D", "Running"),

  // Salomon — added Oct 2026
  "salomon-xt6-black":                       n("Salomon", "trail", "#161618", "Gore-Tex"),
  "salomon-xt6-silver":                      n("Salomon", "trail", "#9EA3A8", "Gore-Tex"),

  // The North Face — added Oct 2026
  "tnf-vectiv-trail-navy":                   n("The North Face", "trail", "#2B3A5C", "Vectiv"),
  "tnf-vectiv-run-navy":                     n("The North Face", "runner", "#1F2B4A", "Vectiv"),
  "tnf-verto-boot-black":                    n("The North Face", "boot", "#121212", "Gore-Tex", { season: "Winter" }),
  "tnf-verto-boot-grey":                     n("The North Face", "boot", "#5A5E63", "Gore-Tex", { season: "Winter" }),
  "tnf-vectiv-trail-rust":                   n("The North Face", "trail", "#B85A2B", "Vectiv"),

  // UGG — added Oct 2026
  "ugg-classic-knit-tall-black":             n("UGG", "boot", "#141414", "Нэхмэл + арьс", { gender: "Women", season: "Winter" }),
  "ugg-alpine-tassel-black":                 n("UGG", "boot", "#1A1A1A", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-fluff-slipper-chestnut":              n("UGG", "slipper", "#C08A52", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-droplet-boot-black":                  n("UGG", "boot", "#151515", "Усны хальс", { gender: "Women", season: "Winter" }),
  "ugg-classic-tall-chestnut":               n("UGG", "boot", "#B5793F", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-classic-short-sand":                  n("UGG", "boot", "#E0D5BE", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-tazz-platform-chestnut":              n("UGG", "clog", "#B87B46", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-tazz-burgundy":                       n("UGG", "clog", "#6B3330", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-neumel-black":                        n("UGG", "boot", "#161616", "Suede", { gender: "Men", season: "Winter" }),
  "ugg-classic-mini-dark-brown":             n("UGG", "boot", "#4F3326", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-classic-mini-platform-chestnut":      n("UGG", "boot", "#BE8049", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-classic-mini-platform-black":         n("UGG", "boot", "#121212", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-classic-mini-platform-sand":          n("UGG", "boot", "#DCCDB4", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-classic-mini-ii-chestnut":            n("UGG", "boot", "#C08449", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-classic-mini-ii-black":               n("UGG", "boot", "#141414", "Suede", { gender: "Women", season: "Winter" }),
  "ugg-shearling-platform-chestnut":         n("UGG", "boot", "#C58A50", "Shearling", { gender: "Women", season: "Winter" }),

  // Christian Dior — added Oct 2026
  "dior-quilted-rider-boot-black":           n("Christian Dior", "boot", "#111111", "Leather", { gender: "Women", season: "Winter" }),
};

export const DEFAULT_ENRICH: Enrich = {
  category: "Converse", shape: "lowtop", gender: "Unisex", season: "All-Season", accent: "#151515",
  fabric: "Canvas", colors: ["#151515"], badge: null,
  bullets: BULLETS.Canvas, specs: SPECS.Canvas,
};

/**
 * Presentation defaults for a product that has no hand-written ENRICH entry —
 * i.e. anything the shop adds from the admin from now on.
 *
 * ENRICH covers exactly the products that were seeded. Product 167 used to fall
 * straight to DEFAULT_ENRICH and appear as a black unisex canvas Converse
 * low-top whatever it actually was: a UGG boot would show Converse specs, sit
 * in the wrong gender filter, and carry the wrong accent colour — and the owner
 * had no way to correct any of it without a developer editing this file.
 *
 * Deriving from the brand category (which the owner DOES choose in the admin)
 * makes a new product look right by default. `metadata` on the Medusa product
 * then allows per-product overrides — see applyMetadataEnrich.
 */
export function defaultEnrichFor(category: Category): Enrich {
  const base = (
    shape: Shape, accent: string, fabric: string,
    gender: Enrich["gender"], season: Enrich["season"],
    bullets: string[], specs: Record<string, string>,
  ): Enrich => ({
    category, shape, gender, season, accent, fabric,
    colors: [accent], badge: null, bullets, specs,
  });

  switch (category) {
    case "UGG":
      return base("boot", "#8A5A3B", "Арьс", "Women", "Winter",
        ["Оригинал UGG", "Арьсан гадаргуу", "Хонины ноосон дулаалгатай"],
        { "Брэнд": "UGG", "Гадна": "Арьс", "Улирал": "Өвөл" });
    case "The North Face":
      return base("boot", "#1A1A1A", "Nylon", "Unisex", "Winter",
        ["Оригинал The North Face", "Салхи, усны хамгаалалттай", "Өвлийн дулаалга"],
        { "Брэнд": "The North Face", "Гадна": "Nylon", "Улирал": "Өвөл" });
    case "Nike":
      return base("runner", "#111111", "Running", "Unisex", "All-Season",
        ["Оригинал Nike", "Хөнгөн дэрлэг", "Өдөр тутмын хэрэглээнд"],
        { "Брэнд": "Nike", "Төрөл": "Sneaker", "Тал улавч": "Резин" });
    case "New Balance":
      return base("runner", "#9A9A9A", "Running", "Unisex", "All-Season",
        BULLETS.Running, SPECS.Running);
    case "ASICS":
      return base("runner", "#2A3B6B", "Running", "Unisex", "All-Season",
        ["Оригинал ASICS", "GEL дэрлэг", "Гүйлтийн силуэт"],
        { "Брэнд": "ASICS", "Төрөл": "Running", "Дэрлэг": "GEL" });
    case "Salomon":
      return base("trail", "#2F4F3A", "Trail", "Unisex", "All-Season",
        ["Оригинал Salomon", "Trail гадаргуунд", "Бэхлэгч Quicklace"],
        { "Брэнд": "Salomon", "Төрөл": "Trail", "Тал улавч": "Contagrip" });
    case "Christian Dior":
      return base("lowtop", "#6B2233", "Арьс", "Unisex", "All-Season",
        ["Оригинал Dior", "Арьсан гадаргуу", "Luxury силуэт"],
        { "Брэнд": "Dior", "Гадна": "Арьс" });
    case "Converse":
    default:
      return { ...DEFAULT_ENRICH, category };
  }
}

/** A 3/6-digit hex colour, or null. Keeps admin input out of the style attribute. */
function hexColor(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : null;
}

/**
 * Let the shop steer presentation from the admin. Any of these keys set in a
 * Medusa product's `metadata` wins over the derived defaults, so the owner can
 * fix an accent colour or move a product into the men's filter themselves
 * instead of filing a code change.
 *
 *   accent  "#6B2233"        gender  "Men" | "Women" | "Unisex"
 *   season  "Winter" | "Summer" | "All-Season"
 *   shape   "boot" | "runner" | …     badge  "Sale" | "New"
 */
export function applyMetadataEnrich(base: Enrich, metadata: Record<string, any> | null | undefined): Enrich {
  if (!metadata) return base;
  const out: Enrich = { ...base };

  const accent = hexColor(metadata.accent);
  if (accent) { out.accent = accent; out.colors = [accent]; }

  const gender = String(metadata.gender ?? "");
  if (gender === "Men" || gender === "Women" || gender === "Unisex") out.gender = gender;

  const season = String(metadata.season ?? "");
  if (season === "Winter" || season === "Summer" || season === "All-Season") out.season = season;

  const shape = String(metadata.shape ?? "");
  if (shape) out.shape = shape as Shape;

  const badge = String(metadata.badge ?? "");
  if (badge === "Sale" || badge === "New") out.badge = badge;

  return out;
}
