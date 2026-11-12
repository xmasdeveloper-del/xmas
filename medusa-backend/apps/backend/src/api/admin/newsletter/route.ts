import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { NEWSLETTER_MODULE } from "../../../modules/newsletter";

const PAGE = 200;

/**
 * GET /admin/newsletter — the addresses people left in the footer.
 *
 * `?format=csv` returns the same list as a file, which is how the owner
 * actually uses it: paste into whatever sends the mail.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = req.query as Record<string, string | undefined>;
  const limit = Math.min(Number(q.limit) || PAGE, 1000);
  const offset = Math.max(Number(q.offset) || 0, 0);

  const service: any = req.scope.resolve(NEWSLETTER_MODULE);
  const [rows, count] = await service.listAndCountNewsletterSubscribers(
    { status: "subscribed" },
    { order: { created_at: "DESC" }, take: limit, skip: offset },
  );

  if (q.format === "csv") {
    const header = "email,lang,source,created_at";
    const body = rows
      .map((r: any) => [r.email, r.lang ?? "", r.source ?? "", r.created_at?.toISOString?.() ?? ""].join(","))
      .join("\n");
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="newsletter-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`${header}\n${body}\n`);
    return;
  }

  res.json({
    count,
    subscribers: rows.map((r: any) => ({
      id: r.id, email: r.email, lang: r.lang, source: r.source, created_at: r.created_at,
    })),
  });
}
