import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ClockSolid } from "@medusajs/icons";
import { Container, Text, Table, Badge, Button, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel } from "../../lib/ui";

type Entry = { at: number; actor: string; action: string; target?: string; meta?: Record<string, any> };

const ACTION_LABEL: Record<string, string> = {
  "role.assign": "Эрх онооно",
  "catalog.bulk_edit": "Багц засвар",
  "fulfillment.batch": "Багц биелүүлэлт",
  "fulfillment.ship": "Илгээв",
  "cms.save": "Контент хадгалав",
};

const AuditPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/audit", { credentials: "include", headers: { "content-type": "application/json" } });
      if (!res.ok) throw new Error(`(${res.status})`);
      setEntries((await res.json()).entries || []);
    } catch (e: any) {
      toast.error("Аудит лог ачаалж чадсангүй " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (!permLoading && !can("team.manage")) {
    return <AccessDenied title="Аудит лог" perm="team.manage" />;
  }

  const fmt = (ms: number) => new Date(ms).toLocaleString("mn-MN");

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Аудит лог"
        description="Чухал үйлдлүүд: эрх, багц засвар, биелүүлэлт, контент. (Сүүлийн 500)"
        actions={<Button variant="secondary" size="small" onClick={load} disabled={loading}>Сэргээх</Button>}
      />
      <Panel>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Хэзээ</Table.HeaderCell>
            <Table.HeaderCell>Хэн</Table.HeaderCell>
            <Table.HeaderCell>Үйлдэл</Table.HeaderCell>
            <Table.HeaderCell>Обьект</Table.HeaderCell>
            <Table.HeaderCell>Дэлгэрэнгүй</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {!loading && entries.length === 0 && (
            <Table.Row><Table.Cell {...({ colSpan: 5 } as any)}><Text className="text-ui-fg-subtle py-6" size="small">Одоогоор бүртгэл алга.</Text></Table.Cell></Table.Row>
          )}
          {entries.map((e, i) => (
            <Table.Row key={i}>
              <Table.Cell className="text-ui-fg-subtle text-xs whitespace-nowrap">{fmt(e.at)}</Table.Cell>
              <Table.Cell className="text-xs">{e.actor}</Table.Cell>
              <Table.Cell><Badge size="2xsmall">{ACTION_LABEL[e.action] || e.action}</Badge></Table.Cell>
              <Table.Cell className="text-xs text-ui-fg-subtle">{e.target || "—"}</Table.Cell>
              <Table.Cell className="text-xs text-ui-fg-subtle font-mono max-w-[280px] truncate">{e.meta ? JSON.stringify(e.meta) : ""}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      </Panel>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Аудит лог",
  icon: ClockSolid,
});

export default AuditPage;
