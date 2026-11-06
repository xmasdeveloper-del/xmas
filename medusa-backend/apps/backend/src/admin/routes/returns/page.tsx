import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ArrowUturnLeft } from "@medusajs/icons";
import { Container, Table, Button, Badge, Text, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel } from "../../lib/ui";

type ReturnItem = {
  quantity: number;
  item_id: string;
  // The order line being returned: product name and the variant (size).
  item?: { title?: string; product_title?: string; variant_sku?: string } | null;
};
type ReturnRow = {
  id: string;
  status: string;
  order_id: string;
  display_id?: number;
  created_at: string;
  items: ReturnItem[];
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

const statusColor: Record<string, "orange" | "green" | "grey"> = {
  requested: "orange",
  received: "green",
  canceled: "grey",
};

// The status column was the one place this page still showed raw English
// enum values to Mongolian staff.
const STATUS_LABEL: Record<string, string> = {
  requested: "Хүсэлт гаргасан",
  received: "Хүлээн авсан",
  canceled: "Татгалзсан",
  partially_received: "Хэсэгчлэн хүлээн авсан",
};

const ReturnsPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Ask for the product and size too: "2 ш" alone gave staff nothing to
      // judge, and in a shoe shop the size coming back is the whole point.
      const data = await adminFetch(
        "/returns?fields=id,status,order_id,display_id,created_at,items.item_id,items.quantity,"
        + "items.item.title,items.item.product_title,items.item.variant_sku"
        + "&limit=100&order=-created_at",
      );
      setRows((data.returns || []) as ReturnRow[]);
    } catch (e: any) {
      toast.error(e.message || "Буцаалтуудыг ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    // Receiving the goods back and closing the return cannot be undone here.
    if (!window.confirm("Буцаалтыг зөвшөөрч, барааг хүлээн авах уу? Энэ үйлдлийг буцаах боломжгүй.\n\nАнхаар: мөнгө буцаалт автоматаар хийгдэхгүй — захиалгын хуудаснаас гараар хийнэ.")) return;
    setBusy(id);
    try {
      await adminFetch(`/returns/${id}/approve`, { method: "POST" });
      toast.success("Буцаалтыг зөвшөөрч, хүлээн авлаа. Мөнгө буцаалтыг захиалгын хуудаснаас хийнэ үү.");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Зөвшөөрөх үед алдаа гарлаа");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Татгалзах шалтгаан (заавал биш):", "");
    if (reason === null) return; // cancelled the prompt
    setBusy(id);
    try {
      await adminFetch(`/returns/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      toast.success("Буцаалтын хүсэлтээс татгалзлаа");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Татгалзах үед алдаа гарлаа");
    } finally {
      setBusy(null);
    }
  };

  const pending = rows.filter(r => r.status === "requested");
  const canApprove = can("returns.write");

  if (!permLoading && !can("returns.read")) {
    return <AccessDenied title="Буцаалтын хүсэлт" perm="returns.read" />;
  }

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Буцаалтын хүсэлт"
        description="Хэрэглэгчийн буцаалтын хүсэлтийг зөвшөөрч, хүлээн авна уу."
        actions={
          <Button variant="secondary" size="small" onClick={load} disabled={loading}>
            Сэргээх
          </Button>
        }
      />

      <div className="px-6 py-3">
        <Badge color="orange">{pending.length}</Badge>{" "}
        <Text className="text-ui-fg-subtle inline" size="small">хүлээгдэж буй</Text>
      </div>

      <Panel>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Буцаалт</Table.HeaderCell>
            <Table.HeaderCell>Захиалга</Table.HeaderCell>
            <Table.HeaderCell>Бараа</Table.HeaderCell>
            <Table.HeaderCell>Огноо</Table.HeaderCell>
            <Table.HeaderCell>Төлөв</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.length === 0 && !loading && (
            <Table.Row>
              <Table.Cell {...({ colSpan: 6 } as any)}>
                <Text className="text-ui-fg-subtle py-4" size="small">Буцаалтын хүсэлт алга.</Text>
              </Table.Cell>
            </Table.Row>
          )}
          {rows.map(r => {
            const qty = (r.items || []).reduce((a, b) => a + (b.quantity || 0), 0);
            return (
              <Table.Row key={r.id}>
                <Table.Cell className="font-mono text-xs">{r.id.slice(0, 16)}…</Table.Cell>
                <Table.Cell>
                  <a href={`/app/orders/${r.order_id}`} className="text-ui-fg-interactive hover:underline">
                    {r.display_id ? `#${r.display_id}` : r.order_id.slice(0, 12)}
                  </a>
                </Table.Cell>
                <Table.Cell>
                  {/* Which shoe and which size is coming back — the thing that
                      decides whether it goes straight back on the shelf. */}
                  <div className="flex flex-col gap-0.5">
                    {(r.items || []).map((it, i) => {
                      const title = it.item?.product_title || it.item?.title || "Бараа";
                      const size = it.item?.title && it.item?.product_title && it.item.title !== it.item.product_title
                        ? it.item.title : "";
                      return (
                        <span key={it.item_id || i} className="text-xs">
                          {title}{size && <b> · {size}</b>}
                          <span className="text-ui-fg-subtle"> ×{it.quantity}</span>
                        </span>
                      );
                    })}
                    {!(r.items || []).length && <span className="text-xs">{qty} ш</span>}
                  </div>
                </Table.Cell>
                <Table.Cell>{r.created_at?.slice(0, 10)}</Table.Cell>
                <Table.Cell>
                  <Badge color={statusColor[r.status] || "grey"} size="2xsmall">
                    {STATUS_LABEL[r.status] || r.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {r.status === "requested" && canApprove ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button size="small" variant="secondary" disabled={!!busy} onClick={() => reject(r.id)}>
                        Татгалзах
                      </Button>
                      <Button size="small" variant="primary" isLoading={busy === r.id} disabled={!!busy} onClick={() => approve(r.id)}>
                        Зөвшөөрөх
                      </Button>
                    </div>
                  ) : (
                    <Text className="text-ui-fg-muted" size="small">—</Text>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
      </Panel>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Буцаалт",
  icon: ArrowUturnLeft,
});

export default ReturnsPage;
