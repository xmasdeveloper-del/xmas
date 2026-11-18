import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Gift } from "@medusajs/icons";
import { Container, Text, Table, Button, Input, Badge, Switch, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel, StatCard, StatGrid } from "../../lib/ui";

/**
 * Онооны систем — the rules, the shop's exposure, and one customer at a time.
 *
 * The number that matters here is "Нийт үлдэгдэл": every outstanding point can
 * be turned into a discount code, so it is money the shop has promised and not
 * yet paid. It sits at the top for that reason, not as a vanity metric.
 */

type Settings = { enabled: boolean; earnPercent: number; pointValue: number; minRedeem: number };
type Holder = { customer_id: string; balance: number; earned: number; spent: number; last_at: string | null; email: string | null; name: string | null };
type Totals = { outstanding: number; earned: number; spent: number; holders: number };
type Entry = { id: string; points: number; kind: string; order_id: string | null; code: string | null; note: string | null; created_at: string };
type Person = {
  customer: { id: string; email: string; first_name: string | null; last_name: string | null };
  balance: number; earned: number; spent: number; entries: Entry[];
};

const nf = (n: number) => new Intl.NumberFormat("mn-MN").format(Math.round(n || 0));
const tug = (n: number) => `₮${nf(n)}`;
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("mn-MN", { year: "numeric", month: "short", day: "numeric" }) : "—";

const KIND: Record<string, { label: string; color: "green" | "orange" | "blue" | "red" | "grey" }> = {
  earn: { label: "Худалдан авалт", color: "green" },
  redeem: { label: "Купон болгосон", color: "orange" },
  adjust: { label: "Гараар", color: "blue" },
  revert: { label: "Буцаалт", color: "red" },
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
  return res.status === 204 ? null : res.json();
}

const LoyaltyPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const allowed = can("promotions.write");

  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [totals, setTotals] = useState<Totals | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [looking, setLooking] = useState(false);
  const [grant, setGrant] = useState("");
  const [note, setNote] = useState("");
  const [granting, setGranting] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        adminFetch("/loyalty/settings"),
        adminFetch("/loyalty"),
      ]);
      setSettings(s.settings);
      setDraft(s.settings);
      setTotals(o.totals);
      setHolders(o.holders ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Ачаалагдсангүй");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (permLoading || !allowed) return;
    void loadOverview();
  }, [permLoading, allowed]);

  const saveSettings = async () => {
    if (!draft) return;
    setSavingSettings(true);
    try {
      const r = await adminFetch("/loyalty/settings", { method: "POST", body: JSON.stringify(draft) });
      setSettings(r.settings);
      setDraft(r.settings);
      toast.success("Онооны тохиргоо хадгалагдлаа");
    } catch (e: any) {
      toast.error(e?.message || "Хадгалж чадсангүй");
    } finally {
      setSavingSettings(false);
    }
  };

  const look = async (addr?: string) => {
    const e = (addr ?? email).trim().toLowerCase();
    if (!e) return;
    setEmail(e);
    setLooking(true);
    try {
      setPerson(await adminFetch(`/loyalty?email=${encodeURIComponent(e)}`));
    } catch (err: any) {
      setPerson(null);
      toast.error(err?.message || "Хэрэглэгч олдсонгүй");
    } finally {
      setLooking(false);
    }
  };

  const move = async () => {
    const n = Math.round(Number(grant) || 0);
    if (!person || !n) { toast.error("Онооны тоог оруулна уу (хасахдаа - тэмдэгтэй)."); return; }
    setGranting(true);
    try {
      const r = await adminFetch("/loyalty", {
        method: "POST",
        body: JSON.stringify({ email: person.customer.email, points: n, note: note.trim() || undefined }),
      });
      setPerson(r);
      setGrant(""); setNote("");
      toast.success(`${n > 0 ? "+" : ""}${nf(n)} оноо · шинэ үлдэгдэл ${nf(r.balance)}`);
      void loadOverview();
    } catch (e: any) {
      toast.error(e?.message || "Хадгалж чадсангүй");
    } finally {
      setGranting(false);
    }
  };

  if (permLoading) return null;
  if (!allowed) return <AccessDenied title="Онооны систем" perm="promotions.write" />;

  const dirty = !!draft && !!settings && JSON.stringify(draft) !== JSON.stringify(settings);
  const worth = (points: number) => (settings ? points * settings.pointValue : points);

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Онооны систем"
        description="Худалдан авалт бүрээс оноо цуглуулж, дараагийн худалдан авалтад купон болгон хэрэглэнэ. Сайт болон кассанд адил ажиллана."
        actions={<Button size="small" variant="secondary" onClick={() => void loadOverview()} isLoading={loading}>Шинэчлэх</Button>}
      />

      <StatGrid cols={4}>
        <StatCard
          label="Нийт үлдэгдэл оноо"
          tone="orange"
          loading={loading}
          value={nf(totals?.outstanding || 0)}
        />
        <StatCard label="Онооны өртөг" tone="red" loading={loading} value={tug(worth(totals?.outstanding || 0))} />
        <StatCard label="Оноо цуглуулсан хүн" tone="blue" loading={loading} value={nf(totals?.holders || 0)} />
        <StatCard label="Купон болгосон оноо" tone="green" loading={loading} value={nf(totals?.spent || 0)} />
      </StatGrid>

      {/* Rules */}
      <Panel title="Дүрэм" bodyClassName="border-0">
        {!draft ? (
          <Text size="small" className="text-ui-fg-subtle">Ачаалж байна…</Text>
        ) : (
          <div className="rounded-lg border border-ui-border-base p-4">
            <div className="flex items-center justify-between gap-3 border-b border-ui-border-base pb-3">
              <div>
                <Text size="small" weight="plus">Оноо цуглуулах</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Хаавал шинэ оноо цугларахаа болино. Цугларсан оноо болон гаргасан купон хүчинтэй хэвээр.
                </Text>
              </div>
              <Switch checked={draft.enabled} onCheckedChange={v => setDraft({ ...draft, enabled: v })} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <Text size="xsmall" className="text-ui-fg-subtle">Худалдан авалтын хувь (%)</Text>
                <Input
                  inputMode="decimal"
                  value={String(draft.earnPercent)}
                  onChange={e => setDraft({ ...draft, earnPercent: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
                  className="mt-1 tabular-nums"
                />
                <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                  100,000₮ худалдан авалт → {nf((100000 * draft.earnPercent) / 100 / Math.max(1, draft.pointValue))} оноо
                </Text>
              </label>
              <label className="block">
                <Text size="xsmall" className="text-ui-fg-subtle">1 онооны үнэ (₮)</Text>
                <Input
                  inputMode="numeric"
                  value={String(draft.pointValue)}
                  onChange={e => setDraft({ ...draft, pointValue: Number(e.target.value.replace(/[^0-9]/g, "")) || 1 })}
                  className="mt-1 tabular-nums"
                />
                <Text size="xsmall" className="mt-1 text-ui-fg-muted">Купон болгоход 1 оноо = {tug(draft.pointValue)}</Text>
              </label>
              <label className="block">
                <Text size="xsmall" className="text-ui-fg-subtle">Хамгийн бага хэрэглээ (оноо)</Text>
                <Input
                  inputMode="numeric"
                  value={String(draft.minRedeem)}
                  onChange={e => setDraft({ ...draft, minRedeem: Number(e.target.value.replace(/[^0-9]/g, "")) || 1 })}
                  className="mt-1 tabular-nums"
                />
                <Text size="xsmall" className="mt-1 text-ui-fg-muted">≈ {tug(draft.minRedeem * draft.pointValue)}-ийн купон</Text>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button size="small" onClick={() => void saveSettings()} isLoading={savingSettings} disabled={!dirty}>
                Хадгалах
              </Button>
              {dirty && (
                <Button size="small" variant="transparent" onClick={() => setDraft(settings)}>Болих</Button>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* One customer */}
      <Panel title="Харилцагчийн оноо" bodyClassName="border-0">
        <div className="rounded-lg border border-ui-border-base p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void look(); } }}
              placeholder="И-мэйл хаяг"
              className="w-[280px]"
            />
            <Button size="small" variant="secondary" onClick={() => void look()} isLoading={looking} disabled={!email.trim()}>
              Хайх
            </Button>
          </div>

          {person && (
            <div className="mt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ui-border-base pb-3">
                <div>
                  <Text size="small" weight="plus">
                    {[person.customer.first_name, person.customer.last_name].filter(Boolean).join(" ") || person.customer.email}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">{person.customer.email}</Text>
                </div>
                <div className="text-right">
                  <Text size="small" weight="plus" className="tabular-nums">{nf(person.balance)} оноо</Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">≈ {tug(worth(person.balance))}</Text>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="block">
                  <Text size="xsmall" className="text-ui-fg-subtle">Оноо нэмэх / хасах</Text>
                  <Input
                    value={grant}
                    onChange={e => setGrant(e.target.value.replace(/[^0-9-]/g, ""))}
                    placeholder="500 эсвэл -500"
                    className="mt-1 w-[150px] tabular-nums"
                  />
                </label>
                <label className="block flex-1 min-w-[200px]">
                  <Text size="xsmall" className="text-ui-fg-subtle">Шалтгаан</Text>
                  <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Жишээ: буцаалтын нөхөн оноо" className="mt-1" />
                </label>
                <Button size="small" onClick={() => void move()} isLoading={granting} disabled={!grant.trim()}>
                  Бүртгэх
                </Button>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-ui-border-base">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Огноо</Table.HeaderCell>
                      <Table.HeaderCell>Төрөл</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Оноо</Table.HeaderCell>
                      <Table.HeaderCell>Тайлбар</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {person.entries.length === 0 ? (
                      <Table.Row>
                        <Table.Cell className="text-ui-fg-subtle">Хөдөлгөөн алга.</Table.Cell>
                        <Table.Cell /><Table.Cell /><Table.Cell />
                      </Table.Row>
                    ) : person.entries.map(en => {
                      const k = KIND[en.kind] || { label: en.kind, color: "grey" as const };
                      return (
                        <Table.Row key={en.id}>
                          <Table.Cell className="text-ui-fg-subtle">{day(en.created_at)}</Table.Cell>
                          <Table.Cell><Badge size="2xsmall" color={k.color}>{k.label}</Badge></Table.Cell>
                          <Table.Cell className={`text-right tabular-nums font-medium ${en.points < 0 ? "text-ui-fg-subtle" : ""}`}>
                            {en.points > 0 ? "+" : ""}{nf(en.points)}
                          </Table.Cell>
                          <Table.Cell className="text-ui-fg-subtle">
                            {[en.code, en.note].filter(Boolean).join(" · ") || "—"}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Who holds what */}
      <Panel title="Хамгийн их оноо цуглуулсан">
        {loading ? (
          <div className="p-4"><Text size="small" className="text-ui-fg-subtle">Ачаалж байна…</Text></div>
        ) : holders.length === 0 ? (
          <div className="p-4">
            <Text size="small" className="text-ui-fg-subtle">
              Одоогоор хэн ч оноо цуглуулаагүй байна. Сайт дээр худалдан авалт хийсэн эсвэл кассанд харилцагчаар бүртгэгдсэн хүн оноо авна.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Харилцагч</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Үлдэгдэл</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Цуглуулсан</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Хэрэглэсэн</Table.HeaderCell>
                <Table.HeaderCell>Сүүлд</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {holders.map(h => (
                <Table.Row key={h.customer_id}>
                  <Table.Cell>
                    <div className="font-medium">{h.name || h.email || h.customer_id}</div>
                    {h.name && h.email && <div className="text-ui-fg-subtle text-xs">{h.email}</div>}
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums font-medium">{nf(h.balance)}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums text-ui-fg-subtle">{nf(h.earned)}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums text-ui-fg-subtle">{nf(h.spent)}</Table.Cell>
                  <Table.Cell className="text-ui-fg-subtle">{day(h.last_at)}</Table.Cell>
                  <Table.Cell>
                    {h.email && (
                      <Button size="small" variant="transparent" onClick={() => void look(h.email!)}>Үзэх</Button>
                    )}
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
  label: "Онооны систем",
  icon: Gift,
});

export default LoyaltyPage;
