import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ChartBar } from "@medusajs/icons";
import { Container, Text, Button, Table, Badge, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, StatGrid, StatCard, Panel } from "../../lib/ui";

type Overview = {
  orders: number;
  customers: number;
  revenue: number;
  avgOrder: number;
  scanned: number;
  capped: boolean;
  topProducts: { name: string; qty: number; revenue: number }[];
  recent: { id: string; email: string; total: number; date: string }[];
};

async function adminFetch(path: string) {
  const res = await fetch(`/admin${path}`, { credentials: "include", headers: { "content-type": "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

const tug = (n: number) => `₮${new Intl.NumberFormat("en-US").format(Math.round(n || 0))}`;
const nf = (n: number) => new Intl.NumberFormat("mn-MN").format(n || 0);

// Inline icons (no extra deps, so an icon name can never break the build).
const ico = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcoRevenue = () => (<svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.2c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1.1 1.6-2.5 1.6-2.5.7-2.5 1.7 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7" /></svg>);
const IcoOrders = () => (<svg {...ico}><path d="M6 7h15l-1.5 9H7.5L6 4H3" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></svg>);
const IcoAvg = () => (<svg {...ico}><path d="M4 19V5M4 15l4-4 4 3 8-8" /><path d="M20 6v4h-4" /></svg>);
const IcoCustomers = () => (<svg {...ico}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.2a3.2 3.2 0 0 1 0 6M18 13.5a5.5 5.5 0 0 1 3 5" /></svg>);

const AnalyticsPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await adminFetch("/analytics/overview"));
    } catch (e: any) {
      toast.error(e.message || "Аналитик ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (!permLoading && !can("analytics.read")) {
    return <AccessDenied title="Аналитик" perm="analytics.read" />;
  }

  const maxRev = Math.max(1, ...(data?.topProducts || []).map(p => p.revenue));

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Аналитик"
        description="Борлуулалтын тойм, тэргүүлэх бараа, сүүлийн захиалга."
        actions={<Button variant="secondary" size="small" onClick={load} disabled={loading} isLoading={loading}>Сэргээх</Button>}
      />

      {/* KPI cards */}
      <div>
        <StatGrid cols={4}>
          <StatCard icon={<IcoRevenue />} tone="green" label="Нийт орлого" value={data ? tug(data.revenue) : ""} loading={loading} />
          <StatCard icon={<IcoOrders />} tone="blue" label="Захиалга" value={data ? nf(data.orders) : ""} loading={loading} />
          <StatCard icon={<IcoAvg />} tone="orange" label="Дундаж захиалга" value={data ? tug(data.avgOrder) : ""} loading={loading} />
          <StatCard icon={<IcoCustomers />} tone="purple" label="Харилцагч" value={data ? nf(data.customers) : ""} loading={loading} />
        </StatGrid>
        <Text className="text-ui-fg-muted px-6 pb-1 block" size="xsmall">
          Орлого = купоны хөнгөлөлт, буцаалтыг хассан бодит дүн. Цуцалсан, ноорог захиалга ороогүй.
        </Text>
        {data?.capped && (
          <Text className="text-ui-fg-muted px-6 pb-5 block" size="xsmall">
            Орлого/тэргүүлэх бараа нь сүүлийн {nf(data.scanned)} захиалгаас тооцоолсон.
          </Text>
        )}
      </div>

      {/* Top products */}
      <Panel title="Тэргүүлэх бараа (орлогоор)">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Бараа</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Тоо</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Орлого</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {loading && (data?.topProducts || []).length === 0 && (
                [0, 1, 2].map(i => (
                  <Table.Row key={i}>
                    <Table.Cell><div className="h-4 w-40 rounded bg-ui-bg-component animate-pulse" /></Table.Cell>
                    <Table.Cell><div className="h-4 w-10 ml-auto rounded bg-ui-bg-component animate-pulse" /></Table.Cell>
                    <Table.Cell><div className="h-4 w-20 ml-auto rounded bg-ui-bg-component animate-pulse" /></Table.Cell>
                  </Table.Row>
                ))
              )}
              {!loading && (data?.topProducts || []).length === 0 && (
                <Table.Row><Table.Cell><Text className="text-ui-fg-subtle py-3" size="small">Захиалга алга.</Text></Table.Cell></Table.Row>
              )}
              {(data?.topProducts || []).map((p, i) => (
                <Table.Row key={p.name + i}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ui-bg-component text-ui-fg-subtle txt-compact-xsmall-plus tabular-nums">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{p.name}</div>
                        <div className="mt-1.5 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-ui-bg-component">
                          <div className="h-full rounded-full bg-ui-tag-orange-icon" style={{ width: `${Math.max(4, Math.round((p.revenue / maxRev) * 100))}%` }} />
                        </div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{nf(p.qty)}</Table.Cell>
                  <Table.Cell className="text-right font-medium tabular-nums">{tug(p.revenue)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
      </Panel>

      {/* Recent orders */}
      <Panel title="Сүүлийн захиалга">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Захиалга</Table.HeaderCell>
                <Table.HeaderCell>Имэйл</Table.HeaderCell>
                <Table.HeaderCell>Огноо</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Дүн</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {loading && (data?.recent || []).length === 0 && (
                [0, 1, 2].map(i => (
                  <Table.Row key={i}>
                    <Table.Cell><div className="h-4 w-16 rounded bg-ui-bg-component animate-pulse" /></Table.Cell>
                    <Table.Cell><div className="h-4 w-36 rounded bg-ui-bg-component animate-pulse" /></Table.Cell>
                    <Table.Cell><div className="h-4 w-20 rounded bg-ui-bg-component animate-pulse" /></Table.Cell>
                    <Table.Cell><div className="h-4 w-16 ml-auto rounded bg-ui-bg-component animate-pulse" /></Table.Cell>
                  </Table.Row>
                ))
              )}
              {!loading && (data?.recent || []).length === 0 && (
                <Table.Row><Table.Cell><Text className="text-ui-fg-subtle py-3" size="small">Захиалга алга.</Text></Table.Cell></Table.Row>
              )}
              {(data?.recent || []).map(o => (
                <Table.Row key={o.id}>
                  <Table.Cell><Badge size="2xsmall">{o.id}</Badge></Table.Cell>
                  <Table.Cell className="text-ui-fg-subtle">{o.email}</Table.Cell>
                  <Table.Cell>{o.date?.slice(0, 10)}</Table.Cell>
                  <Table.Cell className="text-right font-medium tabular-nums">{tug(o.total)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
      </Panel>
    </Container>
  );
};

export const config = defineRouteConfig({
  rank: 2,
  label: "Аналитик",
  icon: ChartBar,
});

export default AnalyticsPage;
