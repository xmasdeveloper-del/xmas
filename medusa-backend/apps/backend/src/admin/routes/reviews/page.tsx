import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ChatBubbleLeftRight } from "@medusajs/icons";
import { Container, Text, Table, Badge, Button, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel } from "../../lib/ui";

type Status = "pending" | "approved" | "rejected";
type Review = {
  id: string;
  product_id: string;
  name: string;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  status: Status;
  created_at: string;
};

const TABS: { key: Status | "all"; label: string }[] = [
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "approved", label: "Нийтлэгдсэн" },
  { key: "rejected", label: "Татгалзсан" },
  { key: "all", label: "Бүгд" },
];

const TONE: Record<Status, "orange" | "green" | "red"> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
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

const ReviewsPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const canWrite = can("content.write");

  const [tab, setTab] = useState<Status | "all">("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (status: Status | "all") => {
    setLoading(true);
    try {
      const data = await adminFetch(`/reviews?status=${status}`);
      setReviews(data.reviews || []);
      setCounts(data.counts || {});
    } catch (e: any) {
      toast.error("Сэтгэгдэл ачаалж чадсангүй " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(tab); }, [tab]);

  const moderate = async (id: string, status: Status) => {
    setBusy(id);
    try {
      await adminFetch(`/reviews/${id}`, { method: "POST", body: JSON.stringify({ status }) });
      toast.success(status === "approved" ? "Нийтлэгдлээ" : "Татгалзлаа");
      await load(tab);
    } catch (e: any) {
      toast.error(e.message || "Болсонгүй");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await adminFetch(`/reviews/${id}`, { method: "DELETE" });
      toast.success("Устгалаа");
      await load(tab);
    } catch (e: any) {
      toast.error(e.message || "Болсонгүй");
    } finally {
      setBusy(null);
    }
  };

  if (!permLoading && !canWrite) {
    return <AccessDenied title="Сэтгэгдэл" perm="content.write" />;
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("mn-MN");

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Сэтгэгдэл"
        description="Хэрэглэгчийн сэтгэгдлийг шалгаж нийтэлнэ. Зөвшөөрсөн сэтгэгдэл л дэлгүүрт харагдана."
        actions={<Button size="small" variant="secondary" onClick={() => load(tab)} disabled={loading}>Шинэчлэх</Button>}
      />

      <div className="flex flex-wrap gap-2 px-6 py-3">
        {TABS.map(x => (
          <Button
            key={x.key}
            size="small"
            variant={tab === x.key ? "primary" : "transparent"}
            onClick={() => setTab(x.key)}
          >
            {x.label}
            {x.key !== "all" && counts[x.key] ? ` (${counts[x.key]})` : ""}
          </Button>
        ))}
      </div>

      <Panel>
        {loading ? (
          <Text className="px-6 py-8 text-ui-fg-subtle">Уншиж байна…</Text>
        ) : reviews.length === 0 ? (
          <Text className="px-6 py-8 text-ui-fg-subtle">
            {tab === "pending" ? "Хүлээгдэж буй сэтгэгдэл алга." : "Энд сэтгэгдэл алга."}
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Хэрэглэгч</Table.HeaderCell>
                <Table.HeaderCell>Үнэлгээ</Table.HeaderCell>
                <Table.HeaderCell>Сэтгэгдэл</Table.HeaderCell>
                <Table.HeaderCell>Огноо</Table.HeaderCell>
                <Table.HeaderCell>Төлөв</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {reviews.map(r => (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="font-medium">{r.name}</span>
                      {r.verified && <Badge size="2xsmall" color="green">Баталгаажсан</Badge>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-ui-tag-orange-text">
                      {"★".repeat(r.rating)}<span className="text-ui-fg-muted">{"★".repeat(5 - r.rating)}</span>
                    </span>
                  </Table.Cell>
                  <Table.Cell className="max-w-[420px]">
                    {r.title && <div className="font-medium">{r.title}</div>}
                    <div className="text-ui-fg-subtle">{r.body}</div>
                    <div className="mt-1 text-ui-fg-muted text-xs">{r.product_id}</div>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">{fmt(r.created_at)}</Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={TONE[r.status]}>{r.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-2">
                      {r.status !== "approved" && (
                        <Button size="small" variant="secondary" disabled={busy === r.id} onClick={() => moderate(r.id, "approved")}>
                          Нийтлэх
                        </Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button size="small" variant="transparent" disabled={busy === r.id} onClick={() => moderate(r.id, "rejected")}>
                          Татгалзах
                        </Button>
                      )}
                      <Button size="small" variant="danger" disabled={busy === r.id} onClick={() => remove(r.id)}>
                        Устгах
                      </Button>
                    </div>
                  </Table.Cell>
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
  label: "Сэтгэгдэл",
  icon: ChatBubbleLeftRight,
});

export default ReviewsPage;
