// Keep a cashier in the POS and nowhere else.
//
// Medusa drops every fresh session on /app/orders, and a cashier has no
// business on that page — or on any other admin page. The POS screen itself
// already covers the admin chrome (fixed inset-0), so once they are on it they
// see one thing and cannot click away; this is what gets them there, and what
// bounces them back if they type another /app URL by hand.
//
// The server is the actual control (see lib/rbac — cashierVerdict). This is the
// UI half: without it a cashier lands on a stranded empty page instead of their
// till.
//
// Imported for its side effect by the POS route, which the admin bundles
// eagerly to build its sidebar — so this runs once at app start whatever page
// is open.

const POS_PATH = "/app/offline-sale";
const ADMIN_ROOT = "/app";

// undefined = not looked up yet, null = unknown / signed out.
let cachedRole: string | null | undefined;

async function currentRole(): Promise<string | null> {
  if (cachedRole !== undefined) return cachedRole;
  try {
    const res = await fetch("/admin/users/me", {
      credentials: "include",
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) {
      // Signed out, or the lookup is blocked — either way, do not redirect.
      cachedRole = null;
      return cachedRole;
    }
    const { user } = await res.json();
    cachedRole = (user?.metadata?.role as string) ?? null;
  } catch {
    cachedRole = null;
  }
  return cachedRole;
}

async function keepCashierHome(): Promise<void> {
  const path = window.location.pathname;
  // Already home, or not in the admin at all (the login screen included).
  if (path === POS_PATH || path.startsWith(POS_PATH + "/")) return;
  if (!path.startsWith(ADMIN_ROOT)) return;
  if ((await currentRole()) !== "cashier") return;
  // replace(), not assign(): the page they were sent away from should not sit
  // in history for the back button to land on.
  window.location.replace(POS_PATH);
}

if (typeof window !== "undefined") {
  const check = () => { void keepCashierHome(); };
  check();

  // The admin is a single-page app, so a sidebar click changes the URL without
  // reloading. Watch both directions of history.
  window.addEventListener("popstate", check);
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function patched(this: History, ...args: unknown[]) {
      const result = (original as (...a: unknown[]) => unknown).apply(this, args);
      check();
      return result;
    } as typeof history.pushState;
  }
}

export {};
