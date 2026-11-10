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

  // Who has no role yet. The rule the server enforces (src/lib/rbac.ts) is:
  // a role-less account is trusted only while it is the SOLE admin. So the
  // moment a second account exists, every role-less one loses everything —
  // including the owner's own, which has never needed a role until now. That
  // is a lock-out waiting for the day a cashier is added, and nothing on this
  // page said so.
  const roleless = users.filter((u) => !u.metadata?.role);
  const aboutToLockOut = roleless.length > 0 && users.length > 1;
  const soleAdmin = roleless.length === 1 && users.length === 1;

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Баг ба эрх"
        description="Ажилтнуудад дүр (role) оноож, админ хэсгийн эрхийг хязгаарлана. Шинээр урьсан хэрэглэгч дүр оноох хүртэл ЯМАР Ч эрхгүй — доороос дүрийг нь сонгож өгнө үү."
      />

      {aboutToLockOut && (
        <div className="px-6 pt-4">
          <div className="rounded-lg border border-ui-tag-red-border bg-ui-tag-red-bg px-4 py-3">
            <Text size="small" weight="plus" className="text-ui-tag-red-text">
              {roleless.length} бүртгэлд дүр оноогоогүй байна — {roleless.map((u) => u.email).join(", ")}
            </Text>
            <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
              Дүргүй бүртгэл зөвхөн цор ганц админ байхдаа эрхтэй байдаг. Өөр хэрэглэгч
              бүртгэгдсэн тул эдгээр нь одоо админы аль ч хэсэгт орж чадахгүй. Хэрэв
              эзэмшигчийн бүртгэл дотор нь байгаа бол даруй <b>Super Admin</b> дүр оноо.
            </Text>
          </div>
        </div>
      )}

      {soleAdmin && (
        <div className="px-6 pt-4">
          <div className="rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg px-4 py-3">
            <Text size="small" weight="plus" className="text-ui-tag-orange-text">
              Таны бүртгэлд дүр оноогоогүй байна
            </Text>
            <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
              Одоогоор цор ганц админ тул бүх эрхтэй. Гэхдээ хоёр дахь хэрэглэгч нэмэх
              үед энэ бүртгэл эрхээ алдана — ажилтан нэмэхээсээ өмнө өөртөө
              <b> Super Admin</b> дүр оноо.
            </Text>
          </div>
        </div>
      )}

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
                        <Badge size="2xsmall" color={soleAdmin ? "orange" : "red"}>
                          {soleAdmin ? "Дүргүй — цор ганц админ тул эрхтэй" : "Дүр оноогоогүй — эрхгүй"}
                        </Badge>
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
  label: "Баг ба эрх",
  icon: UsersSolid,
});

export default TeamPage;
