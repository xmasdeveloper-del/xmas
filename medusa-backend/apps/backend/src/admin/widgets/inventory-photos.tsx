import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Input, Badge, Button, toast } from "@medusajs/ui";
import { useEffect, useRef, useState } from "react";
import { usePermissions } from "../lib/perms";

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
  const { can } = usePermissions();
  const mayEdit = can("catalog.write");
  const [q, setQ] = useState("");
  // What the owner has typed into a row but not yet saved, keyed by variant.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
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

  // One row, typed by hand. The CSV upload is for a hundred at once; this is
  // for the single pair that just came back from a customer.
  const save = async (r: Row) => {
    const typed = (draft[r.id] ?? "").trim();
    if (typed === "" || Number(typed) === r.stock) { setDraft(d => { const { [r.id]: _, ...rest } = d; return rest; }); return; }
    setSaving(r.id);
    try {
      const res = await fetch("/admin/catalog/stock", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: r.sku, stock: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Хадгалж чадсангүй");
      setRows(prev => prev.map(x => x.id === r.id ? { ...x, stock: data.stock } : x));
      setDraft(d => { const { [r.id]: _, ...rest } = d; return rest; });
      toast.success(`${r.product} · ${r.variant || r.sku}: ${nf.format(data.stock)}`);
    } catch (e: any) {
      toast.error(e?.message || "Хадгалж чадсангүй");
    } finally {
      setSaving(null);
    }
  };

  // Nothing to add to the page if the list cannot be read — the core table
  // below still works, and a broken panel on top of it helps no one.
  if (failed) return null;

  return (
    <Container className="mb-4 p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border-base px-6 py-4">
        <div>
          <Heading level="h2">Зурагтай үлдэгдэл</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {mayEdit
              ? "Доорх жагсаалттай ижил нөөц — зурагтай. Тоог шууд засаад Enter дарна (нэг нэгээр). Олноор нь бол Каталог → Нөөц шинэчлэх (CSV). Тоо оруулсан хувилбарын нөөц хяналт асна — 0 бол сайт дээр дууссан гэж харагдана."
              : "Доорх жагсаалттай ижил нөөц — барааны зураг, бүтэн нэртэйгээр."}
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
                  {!mayEdit ? (
                    r.stock == null
                      ? <Badge size="2xsmall" color="grey">Хянахгүй</Badge>
                      : <Badge size="2xsmall" color={r.stock === 0 ? "red" : r.stock <= 5 ? "orange" : "green"}>{nf.format(r.stock)}</Badge>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {r.stock == null && draft[r.id] == null && (
                        <Badge size="2xsmall" color="grey">Хянахгүй</Badge>
                      )}
                      <Input
                        size="small"
                        inputMode="numeric"
                        disabled={saving === r.id || !r.sku}
                        placeholder={r.stock == null ? "—" : String(r.stock)}
                        value={draft[r.id] ?? (r.stock == null ? "" : String(r.stock))}
                        onChange={e => setDraft(d => ({ ...d, [r.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void save(r); } }}
                        onBlur={() => void save(r)}
                        className="w-[74px] text-right tabular-nums"
                        aria-label={`${r.product} ${r.variant} нөөц`}
                      />
                    </div>
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
