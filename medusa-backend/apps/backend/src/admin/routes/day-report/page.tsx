import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ReceiptPercent } from "@medusajs/icons";
import { Container, Text, Button, Input, Badge, Table } from "@medusajs/ui";
import { useCallback, useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel, TableCard } from "../../lib/ui";
import { tug, PAY_LABEL, printReceipt } from "../../lib/receipt";

type Sale = {
  no: string; at: string; payment: string; customerName: string | null;
  discount: number; total: number; cashierId: string | null; cashier: string;
  register: "1" | "2";
  items: { title: string; quantity: number; unit_price: number; amount: number }[];
};
type Tally = Record<string, { count: number; total: number }>;
type Report = { date: string; count: number; total: number; byMethod: Tally; byStaff: Tally; byRegister: Tally; sales: Sale[] };

const todayStr = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const time = (s: string) => new Date(s).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });

async function adminFetch(path: string) {
  const res = await fetch(`/admin${path}`, { credentials: "include", headers: { "content-type": "application/json" } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || `Request failed (${res.status})`);
  return res.json();
}

/* ---------------------------------------------------------------------------
 * The day's figures as a spreadsheet.
 *
 * Everything on this page is already in the browser, so the file is built
 * here — no second trip to the server, and what downloads is exactly what is
 * on screen. It is a CSV, which Excel opens by double-click: the BOM keeps
 * Cyrillic readable and the `sep=` line stops Excel from guessing the
 * separator by locale and dropping the whole row into one column. Numbers are
 * written bare, with no ₮ and no thousands separators, so they arrive as
 * numbers and can be summed.
 * ------------------------------------------------------------------------ */
const cell = (v: string | number | null | undefined) => {
  const t = v == null ? "" : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const row = (...cells: (string | number | null | undefined)[]) => cells.map(cell).join(",");

function reportCsv(r: Report): string {
  const lines: string[] = ["sep=,"];
  lines.push(row("Өдрийн хаалт", r.date));
  lines.push(row("Нийт борлуулалт", r.total));
  lines.push(row("Зарлагын тоо", r.count));
  lines.push("");

  const tally = (title: string, t: Tally, label: (k: string) => string) => {
    lines.push(row(title, "Зарлага", "Дүн"));
    for (const [k, v] of Object.entries(t || {})) lines.push(row(label(k), v.count, v.total));
    lines.push("");
  };
  tally("Төлбөрийн хэлбэр", r.byMethod, k => PAY_LABEL[k as keyof typeof PAY_LABEL] || k);
  tally("Касс", r.byRegister, k => `Касс ${k}`);
  tally("Ажилтан", r.byStaff, k => k);

  lines.push(row("Борлуулалтууд"));
  lines.push(row("Дугаар", "Цаг", "Касс", "Төлбөр", "Ажилтан", "Харилцагч", "Хямдрал", "Дүн"));
  for (const s of r.sales || []) {
    lines.push(row(
      s.no, time(s.at), `Касс ${s.register}`,
      PAY_LABEL[s.payment as keyof typeof PAY_LABEL] || s.payment,
      s.cashier, s.customerName || "", s.discount || 0, s.total,
    ));
  }
  lines.push("");

  lines.push(row("Барааны задаргаа"));
  lines.push(row("Дугаар", "Бараа", "Тоо", "Нэгж үнэ", "Дүн"));
  for (const s of r.sales || []) {
    for (const it of s.items || []) {
      lines.push(row(s.no, it.title, it.quantity, it.unit_price, it.amount));
    }
  }

  return lines.join("\r\n");
}

function downloadCsv(r: Report) {
  // The leading byte-order mark is not decoration: without it Excel reads
  // the Cyrillic as Latin-1 and the whole sheet arrives as mojibake.
  const blob = new Blob(["\uFEFF" + reportCsv(r)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `odriin-haalt-${r.date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// End-of-day / Z-report: in-store (offline) sales for a chosen day, broken down
// by payment method, with a reprintable list.
const DayReportPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [date, setDate] = useState(todayStr());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try { setReport((await adminFetch(`/offline-sale?report=${encodeURIComponent(d)}`)).report); }
    catch { setReport(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(date); }, [date, load]);

  if (!permLoading && !can("orders.read")) {
    return <AccessDenied title="Өдрийн хаалт" perm="orders.read" />;
  }

  const methods = report ? Object.entries(report.byMethod) : [];

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Өдрийн хаалт"
        description="Тухайн өдрийн дэлгүүрийн (касс) борлуулалтыг төлбөрийн хэлбэрээр задалж харна. Ээлж хаах, тулгалт хийхэд ашиглана."
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value || todayStr())} className="w-40" />
            <Button
              variant="secondary" size="small"
              onClick={() => report && downloadCsv(report)}
              disabled={loading || !report || (report.count || 0) === 0}
            >Excel татах</Button>
            <Button variant="secondary" size="small" onClick={() => load(date)} disabled={loading}>Сэргээх</Button>
          </div>
        }
      />

      {/* Totals */}
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
          <Text size="small" className="text-ui-fg-subtle">Нийт борлуулалт</Text>
          <Text className="mt-1 text-2xl font-semibold tabular-nums">{tug(report?.total || 0)}</Text>
          <Text size="small" className="text-ui-fg-muted">{report?.count || 0} зарлага</Text>
        </div>
        {["cash", "card", "qpay", "transfer"].map(m => {
          const v = report?.byMethod?.[m];
          return (
            <div key={m} className="rounded-xl border border-ui-border-base px-4 py-3">
              <Text size="small" className="text-ui-fg-subtle">{PAY_LABEL[m]}</Text>
              <Text className="mt-1 text-xl font-semibold tabular-nums">{tug(v?.total || 0)}</Text>
              <Text size="small" className="text-ui-fg-muted">{v?.count || 0} зарлага</Text>
            </div>
          );
        })}
      </div>

      {/* Other payment methods, if any beyond the four known */}
      {methods.some(([m]) => !PAY_LABEL[m]) && (
        <div className="px-6 pb-2">
          {methods.filter(([m]) => !PAY_LABEL[m]).map(([m, v]) => (
            <Badge key={m} size="small" className="mr-2">{m}: {v.count} · {tug(v.total)}</Badge>
          ))}
        </div>
      )}

      {/* Per-register close. Each till's drawer is counted against its own
          line — this is the "two daily closings" a two-till shop needs. */}
      {report && Object.keys(report.byRegister || {}).length > 0 && (
        <Panel title="Кассаар (өдрийн хаалт)">
          <TableCard>
            <Table>
              <Table.Header><Table.Row>
                <Table.HeaderCell>Касс</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Зарлага</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Дүн</Table.HeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {Object.entries(report.byRegister)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([name, v]) => (
                    <Table.Row key={name}>
                      <Table.Cell className="font-medium">{name}</Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{v.count}</Table.Cell>
                      <Table.Cell className="text-right tabular-nums font-medium">{tug(v.total)}</Table.Cell>
                    </Table.Row>
                  ))}
              </Table.Body>
            </Table>
          </TableCard>
        </Panel>
      )}

      {/* Who was on the till. Shift hand-over and cash-up read off this. */}
      {report && Object.keys(report.byStaff || {}).length > 0 && (
        <Panel title="Ажилтнаар">
          <TableCard>
            <Table>
              <Table.Header><Table.Row>
                <Table.HeaderCell>Ажилтан</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Зарлага</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Дүн</Table.HeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {Object.entries(report.byStaff)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([name, v]) => (
                    <Table.Row key={name}>
                      <Table.Cell className="font-medium">{name}</Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{v.count}</Table.Cell>
                      <Table.Cell className="text-right tabular-nums font-medium">{tug(v.total)}</Table.Cell>
                    </Table.Row>
                  ))}
              </Table.Body>
            </Table>
          </TableCard>
        </Panel>
      )}

      <Panel title="Борлуулалтууд">
        {loading ? (
          <Text className="px-4 py-6 text-ui-fg-subtle">Ачаалж байна…</Text>
        ) : !report || report.sales.length === 0 ? (
          <Text className="px-4 py-6 text-ui-fg-subtle">Энэ өдөр кассын борлуулалт бүртгэгдээгүй байна.</Text>
        ) : (
          <TableCard>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Дугаар</Table.HeaderCell>
                  <Table.HeaderCell>Цаг</Table.HeaderCell>
                  <Table.HeaderCell>Касс</Table.HeaderCell>
                  <Table.HeaderCell>Төлбөр</Table.HeaderCell>
                  <Table.HeaderCell>Ажилтан</Table.HeaderCell>
                  <Table.HeaderCell>Харилцагч</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Дүн</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {report.sales.map(s => (
                  <Table.Row key={s.no}>
                    <Table.Cell className="font-medium">{s.no}</Table.Cell>
                    <Table.Cell>{time(s.at)}</Table.Cell>
                    <Table.Cell><Badge size="2xsmall" color={s.register === "2" ? "orange" : "blue"}>Касс {s.register}</Badge></Table.Cell>
                    <Table.Cell><Badge size="2xsmall">{PAY_LABEL[s.payment] || s.payment}</Badge></Table.Cell>
                    <Table.Cell className="max-w-[160px] truncate">{s.cashier}</Table.Cell>
                    <Table.Cell className="max-w-[160px] truncate text-ui-fg-subtle">{s.customerName || "—"}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums font-medium">{tug(s.total)}</Table.Cell>
                    <Table.Cell className="text-right">
                      <button type="button"
                        onClick={() => void printReceipt({ ...s, subtotal: s.total + (s.discount || 0), paymentMethod: s.payment })}
                        className="text-ui-fg-interactive txt-compact-small hover:underline">Баримт</button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </TableCard>
        )}
      </Panel>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Өдрийн хаалт",
  icon: ReceiptPercent,
});

export default DayReportPage;
