import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ChartBar } from "@medusajs/icons";
import { Container, Text, Table, Button, Input, Label, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, StatGrid, StatCard, Panel, Bar, AreaChart } from "../../lib/ui";

type Report = {
  from: string | null; to: string | null;
  totals: {
    revenue: number; orders: number; aov: number; net: number; vat: number;
    discounts: number; refunds: number; shipping: number;
  };
  daily: { date: string; revenue: number; orders: number }[];
  byCategory: { name: string; revenue: number; qty: number }[];
  byProduct: { name: string; revenue: number; qty: number }[];
  scanned: number; capped: boolean; totalsExact?: boolean;
};

async function adminFetch(path: string) {
  const res = await fetch(`/admin${path}`, { credentials: "include", headers: { "content-type": "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

const nf = (n: number) => new Intl.NumberFormat("mn-MN").format(Math.round(n || 0));
const tug = (n: number) => `₮${nf(n)}`;

// Ranges are picked on the shop's own calendar, not the operator's device.
// Ulaanbaatar is UTC+8 with no daylight saving, and the report groups by the
// same day boundary on the server (see lib/money ubDayKey) — a laptop left on
// another timezone would otherwise ask for the wrong "today".
const UB_OFFSET_MIN = 8 * 60;
const ubDay = (shiftDays = 0) =>
  new Date(Date.now() + UB_OFFSET_MIN * 60_000 + shiftDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
/** First/last day of the month `shiftMonths` away from this one, in UB. */
const ubMonth = (shiftMonths: number) => {
  const d = new Date(Date.now() + UB_OFFSET_MIN * 60_000);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + shiftMonths, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + shiftMonths + 1, 0));
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)] as const;
};

const PRESETS: { label: string; range: () => readonly [string, string] }[] = [
  { label: "Өнөөдөр", range: () => [ubDay(), ubDay()] },
  { label: "Өчигдөр", range: () => [ubDay(-1), ubDay(-1)] },
  { label: "7 хоног", range: () => [ubDay(-6), ubDay()] },
  { label: "30 хоног", range: () => [ubDay(-29), ubDay()] },
  { label: "Энэ сар", range: () => { const [a] = ubMonth(0); return [a, ubDay()] as const; } },
  { label: "Өмнөх сар", range: () => ubMonth(-1) },
];

const ReportsPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const qs = (a = from, b = to) => {
    const p = new URLSearchParams();
    if (a) p.set("from", a);
    if (b) p.set("to", b);
    return p.toString();
  };

  // The range is passed in rather than read from state: a preset sets the two
  // dates and reports in the same click, and state has not caught up by then.
  const load = async (a = from, b = to) => {
    setLoading(true);
    try {
      setData(await adminFetch(`/reports/sales${qs(a, b) ? `?${qs(a, b)}` : ""}`));
    } catch (e: any) {
      toast.error(e.message || "Тайлан ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const applyPreset = (p: typeof PRESETS[number]) => {
    const [a, b] = p.range();
    setFrom(a);
    setTo(b);
    load(a, b);
  };

  const exportCsv = (type: string) => {
    const p = new URLSearchParams(qs(from, to));
    p.set("type", type);
    window.open(`/admin/reports/sales/export?${p.toString()}`, "_blank");
  };

  if (!permLoading && !can("reports.read")) {
    return <AccessDenied title="Тайлан" perm="reports.read" />;
  }

  const maxDay = Math.max(1, ...(data?.daily || []).map((d) => d.revenue));

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Борлуулалтын тайлан"
        description="Хугацаа, ангилал, бараагаар. НӨАТ (10%) задаргаатай."
      />

      {/* Quick ranges — a day's takings should not need two dates typed in. */}
      <div className="flex flex-wrap items-center gap-1.5 px-6 pt-3">
        {PRESETS.map((p) => {
          const [a, b] = p.range();
          const on = from === a && to === b;
          return (
            <Button
              key={p.label}
              variant={on ? "primary" : "secondary"}
              size="small"
              onClick={() => applyPreset(p)}
              disabled={loading}
            >
              {p.label}
            </Button>
          );
        })}
        <Button
          variant={!from && !to ? "primary" : "transparent"}
          size="small"
          onClick={() => { setFrom(""); setTo(""); load("", ""); }}
          disabled={loading}
        >
          Бүгд
        </Button>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-3">
        <div className="flex flex-col gap-1">
          <Label size="small">Эхлэх</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Дуусах</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
        </div>
        <Button variant="primary" size="small" onClick={() => load()} isLoading={loading}>Тайлагнах</Button>
        {data?.capped && <Text className="text-ui-fg-subtle" size="xsmall">(эхний {nf(data.scanned)} захиалгаар хязгаарласан)</Text>}
      </div>

      {/* Totals */}
      <StatGrid cols={5}>
        <StatCard label="Нийт борлуулалт" value={data ? tug(data.totals.revenue) : "…"} loading={loading} tone="green" />
        <StatCard label="НӨАТгүй (net)" value={data ? tug(data.totals.net) : "…"} loading={loading} tone="green" />
        <StatCard label="НӨАТ (10%)" value={data ? tug(data.totals.vat) : "…"} loading={loading} tone="orange" />
        <StatCard label="Захиалга" value={data ? nf(data.totals.orders) : "…"} loading={loading} tone="blue" />
        <StatCard label="Дундаж захиалга" value={data ? tug(data.totals.aov) : "…"} loading={loading} tone="orange" />
      </StatGrid>

      {/* What was taken off the catalogue price — the owner needs to see what
          coupons and returns actually cost, not just the net figure. */}
      <StatGrid cols={3}>
        <StatCard label="Хөнгөлөлт (купон)" value={data ? tug(data.totals.discounts) : "…"} loading={loading} tone="orange" />
        <StatCard label="Буцаалт" value={data ? tug(data.totals.refunds) : "…"} loading={loading} tone="red" />
        <StatCard label="Үүнээс хүргэлт" value={data ? tug(data.totals.shipping) : "…"} loading={loading} tone="blue" />
      </StatGrid>

      {/* Daily trend */}
      <Panel
        title="Өдрийн борлуулалт"
        actions={<Button variant="secondary" size="small" onClick={() => exportCsv("daily")}>CSV</Button>}
        bodyClassName="p-4"
      >
        {(data?.daily || []).length === 0 ? (
          <Text className="text-ui-fg-subtle" size="small">Мэдээлэл алга.</Text>
        ) : (
          <div className="flex flex-col gap-4">
            <AreaChart
              points={data!.daily.map((d) => ({ label: d.date.slice(5), value: d.revenue }))}
              height={96}
              tone="interactive"
              valueFormat={tug}
            />
            <div className="flex flex-col gap-1">
            {data!.daily.map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="text-xs text-ui-fg-subtle w-24 shrink-0">{d.date}</span>
                <Bar value={d.revenue} max={maxDay} tone="interactive" className="flex-1" />
                <span className="text-xs font-medium w-24 text-right shrink-0 tabular-nums">{tug(d.revenue)}</span>
                <span className="text-xs text-ui-fg-subtle w-10 text-right shrink-0 tabular-nums">{nf(d.orders)}</span>
              </div>
            ))}
            </div>
          </div>
        )}
      </Panel>

      {/* By category */}
      <Panel
        title="Ангиллаар"
        actions={<Button variant="secondary" size="small" onClick={() => exportCsv("category")}>CSV</Button>}
      >
        <Table>
          <Table.Header><Table.Row>
            <Table.HeaderCell>Ангилал</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Тоо</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Борлуулалт</Table.HeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {(data?.byCategory || []).map((c) => (
              <Table.Row key={c.name}>
                <Table.Cell>{c.name}</Table.Cell>
                <Table.Cell className="text-right tabular-nums">{nf(c.qty)}</Table.Cell>
                <Table.Cell className="text-right font-medium tabular-nums">{tug(c.revenue)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Panel>

      {/* By product */}
      <Panel
        title="Бараагаар (топ 50)"
        actions={<Button variant="secondary" size="small" onClick={() => exportCsv("product")}>CSV</Button>}
      >
        <Table>
          <Table.Header><Table.Row>
            <Table.HeaderCell>Бараа</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Тоо</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Борлуулалт</Table.HeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {(data?.byProduct || []).map((p) => (
              <Table.Row key={p.name}>
                <Table.Cell>{p.name}</Table.Cell>
                <Table.Cell className="text-right tabular-nums">{nf(p.qty)}</Table.Cell>
                <Table.Cell className="text-right font-medium tabular-nums">{tug(p.revenue)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Panel>

      {/* VAT report (10% VAT-inclusive breakdown for accounting) */}
      <Panel
        title="НӨАТ тайлан"
        actions={<Button variant="secondary" size="small" onClick={() => exportCsv("vat")}>CSV</Button>}
        bodyClassName="p-4"
      >
        <Text className="text-ui-fg-subtle" size="xsmall">Үнэ НӨАТ багтсан (Монгол, 10%). Нийт {data ? tug(data.totals.revenue) : "…"} = НӨАТгүй {data ? tug(data.totals.net) : "…"} + НӨАТ {data ? tug(data.totals.vat) : "…"}.</Text>
        <Text className="text-ui-fg-subtle mt-1" size="xsmall">
          Нийт орлого нь купоны хөнгөлөлт болон буцаалтыг хассан, бодитоор төлөгдсөн дүн. Цуцалсан болон ноорог захиалга ороогүй. Өдрийн хуваарилалт Улаанбаатарын цагаар (UTC+8).
        </Text>
        {data?.totalsExact === false && (
          <Text className="text-ui-fg-subtle mt-1" size="xsmall">
            ⚠ Захиалгын нийт дүнг ачаалж чадсангүй — дүнг барааны мөрөөс сэргээв (хүргэлтийн төлбөр ороогүй).
          </Text>
        )}
      </Panel>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Тайлан",
  icon: ChartBar,
});

export default ReportsPage;
