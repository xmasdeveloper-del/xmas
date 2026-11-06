import { defineRouteConfig } from "@medusajs/admin-sdk";
import { HandTruck } from "@medusajs/icons";
import { Container, Text, Table, Badge, Button, Checkbox, Input, Label, FocusModal, toast } from "@medusajs/ui";
import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel } from "../../lib/ui";

type QItem = { id: string; title: string; variant: string; sku: string; quantity: number; thumbnail: string };
type QAction = "fulfill" | "ship" | "deliver";
type QOrder = {
  id: string; display_id: number; email: string; created_at: string;
  action: QAction; paid: boolean; payment_status: string;
  partial?: boolean; days_in_transit?: number | null; tracking?: string;
  customer: string; address: string; phone: string; items: QItem[];
};

const ACTION_LABEL: Record<QAction, string> = {
  fulfill: "Биелүүлэх",
  ship: "Илгээх",
  deliver: "Хүргэгдсэн болгох",
};
const ACTION_COLOR: Record<QAction, "orange" | "blue" | "green"> = {
  fulfill: "orange", ship: "blue", deliver: "green",
};

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/admin${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

const nf = (n: number) => new Intl.NumberFormat("mn-MN").format(n || 0);

// Build a printable picking (aggregated) + packing (per-order) document.
function printPickPack(orders: QOrder[]) {
  const agg = new Map<string, { title: string; sku: string; qty: number }>();
  for (const o of orders) for (const it of o.items) {
    const k = it.sku || it.title;
    const a = agg.get(k) || { title: it.title, sku: it.sku, qty: 0 };
    a.qty += it.quantity; agg.set(k, a);
  }
  const pick = [...agg.values()].sort((a, b) => a.title.localeCompare(b.title));
  const esc = (s: string) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const packing = orders.map((o) => `
    <div class="slip">
      <div class="slip-h">
        <div><b>X-MAS</b> — Захиалга #${o.display_id ?? ""}</div>
        <div>${esc(new Date(o.created_at).toLocaleDateString("mn-MN"))}</div>
      </div>
      <div class="addr">
        <b>${esc(o.customer)}</b><br/>${esc(o.address)}<br/>${esc(o.phone)}<br/>${esc(o.email)}
      </div>
      <table>
        <thead><tr><th>Бараа</th><th>SKU</th><th class="r">Тоо</th></tr></thead>
        <tbody>
          ${o.items.map((it) => `<tr><td>${esc(it.title)}${it.variant ? " · " + esc(it.variant) : ""}</td><td>${esc(it.sku)}</td><td class="r">${it.quantity}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("");
  const html = `<!doctype html><html lang="mn"><head><meta charset="utf-8"/><title>Түүвэрлэх / баглах жагсаалт</title>
    <style>
      body{font:13px/1.5 system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:24px}
      h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:24px 0 8px}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:12px}
      .r{text-align:right} .muted{color:#666;font-size:12px}
      .slip{border:1px solid #bbb;border-radius:8px;padding:14px;margin:0 0 14px;page-break-inside:avoid}
      .slip-h{display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px}
      .addr{font-size:12px;margin-bottom:6px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>Түүвэрлэх жагсаалт (Picking)</h1>
    <div class="muted">${orders.length} захиалга · ${pick.length} төрлийн бараа · ${esc(new Date().toLocaleString("mn-MN"))}</div>
    <table><thead><tr><th>Бараа</th><th>SKU</th><th class="r">Нийт тоо</th></tr></thead>
      <tbody>${pick.map((p) => `<tr><td>${esc(p.title)}</td><td>${esc(p.sku)}</td><td class="r">${p.qty}</td></tr>`).join("")}</tbody>
    </table>
    <h2>Баглах хуудас (Packing slips)</h2>
    ${packing}
    <div class="noprint" style="margin-top:16px"><button onclick="window.print()">Хэвлэх</button></div>
    </body></html>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { toast.error("Popup хаагдсан байна"); return; }
  w.document.write(html); w.document.close(); w.focus();
}

const FulfillmentPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [orders, setOrders] = useState<QOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [shipFor, setShipFor] = useState<QOrder | null>(null);
  const [trackNo, setTrackNo] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [counts, setCounts] = useState({ toFulfill: 0, toShip: 0, toDeliver: 0, total: 0 });
  const [capped, setCapped] = useState(false);
  // orderId → why its last batch fulfillment failed, so the row can say so.
  const [failed, setFailed] = useState<Map<string, string>>(new Map());

  const canWrite = can("orders.write");

  const load = async () => {
    setLoading(true);
    try {
      const j = await adminFetch("/fulfillment/queue");
      setOrders(j.orders || []);
      setCounts(j.counts || { toFulfill: 0, toShip: 0, total: 0 });
      setCapped(!!j.capped);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message || "Дараалал ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const fulfillable = useMemo(() => orders.filter((o) => o.action === "fulfill"), [orders]);
  const selectedFulfill = useMemo(
    () => [...selected].filter((id) => fulfillable.some((o) => o.id === id)),
    [selected, fulfillable],
  );

  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAllFulfill = () => setSelected((prev) => {
    // An unpaid order in this queue means the capture failed — exactly the one
    // a human must look at, so "select all" must not sweep it up.
    const allIds = fulfillable.filter((o) => o.paid).map((o) => o.id);
    const allSel = allIds.every((id) => prev.has(id));
    const n = new Set(prev);
    allIds.forEach((id) => (allSel ? n.delete(id) : n.add(id)));
    return n;
  });

  const batchFulfill = async () => {
    if (!selectedFulfill.length) return;
    // Creating fulfillments consumes reservations and moves stock, and there is
    // no undo on this page — so say what is about to happen and let staff stop.
    const unpaid = selectedFulfill.filter((id) => orders.find((o) => o.id === id && !o.paid)).length;
    const units = orders
      .filter((o) => selectedFulfill.includes(o.id))
      .reduce((a, o) => a + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    const warn = unpaid ? `\n\n⚠ Үүнээс ${nf(unpaid)} захиалга ТӨЛӨГДӨӨГҮЙ байна.` : "";
    if (!window.confirm(`${nf(selectedFulfill.length)} захиалга (${nf(units)} ширхэг) биелүүлэх үү? Энэ үйлдлийг буцаах боломжгүй.${warn}`)) return;

    setBusy(true);
    try {
      const r = await adminFetch("/fulfillment/batch", { method: "POST", body: JSON.stringify({ order_ids: selectedFulfill }) });
      // Keep the per-order reasons: "амжилтгүй: 3" alone left staff with no way
      // to tell which three failed or why.
      const failures: { id: string; reason?: string }[] = (r.results || []).filter((x: any) => !x.ok);
      setFailed(new Map(failures.map((f) => [f.id, f.reason || "алдаа"])));
      if (r.failed) {
        const names = failures
          .map((f) => `#${orders.find((o) => o.id === f.id)?.display_id ?? f.id} (${f.reason || "алдаа"})`)
          .join(", ");
        toast.warning(`Биелүүллээ: ${nf(r.fulfilled)} · амжилтгүй: ${nf(r.failed)} — ${names}`);
      } else {
        toast.success(`Биелүүллээ: ${nf(r.fulfilled)}`);
      }
      setSelected(new Set());
      await load();
    } catch (e: any) {
      toast.error(e.message || "Багц биелүүлэлт амжилтгүй");
    } finally {
      setBusy(false);
    }
  };

  // Close out a delivery. Until now the endpoint existed but nothing called it,
  // so an order with the courier stayed "shipped" forever.
  const markDelivered = async (o: QOrder) => {
    setBusy(true);
    try {
      await adminFetch(`/fulfillment/${o.id}/deliver`, { method: "POST" });
      toast.success(`#${o.display_id} хүргэгдсэн болголоо`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Хүргэгдсэн болгоход алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const doShip = async () => {
    if (!shipFor) return;
    setBusy(true);
    try {
      await adminFetch(`/fulfillment/${shipFor.id}/ship`, {
        method: "POST",
        body: JSON.stringify({ tracking_number: trackNo || undefined, tracking_url: trackUrl || undefined }),
      });
      toast.success(`#${shipFor.display_id} илгээгдлээ${trackNo ? ` · ${trackNo}` : ""}`);
      setShipFor(null); setTrackNo(""); setTrackUrl("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Илгээх амжилтгүй");
    } finally {
      setBusy(false);
    }
  };

  if (!permLoading && !can("orders.read")) {
    return <AccessDenied title="Биелүүлэх дараалал" perm="orders.read" />;
  }

  const printOrders = selected.size ? orders.filter((o) => selected.has(o.id)) : orders;

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Биелүүлэх дараалал"
        description="Шинэ захиалгыг биелүүлж, tracking-тэй илгээнэ. Түүвэрлэх/баглах жагсаалт хэвлэнэ."
        actions={<Button variant="secondary" size="small" onClick={load} disabled={loading}>Сэргээх</Button>}
      />

      {/* Summary + bulk actions */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        <Badge color="orange" size="2xsmall">Биелүүлэх: {nf(counts.toFulfill)}</Badge>
        <Badge color="blue" size="2xsmall">Илгээх: {nf(counts.toShip)}</Badge>
        <Badge color="green" size="2xsmall">Замд яваа: {nf(counts.toDeliver)}</Badge>
        {capped && <Text className="text-ui-fg-subtle" size="xsmall">(сүүлийн захиалгуудаас)</Text>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="small" onClick={() => printPickPack(printOrders)} disabled={!orders.length}>
            Жагсаалт хэвлэх{selected.size ? ` (${selected.size})` : ""}
          </Button>
          {canWrite && (
            <Button variant="primary" size="small" onClick={batchFulfill} disabled={!selectedFulfill.length || busy} isLoading={busy}>
              Багц биелүүлэх ({selectedFulfill.length})
            </Button>
          )}
        </div>
      </div>

      <Panel>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell className="w-8">
              <Checkbox
                checked={fulfillable.filter((o) => o.paid).length > 0
                  && fulfillable.filter((o) => o.paid).every((o) => selected.has(o.id))}
                onCheckedChange={toggleAllFulfill}
                disabled={!fulfillable.some((o) => o.paid)}
              />
            </Table.HeaderCell>
            <Table.HeaderCell>Захиалга</Table.HeaderCell>
            <Table.HeaderCell>Харилцагч</Table.HeaderCell>
            <Table.HeaderCell>Бараа</Table.HeaderCell>
            <Table.HeaderCell>Төлбөр</Table.HeaderCell>
            <Table.HeaderCell>Үйлдэл</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {!loading && orders.length === 0 && (
            <Table.Row>
              <Table.Cell {...({ colSpan: 7 } as any)}>
                <Text className="text-ui-fg-subtle py-6" size="small">Биелүүлэх захиалга алга. 🎉</Text>
              </Table.Cell>
            </Table.Row>
          )}
          {orders.map((o) => {
            const qty = o.items.reduce((a, b) => a + b.quantity, 0);
            return (
              <Table.Row key={o.id}>
                <Table.Cell>
                  <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                </Table.Cell>
                <Table.Cell>
                  {/* Cancelling, refunding, editing an address and partial
                      fulfillment all live on the native order page — make it
                      one click away instead of a number to memorise. */}
                  <a href={`/app/orders/${o.id}`} className="font-medium text-ui-fg-interactive hover:underline">
                    #{o.display_id}
                  </a>
                  <div className="text-ui-fg-subtle text-xs">{o.created_at?.slice(0, 10)}</div>
                  {failed.has(o.id) && (
                    <div className="text-ui-fg-error text-xs">⚠ {failed.get(o.id)}</div>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <div>{o.customer}</div>
                  {/* Courier handoff in UB is a phone call. */}
                  {o.phone
                    ? <a href={`tel:${o.phone}`} className="text-ui-fg-interactive text-xs hover:underline">{o.phone}</a>
                    : <span className="text-ui-fg-subtle text-xs">утасгүй</span>}
                  <div className="text-ui-fg-subtle text-xs">{o.address || "—"}</div>
                </Table.Cell>
                <Table.Cell>
                  {/* The size is the whole job in a shoe shop: without it staff
                      had to print the slip just to learn what to pick. */}
                  <div className="flex flex-col gap-1">
                    {o.items.map((it) => (
                      <div key={it.id} className="flex items-center gap-2">
                        {it.thumbnail && (
                          <img src={it.thumbnail} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                        )}
                        <span className="text-xs">
                          {it.title}
                          {it.variant && <b className="text-ui-fg-base"> · {it.variant}</b>}
                          <span className="text-ui-fg-subtle"> ×{it.quantity}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-ui-fg-subtle mt-1 text-xs">{nf(qty)} ширхэг</div>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={o.paid ? "green" : "red"} size="2xsmall">{o.paid ? "Төлсөн" : "Төлөөгүй"}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge color={ACTION_COLOR[o.action]} size="2xsmall">{ACTION_LABEL[o.action]}</Badge>
                    {o.partial && <Badge color="red" size="2xsmall">Хэсэгчилсэн</Badge>}
                    {o.action === "deliver" && o.days_in_transit != null && (
                      <span className={`text-xs ${o.days_in_transit >= 5 ? "text-ui-fg-error" : "text-ui-fg-subtle"}`}>
                        Замд {nf(o.days_in_transit)} хоног
                      </span>
                    )}
                    {o.tracking && <span className="text-ui-fg-subtle text-xs">{o.tracking}</span>}
                  </div>
                </Table.Cell>
                <Table.Cell className="text-right">
                  {canWrite && o.action === "ship" && (
                    <Button size="small" variant="secondary" onClick={() => { setShipFor(o); setTrackNo(""); setTrackUrl(""); }}>
                      Илгээх
                    </Button>
                  )}
                  {canWrite && o.action === "deliver" && (
                    <Button size="small" variant="secondary" onClick={() => markDelivered(o)} disabled={busy}>
                      Хүргэгдсэн
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
      </Panel>

      {/* Ship modal */}
      <FocusModal open={!!shipFor} onOpenChange={(v) => !v && setShipFor(null)}>
        <FocusModal.Content>
          <FocusModal.Header>
            <Text weight="plus">Илгээх — #{shipFor?.display_id}</Text>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-4 p-6">
            <Text className="text-ui-fg-subtle" size="small">
              {shipFor?.customer} · {shipFor?.address} · {shipFor?.phone}
            </Text>
            <div className="flex flex-col gap-1">
              <Label size="small">Хүргэлтийн дугаар (заавал биш)</Label>
              <Input value={trackNo} onChange={(e) => setTrackNo(e.target.value)} placeholder="ж: MN-123456" />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Tracking холбоос (заавал биш)</Label>
              <Input value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShipFor(null)} disabled={busy}>Болих</Button>
              <Button variant="primary" onClick={doShip} isLoading={busy}>Илгээх ба мэдэгдэх</Button>
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  );
};

export const config = defineRouteConfig({
  nested: "/orders",
  label: "Биелүүлэлт",
  icon: HandTruck,
});

export default FulfillmentPage;
