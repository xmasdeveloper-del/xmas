import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// POST /api/revalidate — let the admin push a CMS save onto the live site.
//
// The homepage is statically generated with ISR, so without this a content save
// takes up to the revalidate window to appear. Long enough that the owner
// reloads, sees the old page and concludes the save did not work.
//
// Deliberately inert until configured: with no REVALIDATE_SECRET this answers
// 503 and the backend falls back to waiting for the ISR window. That keeps the
// endpoint from being an open "make this site regenerate" button, which is the
// one thing it must never be — forcing regeneration on demand would let anyone
// bypass the cache and put every request straight onto the Medusa API.
//
// Paths are allowlisted rather than taken on trust, so even a leaked secret
// cannot be used to sweep the whole site's cache.

const ALLOWED_PATHS = new Set(["/", "/mn", "/en"]);

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: "not_configured" },
      { status: 503 },
    );
  }

  if (req.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const asked: unknown = (body as any)?.paths;
  const paths = (Array.isArray(asked) ? asked : [])
    .filter((p): p is string => typeof p === "string")
    .filter((p) => ALLOWED_PATHS.has(p));

  if (!paths.length) {
    return NextResponse.json({ ok: false, reason: "no_valid_paths" }, { status: 400 });
  }

  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ ok: true, revalidated: paths });
}
