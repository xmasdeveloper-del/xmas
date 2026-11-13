import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Input, Badge, Button } from "@medusajs/ui";
import { useEffect, useRef, useState } from "react";

/**
 * Stock with the product's photograph, above Medusa's own inventory table.
 *
 * That table lists a variant's title, its SKU and a number — "L / Black ·
 * SHIRT-L-BLACK · 1000000". On a shoe the title is a size, so every row of a
 * brand reads the same and nothing can be recognised at a glance. Medusa's
 * list is a core page and cannot take another column, so the photo goes here:
 * the same stock, same search, with the picture and the product's full name.
 */

type Row = {
  id: string; sku: string; variant: string; product: string;
  handle: string; thumbnail: string; stock: number | null;
};

const PAGE = 24;
const nf = new Intl.NumberFormat("mn-MN");

const InventoryPhotos = () => {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const id = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/admin/catalog/stock?limit=${shown}&q=${encodeURIComponent(q.trim())}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (mine !== seq.current) return;
        setRows(data.variants ?? []);
        setCount(data.count ?? 0);
        setFailed(false);
      } catch {
        if (mine === seq.current) setFailed(true);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(id);
  }, [q, shown]);

  // Nothing to add to the page if the list cannot be read — the core table
  // below still works, and a broken panel on top of it helps no one.
  if (failed) return null;

  return (
    <Container className="mb-4 p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border-base px-6 py-4">
        <div>
          <Heading level="h2">Зурагтай үлдэгдэл</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Доорх жагсаалттай ижил нөөц — барааны зураг, бүтэн нэртэйгээр.
          </Text>
        </div>
        <Input
          value={q}
          onChange={e => { setShown(PAGE); setQ(e.target.value); }}
          placeholder="Бараа, хувилбар эсвэл SKU…"
          className="w-[260px]"
        />
      </div>

      <div className="px-6 py-4">
        {loading && rows.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">Ачаалж байна…</Text>
        ) : rows.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">Илэрц алга.</Text>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(r => (
                <div key={r.id} className="flex items-center gap-3 border-b border-ui-border-base py-2 last:border-b-0">
                  {r.thumbnail
                    ? <img src={r.thumbnail} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md bg-ui-bg-subtle object-cover" />
                    : <div className="h-10 w-10 shrink-0 rounded-md bg-ui-bg-subtle" />}
                  <div className="min-w-0 flex-1">
                    <Text size="small" weight="plus" className="truncate">{r.product || "—"}</Text>
                    <Text size="xsmall" className="truncate text-ui-fg-subtle">
                      {[r.variant, r.sku].filter(Boolean).join(" · ") || "—"}
                    </Text>
                  </div>
                  {r.stock == null ? (
                    <Badge size="2xsmall" color="grey">Хянахгүй</Badge>
                  ) : (
                    <Badge size="2xsmall" color={r.stock === 0 ? "red" : r.stock <= 5 ? "orange" : "green"}>
                      {nf.format(r.stock)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Text size="xsmall" className="text-ui-fg-muted">
                {nf.format(rows.length)} / {nf.format(count)}
              </Text>
              {rows.length < count && (
                <Button size="small" variant="secondary" isLoading={loading} onClick={() => setShown(s => s + PAGE)}>
                  Цааш үзэх
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "inventory_item.list.before",
});

export default InventoryPhotos;
