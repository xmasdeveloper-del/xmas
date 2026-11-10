/* ---------------------------------------------------------------------------
 * Which language the admin opens in.
 *
 * Medusa's dashboard initialises i18next with its own language detector, which
 * reads, in order: the `lng` cookie, `localStorage.lng`, then the browser's
 * Accept-Language. It caches a chosen language back to the cookie and to
 * localStorage under that same key.
 *
 * Монгол is the default here, and it used to be set by the language-toggle
 * widget calling changeLanguage on mount. Two things were wrong with that:
 *
 *   - the widget is only mounted in `*.list.before` zones, so a hard load of
 *     an order's page, or of any of this admin's own pages (Тайлан, Касс,
 *     Зураг оруулах…), rendered with no widget at all — the detector fell
 *     through to the browser and the sidebar, the menus and every stock page
 *     came up in English;
 *   - it stored the choice under its own key, which the detector does not
 *     read, so the language was re-decided from scratch on every reload.
 *
 * Seeding `lng` before the dashboard initialises fixes both: the detector
 * finds Монгол by the route Medusa already intends, on every page, with no
 * component needing to have been rendered. Someone who switches to English
 * keeps English, because that is then what is stored under the same key.
 *
 * This module is imported by the toggle widget, so it is part of the admin
 * bundle and runs before React mounts anything.
 * ------------------------------------------------------------------------ */

/** The key Medusa's own language detector reads and writes. */
const KEY = "lng";

/** Where the toggle used to store the choice, before it used Medusa's key. */
const LEGACY = "xmas_admin_lang";

export const DEFAULT_LANG = "mn";

const normalise = (v: string | null | undefined) =>
  v && String(v).toLowerCase().startsWith("mn") ? "mn" : v ? "en" : null;

function cookieLang(): string | null {
  try {
    const hit = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${KEY}=`));
    return normalise(hit ? decodeURIComponent(hit.slice(KEY.length + 1)) : null);
  } catch {
    return null;
  }
}

function storedLang(key: string): string | null {
  try {
    return normalise(localStorage.getItem(key));
  } catch {
    return null; // private window, or site data blocked
  }
}

/** The language this machine has chosen, or null if it never has. */
export function chosenLanguage(): string | null {
  return cookieLang() || storedLang(KEY) || storedLang(LEGACY);
}

/** Remember a choice where both the detector and the next page load will see it. */
export function rememberLanguage(lang: string): void {
  const want = lang.startsWith("mn") ? "mn" : "en";
  try {
    localStorage.setItem(KEY, want);
    localStorage.removeItem(LEGACY);
  } catch {
    /* ignore */
  }
  try {
    // A year, on the admin's own path. The detector prefers the cookie.
    document.cookie = `${KEY}=${want};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* ignore */
  }
}

/**
 * Seed Монгол when this machine has never chosen. Called at module load, which
 * is before the dashboard's i18next init runs, so the detector simply finds it.
 */
export function seedDefaultLanguage(): void {
  if (typeof window === "undefined") return;
  if (chosenLanguage()) return;
  rememberLanguage(DEFAULT_LANG);
}

seedDefaultLanguage();
