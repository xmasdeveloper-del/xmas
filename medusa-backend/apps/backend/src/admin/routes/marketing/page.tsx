import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ReceiptPercent } from "@medusajs/icons";
import { Container, Text, Table, Badge, Button, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel } from "../../lib/ui";

type Promo = { id: string; code: string; automatic: boolean; status: string; type: string; value: number | null; currency: string | null; used: number };
type Cart = { id: string; email: string; updated_at: string; value: number; items: { title: string; quantity: number }[] };

async function getJson(path: string) {
  const res = await fetch(`/admin${path}`, { credentials: "include", headers: { "content-type": "application/json" } });
  if (!res.ok) throw new Error(`(${res.status})`);
  return res.json();
}

const nf = (n: number) => new Intl.NumberFormat("mn-MN").format(Math.round(n || 0));
const fmtVal = (p: Promo) => p.value == null ? "—" : p.type === "percentage" ? `${p.value}%` : `₮${nf(p.value)}`;

const MarketingPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        getJson("/marketing/promotions"),
        getJson("/marketing/abandoned-carts?hours=1"),
      ]);
      setPromos(p.promotions || []);
      setCarts(c.carts || []);
      setCartTotal(c.totalValue || 0);
    } catch (e: any) {
      toast.error("Маркетингийн мэдээлэл ачаалж чадсангүй " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (!permLoading && !can("promotions.write")) {
    return <AccessDenied title="Маркетинг" perm="promotions.write" />;
  }

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Маркетинг"
        description="Урамшууллын гүйцэтгэл ба орхисон сагс (борлуулалт сэргээх)."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="small" onClick={load} disabled={loading}>Сэргээх</Button>
            {/* This page was read-only: it reports on coupons but offered no way
                to make or change one, and the owner had no idea the native
                Promotions screen existed. */}
            <Button variant="primary" size="small" onClick={() => { window.location.href = "/app/promotions/create"; }}>
              Шинэ урамшуулал
            </Button>
          </div>
        }
      />

      {/* Promotions */}
      <Panel title={`Урамшуулал (${promos.length})`}>
        <Table>
          <Table.Header><Table.Row>
            <Table.HeaderCell>Код</Table.HeaderCell>
            <Table.HeaderCell>Төрөл</Table.HeaderCell>
            <Table.HeaderCell>Хэмжээ</Table.HeaderCell>
            <Table.HeaderCell>Төлөв</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Ашигласан</Table.HeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {promos.map((p) => (
              <Table.Row key={p.id}>
                <Table.Cell>
                  <a href={`/app/promotions/${p.id}`} className="font-mono text-ui-fg-interactive hover:underline">{p.code}</a>
                  {p.automatic && <Badge size="2xsmall" color="blue" className="ml-2">Авто</Badge>}
                </Table.Cell>
                <Table.Cell className="text-ui-fg-subtle text-xs">{p.type === "percentage" ? "Хувь" : p.type === "fixed" ? "Тогтмол" : p.type}</Table.Cell>
                <Table.Cell>{fmtVal(p)}</Table.Cell>
                <Table.Cell>
                  <Badge size="2xsmall" color={p.status === "active" ? "green" : "grey"}>
                    {p.status === "active" ? "Идэвхтэй" : p.status === "draft" ? "Ноорог" : p.status === "inactive" ? "Идэвхгүй" : p.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="text-right font-medium">{nf(p.used)}</Table.Cell>
              </Table.Row>
            ))}
            {!loading && promos.length === 0 && (
              <Table.Row><Table.Cell {...({ colSpan: 5 } as any)}><Text className="text-ui-fg-subtle py-4" size="small">Урамшуулал алга.</Text></Table.Cell></Table.Row>
            )}
          </Table.Body>
        </Table>
      </Panel>

      {/* Abandoned carts */}
      <Panel
        title={`Орхисон сагс (${carts.length})`}
        actions={carts.length > 0 ? <Badge size="2xsmall" color="orange">₮{nf(cartTotal)} боломжит</Badge> : undefined}
        bodyClassName="p-4"
      >
        <Text className="text-ui-fg-subtle mb-3" size="xsmall">1 цагаас дээш идэвхгүй, имэйлтэй, дуусаагүй сагснууд — эргэн холбогдож сэргээх боломжтой.</Text>
        {carts.length === 0 ? (
          <Text className="text-ui-fg-subtle" size="small">Орхисон сагс алга. 🎉</Text>
        ) : (
          <Table>
            <Table.Header><Table.Row>
              <Table.HeaderCell>Имэйл</Table.HeaderCell>
              <Table.HeaderCell>Бараа</Table.HeaderCell>
              <Table.HeaderCell>Сүүлд</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Дүн</Table.HeaderCell>
            </Table.Row></Table.Header>
            <Table.Body>
              {carts.map((c) => (
                <Table.Row key={c.id}>
                  <Table.Cell>{c.email}</Table.Cell>
                  <Table.Cell className="text-xs text-ui-fg-subtle">{c.items.slice(0, 2).map((i) => `${i.title}×${i.quantity}`).join(", ")}{c.items.length > 2 ? "…" : ""}</Table.Cell>
                  <Table.Cell className="text-xs text-ui-fg-subtle">{c.updated_at?.slice(0, 10)}</Table.Cell>
                  <Table.Cell className="text-right font-medium">₮{nf(c.value)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Panel>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Маркетинг",
  icon: ReceiptPercent,
});

export default MarketingPage;
