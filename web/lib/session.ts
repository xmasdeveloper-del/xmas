// The customer's Medusa JWT lasts 24 hours. Nothing used to notice when it ran
// out: the name stayed in the nav, the account page kept its shape, and every
// signed-in action quietly came back 401 — which is how "Сэтгэгдэл бичихийн
// тулд нэвтэрнэ үү" ended up in front of someone who was, as far as the site
// had told them, signed in. These read the expiry so the storefront can keep
// the session alive while it still can, and be honest the moment it cannot.

/** Seconds-since-epoch the token expires at, or null if it says nothing. */
export function tokenExpiry(token: string | null | undefined): number | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base + "=".repeat((4 - (base.length % 4)) % 4);
    const exp = JSON.parse(atob(padded))?.exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

/** True once the token is past its expiry (or so close it is not worth using). */
export function isExpired(token: string | null | undefined, skewSeconds = 30): boolean {
  const exp = tokenExpiry(token);
  if (exp === null) return false; // unreadable → let the server be the judge
  return Date.now() / 1000 >= exp - skewSeconds;
}

/** Milliseconds left on the token; 0 when it is spent or unreadable. */
export function msRemaining(token: string | null | undefined): number {
  const exp = tokenExpiry(token);
  if (exp === null) return 0;
  return Math.max(0, exp * 1000 - Date.now());
}
