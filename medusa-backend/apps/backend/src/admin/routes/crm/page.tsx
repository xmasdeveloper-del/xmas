import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Users } from "@medusajs/icons";
import { Container, Text, Table, Badge, Button, Input, Select, Textarea, Label, FocusModal, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel } from "../../lib/ui";

type Row = {
  id: string; email: string; name: string; has_account: boolean;
  created_at: string; ltv: number; orders: number; last_order: string | null;
  segment: "vip" | "new" | "active" | "inactive" | "none"; note: string;
};

const SEG_LABEL: Record<Row["segment"], string> = { vip: "VIP", new: "Шинэ", active: "Идэвхтэй", inactive: "Идэвхгүй", none: "Захиалгагүй" };
const SEG_COLOR: Record<Row["segment"], "purple" | "green" | "blue" | "orange" | "grey"> = { vip: "purple", new: "blue", active: "green", inactive: "orange", none: "grey" };

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/admin${path}`, { credentials: "include", headers: { "content-type": "application/json" }, ...init });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.message || `Request failed (${res.status})`);
  }
  return res;
}

const nf = (n: number) => new Intl.NumberFormat("mn-MN").format(n || 0);
const PAGE = 50;

const CrmPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const canWrite = can("customers.write");

  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [segment, setSegment] = useState("");
  const [noteFor, setNoteFor] = useState<Row | null>(null);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (newOffset = offset) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(newOffset) });
      if (q) params.set("q", q);
      if (segment) params.set("segment", segment);
      const j = await (await adminFetch(`/crm/customers?${params.toString()}`)).json();
      setRows(j.customers || []);
      setCount(j.count || 0);
      setTally(j.tally || {});
      setOffset(newOffset);
    } catch (e: any) {
      toast.error(e.message || "Харилцагч ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(0); /* eslint-disable-next-line */ }, [q, segment]);

  const saveNote = async () => {
    if (!noteFor) return;
    setBusy(true);
    try {
      await adminFetch(`/crm/customers/${noteFor.id}/note`, { method: "POST", body: JSON.stringify({ note: noteText }) });
      setRows((prev) => prev.map((r) => (r.id === noteFor.id ? { ...r, note: noteText } : r)));
      toast.success("Тэмдэглэл хадгаллаа");
      setNoteFor(null);
    } catch (e: any) {
      toast.error(e.message || "Хадгалахад алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    // Server sets Content-Disposition; open in a new tab to trigger the download.
    window.open("/admin/crm/export", "_blank");
  };

  if (!permLoading && !can("customers.read")) {
    return <AccessDenied title="Харилцагч (CRM)" perm="customers.read" />;
  }

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const segs: Row["segment"][] = ["vip", "new", "active", "inactive", "none"];

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Харилцагч (CRM)"
        description="Сегмент, LTV (нийт худалдан авалт), захиалгын түүх, тэмдэглэл."
        actions={<Button variant="secondary" size="small" onClick={exportCsv}>CSV татах</Button>}
      />

      {/* Segment chips */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        {segs.map((s) => (
          <Badge key={s} color={SEG_COLOR[s]} size="2xsmall">{SEG_LABEL[s]}: {nf(tally[s] || 0)}</Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-3">
        <div className="flex flex-col gap-1">
          <Label size="small">Хайх</Label>
          <div className="flex gap-2">
            <Input value={qInput} onChange={(e) => setQInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setQ(qInput)} placeholder="Имэйл эсвэл нэр…" className="w-[220px]" />
            <Button variant="secondary" size="small" onClick={() => setQ(qInput)}>Хайх</Button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Сегмент</Label>
          <div className="w-[170px]">
            <Select size="small" value={segment || "all"} onValueChange={(v) => setSegment(v === "all" ? "" : v)}>
              <Select.Trigger><Select.Value placeholder="Бүгд" /></Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Бүгд</Select.Item>
                {segs.map((s) => <Select.Item key={s} value={s}>{SEG_LABEL[s]}</Select.Item>)}
              </Select.Content>
            </Select>
          </div>
        </div>
      </div>

      <Panel title="Харилцагч">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Харилцагч</Table.HeaderCell>
              <Table.HeaderCell>Сегмент</Table.HeaderCell>
              <Table.HeaderCell className="text-right">LTV</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Захиалга</Table.HeaderCell>
              <Table.HeaderCell>Сүүлийн</Table.HeaderCell>
              <Table.HeaderCell>Тэмдэглэл</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {!loading && rows.length === 0 && (
              <Table.Row><Table.Cell {...({ colSpan: 6 } as any)}><Text className="text-ui-fg-subtle py-6" size="small">Харилцагч олдсонгүй.</Text></Table.Cell></Table.Row>
            )}
            {rows.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>
                  <div>{r.name}</div>
                  <div className="text-ui-fg-subtle text-xs">{r.email} {r.has_account ? "" : "· зочин"}</div>
                </Table.Cell>
                <Table.Cell><Badge color={SEG_COLOR[r.segment]} size="2xsmall">{SEG_LABEL[r.segment]}</Badge></Table.Cell>
                <Table.Cell className="text-right font-medium">₮{nf(r.ltv)}</Table.Cell>
                <Table.Cell className="text-right">{nf(r.orders)}</Table.Cell>
                <Table.Cell className="text-ui-fg-subtle text-xs">{r.last_order ? r.last_order.slice(0, 10) : "—"}</Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ui-fg-subtle max-w-[160px] truncate">{r.note || "—"}</span>
                    {canWrite && (
                      <Button size="small" variant="transparent" onClick={() => { setNoteFor(r); setNoteText(r.note || ""); }}>
                        {r.note ? "Засах" : "Нэмэх"}
                      </Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Panel>

      <div className="flex items-center justify-between px-6 py-3">
        <Text className="text-ui-fg-subtle" size="small">Хуудас {page} / {pages} · Нийт {nf(count)}</Text>
        <div className="flex gap-2">
          <Button variant="secondary" size="small" disabled={offset === 0 || loading} onClick={() => load(Math.max(0, offset - PAGE))}>Өмнөх</Button>
          <Button variant="secondary" size="small" disabled={offset + PAGE >= count || loading} onClick={() => load(offset + PAGE)}>Дараах</Button>
        </div>
      </div>

      {/* Note modal */}
      <FocusModal open={!!noteFor} onOpenChange={(v) => !v && setNoteFor(null)}>
        <FocusModal.Content>
          <FocusModal.Header><Text weight="plus">Тэмдэглэл — {noteFor?.name}</Text></FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-4 p-6">
            <Text className="text-ui-fg-subtle" size="small">{noteFor?.email}</Text>
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={5} placeholder="Дотоод тэмдэглэл (жишээ: утсаар холбогдсон, тусгай хүсэлт…)" />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setNoteFor(null)} disabled={busy}>Болих</Button>
              <Button variant="primary" onClick={saveNote} isLoading={busy}>Хадгалах</Button>
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Харилцагч (CRM)",
  icon: Users,
});

export default CrmPage;
