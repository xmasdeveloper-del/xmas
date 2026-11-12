import { notFound } from "next/navigation";

/**
 * Anything under a locale that matches no real page.
 *
 * Without this, an unknown address fell past the `[lang]` segment entirely and
 * Next answered with its own bare "404 This page could not be found" — English,
 * unstyled, no nav, no footer, no way back to the shop. The branded 404 next
 * door only ever appeared when a page called notFound() itself, which an
 * unknown URL never does. Catching the route here hands those addresses to it.
 */
export default function CatchAll() {
  notFound();
}
