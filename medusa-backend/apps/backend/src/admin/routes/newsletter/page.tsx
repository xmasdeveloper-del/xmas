import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Envelope } from "@medusajs/icons";
import { Container, Text, Table, Button, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel } from "../../lib/ui";

type Subscriber = {
  id: string;
  email: string;
  lang: string | null;
  source: string | null;
  created_at: string;
};

const nf = new Intl.NumberFormat("mn-MN");

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("mn-MN", { year: "numeric", month: "short", day: "numeric" });

/**
 * The addresses visitors left in the footer.
 *
 * The box has been on the site from the start and threw every address away;
 * now that they are kept, this is where the owner reads them. The CSV button
 * is the point of the page — the list is only worth having if it can be
 * carried to whatever actually sends the mail.
 */
const NewsletterPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const allowed = can("customers.read");

  const [rows, setRows] = useState<Subscriber[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permLoading || !allowed) return;
    let dropped = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/admin/newsletter?limit=500", { credentials: "include" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (dropped) return;
        setRows(data.subscribers ?? []);
        setCount(data.count ?? 0);
      } catch (e: any) {
        if (!dropped) toast.error(e?.message || "Жагсаалт ачаалагдсангүй");
      } finally {
        if (!dropped) setLoading(false);
      }
    })();
    return () => { dropped = true; };
  }, [permLoading, allowed]);

  async function download() {
    try {
      const res = await fetch("/admin/newsletter?format=csv&limit=1000", { credentials: "include" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Татаж чадсангүй");
    }
  }

  if (permLoading) return null;
  if (!allowed) return <AccessDenied title="Мэдээллийн захидал" perm="customers.read" />;

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Мэдээллийн захидал"
        description="Сайтын хөл хэсэгт имэйлээ үлдээсэн хүмүүс. Шинэ бараа ирэхэд эдгээр хаяг руу бичнэ."
        actions={
          <Button size="small" variant="secondary" onClick={download} disabled={rows.length === 0}>
            CSV татах
          </Button>
        }
      />

      <Panel title={`${nf.format(count)} хаяг`}>
        {loading ? (
          <Text size="small" className="text-ui-fg-subtle">Ачаалж байна…</Text>
        ) : rows.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            Одоогоор хэн ч бүртгүүлээгүй байна.
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Имэйл</Table.HeaderCell>
                <Table.HeaderCell>Хэл</Table.HeaderCell>
                <Table.HeaderCell>Эх сурвалж</Table.HeaderCell>
                <Table.HeaderCell>Бүртгүүлсэн</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map(r => (
                <Table.Row key={r.id}>
                  <Table.Cell className="font-medium">{r.email}</Table.Cell>
                  <Table.Cell className="text-ui-fg-subtle">{r.lang?.toUpperCase() || "—"}</Table.Cell>
                  <Table.Cell className="text-ui-fg-subtle">{r.source || "—"}</Table.Cell>
                  <Table.Cell className="text-ui-fg-subtle">{day(r.created_at)}</Table.Cell>
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
  label: "Мэдээллийн захидал",
  icon: Envelope,
});

export default NewsletterPage;
