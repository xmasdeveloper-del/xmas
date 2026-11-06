import { defineRouteConfig } from "@medusajs/admin-sdk";
import { UsersSolid } from "@medusajs/icons";
import { Container, Heading, Text, Table, Badge, Select, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { ROLES, Role } from "../../../lib/rbac";
import { usePermissions } from "../../lib/perms";
import { PageHeader, Panel } from "../../lib/ui";

type AdminUser = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  metadata?: { role?: Role } | null;
};

const ROLE_LABEL = new Map(ROLES.map((r) => [r.value, r.label]));

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
  return res;
}

const TeamPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/users?limit=200");
      setUsers((await res.json()).users || []);
    } catch (e: any) {
      toast.error(e.message || "Хэрэглэгч ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const assign = async (id: string, role: Role) => {
    setSaving(id);
    try {
      await adminFetch(`/users/${id}/role`, { method: "POST", body: JSON.stringify({ role }) });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, metadata: { ...(u.metadata || {}), role } } : u)));
      toast.success(`Эрх шинэчлэгдлээ: ${ROLE_LABEL.get(role)}`);
    } catch (e: any) {
      toast.error(e.message || "Эрх онооход алдаа гарлаа");
    } finally {
      setSaving(null);
    }
  };

  if (!permLoading && !can("team.manage")) {
    return (
      <Container className="p-6">
        <Heading level="h1">Баг ба эрх</Heading>
        <Text className="text-ui-fg-subtle mt-2">Энэ хэсгийг үзэх эрх танд байхгүй байна (team.manage шаардлагатай).</Text>
      </Container>
    );
  }

  const name = (u: AdminUser) => [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Баг ба эрх"
        description="Ажилтнуудад дүр (role) оноож, админ хэсгийн эрхийг хязгаарлана. Шинээр урьсан хэрэглэгч дүр оноох хүртэл ЯМАР Ч эрхгүй — доороос дүрийг нь сонгож өгнө үү."
      />

      <Panel>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Хэрэглэгч</Table.HeaderCell>
              <Table.HeaderCell>Имэйл</Table.HeaderCell>
              <Table.HeaderCell>Одоогийн дүр</Table.HeaderCell>
              <Table.HeaderCell>Дүр өөрчлөх</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row><Table.Cell {...({ colSpan: 4 } as any)}><Text className="text-ui-fg-subtle py-4">Ачаалж байна…</Text></Table.Cell></Table.Row>
            ) : (
              users.map((u) => {
                const current = u.metadata?.role;
                return (
                  <Table.Row key={u.id}>
                    <Table.Cell>{name(u)}</Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle">{u.email}</Table.Cell>
                    <Table.Cell>
                      {current ? (
                        <Badge size="2xsmall" color={current === "super_admin" ? "purple" : "grey"}>{ROLE_LABEL.get(current) || current}</Badge>
                      ) : (
                        <Badge size="2xsmall" color="red">Дүр оноогоогүй — эрхгүй</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="w-[220px]">
                        <Select
                          size="small"
                          value={current || ""}
                          onValueChange={(v) => assign(u.id, v as Role)}
                          disabled={saving === u.id}
                        >
                          <Select.Trigger>
                            <Select.Value placeholder="Дүр сонгох…" />
                          </Select.Trigger>
                          <Select.Content>
                            {ROLES.map((r) => (
                              <Select.Item key={r.value} value={r.value}>{r.label}</Select.Item>
                            ))}
                          </Select.Content>
                        </Select>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </Panel>

      {/* Role reference */}
      <div className="px-6 py-4">
        <Text weight="plus" size="small" className="mb-2">Дүрүүдийн тайлбар</Text>
        <div className="flex flex-col gap-2">
          {ROLES.map((r) => (
            <div key={r.value} className="flex items-start gap-3">
              <Badge size="2xsmall" color={r.value === "super_admin" ? "purple" : "grey"} className="mt-0.5 shrink-0">{r.label}</Badge>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {r.permissions[0] === "*" ? "Бүх эрх" : (r.permissions as string[]).join(", ")}
              </Text>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  rank: 5,
  label: "Баг ба эрх",
  icon: UsersSolid,
});

export default TeamPage;
