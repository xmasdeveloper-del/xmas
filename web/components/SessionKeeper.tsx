"use client";
import { useEffect, useRef } from "react";
import { useAuth, useToast } from "@/lib/store";
import { useT } from "./LangProvider";
import { api } from "@/lib/api";
import { isExpired, msRemaining } from "@/lib/session";

// Medusa hands a customer a token that lasts 24 hours, and nothing renewed it.
// Come back the next day and the site still greeted you by name while every
// signed-in action — leaving a review above all — answered 401. This renews
// the token while it is still alive, and signs the shopper out honestly when
// it is not, instead of letting them find out from a form that refuses them.
export function SessionKeeper() {
  const token = useAuth(s => s.token);
  const user = useAuth(s => s.user);
  const remember = useAuth(s => s.remember);
  const setSession = useAuth(s => s.setSession);
  const signOut = useAuth(s => s.signOut);
  const showToast = useToast(s => s.show);
  const t = useT();
  const busy = useRef(false);

  useEffect(() => {
    if (!token || !user) return;

    if (isExpired(token)) {
      signOut();
      showToast(t("toast.sessionExpired"));
      return;
    }

    let cancelled = false;

    const renew = async () => {
      if (busy.current || cancelled) return;
      busy.current = true;
      try {
        const fresh = await api.auth.refresh(token);
        if (!cancelled && fresh && fresh !== token) setSession(user, fresh, remember);
      } catch {
        // Refused means the token is spent (or the server rotated its secret).
        // Either way this person is not signed in any more; say so.
        if (!cancelled) { signOut(); showToast(t("toast.sessionExpired")); }
      } finally {
        busy.current = false;
      }
    };

    // Renew once the token is into its last quarter — on arrival, when the tab
    // comes back to the front, and on a timer for a tab left open all day.
    const stale = () => msRemaining(token) < 6 * 60 * 60_000; // < 6h left
    if (stale()) void renew();

    const onFocus = () => { if (stale()) void renew(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(() => { if (stale()) void renew(); }, 30 * 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
    };
  }, [token, user, remember, setSession, signOut, showToast, t]);

  return null;
}
