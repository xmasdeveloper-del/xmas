// Ask the storefront to rebuild a cached page right after the owner saves.
//
// The homepage is statically generated with ISR, so a CMS save would otherwise
// take up to the revalidate window (5 minutes) to appear — long enough that the
// owner reloads, sees the old page and concludes the save failed. This pokes
// Next's on-demand revalidation so the change is live in a second.
//
// Degrades on purpose: the endpoint is only callable when REVALIDATE_SECRET is
// configured on BOTH services. Without it the save still succeeds and the page
// still updates within the ISR window — so nothing has to be configured for the
// feature to work, it is just slower. The caller is told which happened so the
// admin can say so honestly.

export type RevalidateResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "failed"; detail?: string };

export async function revalidateStorefront(paths: string[]): Promise<RevalidateResult> {
  const secret = process.env.REVALIDATE_SECRET;
  const base = (process.env.STOREFRONT_URL || "").replace(/\/+$/, "");
  if (!secret || !base) return { ok: false, reason: "not_configured" };

  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ paths }),
      // Never let a slow storefront hold up the admin's save.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, reason: "failed", detail: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "failed", detail: (e as Error).message };
  }
}
