import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DocumentText } from "@medusajs/icons";
import { Container, Text, Button, Input, Textarea, Label, Switch, toast } from "@medusajs/ui";
import { Photo, ArrowUpTray } from "@medusajs/icons";
import { useEffect, useRef, useState } from "react";
import { usePermissions } from "../../lib/perms";
import { AccessDenied } from "../../lib/AccessDenied";
import { PageHeader, Panel } from "../../lib/ui";

type Bi = { mn: string; en: string };
type HeroImage = { img: string; alt: Bi };
type Hero = {
  titleA: Bi; titleB: Bi; blurb: Bi; ring: Bi;
  cta: Bi; ctaShort: Bi; ctaHref: string;
  panelLabel: Bi; panelTitle: Bi; panelHref: string;
  images: HeroImage[];
};
type Promo = { enabled: boolean; kicker: Bi; title: Bi; desc: Bi; cta: Bi; href: string; img: string };
type Content = { hero: Hero; promo: Promo };

// The seven slots of the hero wall, in the order the page renders them, with
// the shot each one ships with. Naming the position matters: the owner is
// choosing a photo for a specific hole in a staggered grid, and two of the
// columns are hidden on a phone.
const SLOTS: { where: string; shape: string; file: string }[] = [
  { where: "1-р багана, дээд", shape: "өндөр", file: "orange-runner.webp" },
  { where: "1-р багана, доод", shape: "жижиг", file: "amber-grin.webp" },
  { where: "2-р багана", shape: "өндөр · утсан дээр харагдахгүй", file: "sage-coat.webp" },
  { where: "Дундах багана", shape: "хөрөг", file: "gold-portrait.webp" },
  { where: "4-р багана", shape: "өндөр · утсан дээр харагдахгүй", file: "blue-puffer.webp" },
  { where: "5-р багана, дээд", shape: "өндөр", file: "green-hearts.webp" },
  { where: "5-р багана, доод", shape: "жижиг", file: "pine-jacket.webp" },
];

const EMPTY_BI: Bi = { mn: "", en: "" };

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/admin${path}`, { credentials: "include", headers: { "content-type": "application/json" }, ...init });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

// Upload a picture to Medusa's file provider (local in dev, R2/S3 in prod) and
// return its public URL. Uses the built-in admin uploads endpoint — no extra
// backend needed. NOTE: don't set content-type; the browser adds the multipart
// boundary, and the field name must be "files" (router uses .array("files")).
async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("files", file);
  const res = await fetch("/admin/uploads", { method: "POST", credentials: "include", body: fd });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as any)?.message || `Байршуулах амжилтгүй (${res.status})`);
  }
  const j = await res.json();
  const url = j?.files?.[0]?.url;
  if (!url) throw new Error("URL буцаж ирсэнгүй");
  return url;
}

// Image control: a live thumbnail + a URL field (paste a hosted link) + an
// "upload" button that sends a local file to the store's file provider and fills
// the URL in automatically. So a non-technical owner can just pick a photo.
const ImageField = ({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (url: string) => void }) => {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadImage(file)); toast.success("Зураг орууллаа"); }
    catch (e: any) { toast.error(e.message || "Зураг оруулж чадсангүй"); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-1">
      <Label size="small">{label}</Label>
      {hint && <Text className="text-ui-fg-subtle" size="xsmall">{hint}</Text>}
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-subtle">
          {value
            ? <img src={value} alt="" className="h-full w-full object-cover" />
            : <Photo className="text-ui-fg-muted" />}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Хоосон = өгөгдмөл зураг" />
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { pick(e.target.files?.[0]); if (e.currentTarget) e.currentTarget.value = ""; }} />
            <Button variant="secondary" size="small" isLoading={busy} onClick={() => fileRef.current?.click()}>
              <ArrowUpTray /> Зураг оруулах
            </Button>
            {value && !busy && (
              <Button variant="transparent" size="small" onClick={() => onChange("")}>Өгөгдмөл болгох</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// A bilingual field: MN + EN inputs side by side.
const BiField = ({ label, value, onChange, textarea, hint }: { label: string; value: Bi; onChange: (v: Bi) => void; textarea?: boolean; hint?: string }) => {
  const C = textarea ? Textarea : Input;
  return (
    <div className="flex flex-col gap-1">
      <Label size="small">{label}</Label>
      {hint && <Text className="text-ui-fg-subtle" size="xsmall">{hint}</Text>}
      <div className="grid grid-cols-2 gap-2">
        <C value={value.mn} onChange={(e: any) => onChange({ ...value, mn: e.target.value })} placeholder="Монгол (хоосон = өгөгдмөл)" {...(textarea ? { rows: 2 } : {})} />
        <C value={value.en} onChange={(e: any) => onChange({ ...value, en: e.target.value })} placeholder="English (empty = default)" {...(textarea ? { rows: 2 } : {})} />
      </div>
    </div>
  );
};

const ContentPage = () => {
  const { loading: permLoading, can } = usePermissions();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetch("/cms/homepage")
      .then((j) => setContent(j.content))
      .catch((e) => toast.error(e.message || "Ачаалж чадсангүй"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!content) return;
    setSaving(true);
    try {
      const r = await adminFetch("/cms/homepage", { method: "POST", body: JSON.stringify({ content }) });
      // Say when it will actually be visible rather than implying "instantly".
      toast.success(r?.revalidated?.ok
        ? "Хадгаллаа — нүүр хуудас шинэчлэгдлээ."
        : "Хадгаллаа — нүүр хуудсанд 5 минутын дотор тусна.");
    } catch (e: any) {
      toast.error(e.message || "Хадгалах амжилтгүй");
    } finally {
      setSaving(false);
    }
  };

  const setHero = (patch: Partial<Hero>) => setContent((c) => c && ({ ...c, hero: { ...c.hero, ...patch } }));
  const setImg = (i: number, patch: Partial<HeroImage>) =>
    setContent((c) => c && ({
      ...c,
      hero: { ...c.hero, images: c.hero.images.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) },
    }));
  const setPromo = (patch: Partial<Promo>) => setContent((c) => c && ({ ...c, promo: { ...c.promo, ...patch } }));

  if (!permLoading && !can("content.write")) {
    return <AccessDenied title="Контент" perm="content.write" />;
  }
  if (loading || !content) {
    return <Container className="p-6"><Text className="text-ui-fg-subtle">Ачаалж байна…</Text></Container>;
  }

  const h = content.hero;
  const changedImages = h.images.filter((i) => i.img).length;

  return (
    <Container className="divide-y p-0">
      <PageHeader
        title="Контент — Нүүр хуудас"
        description="Нүүр хуудсан дээрх текст, зургийг MN/EN-ээр өөрчилнө. Хоосон орхисон талбар өгөгдмөл хэвээр үлдэнэ."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="small" onClick={() => window.open("https://xmas.mn/mn", "_blank", "noopener")}>
              Нүүр хуудсыг харах
            </Button>
            <Button variant="primary" onClick={save} isLoading={saving}>Хадгалах</Button>
          </div>
        }
      />

      <Panel title="Гол гарчиг">
        <div className="flex flex-col gap-4">
          <BiField label="Гарчиг — 1-р мөр" value={h.titleA} onChange={(v) => setHero({ titleA: v })} />
          <BiField label="Гарчиг — 2-р мөр" value={h.titleB} onChange={(v) => setHero({ titleB: v })} />
          <BiField
            label="Танилцуулга догол"
            hint="Зургийн доор гарна. Хэрэглэгчийн сэтгэгдэл байвал түүнийг оронд харуулна."
            value={h.blurb} onChange={(v) => setHero({ blurb: v })} textarea
          />
        </div>
      </Panel>

      <Panel title="Товч ба шошго">
        <div className="flex flex-col gap-4">
          <BiField label="Эргэлдэх шошго (badge)" hint="Гарчгийн зүүн талын эргэлдэх бичиг." value={h.ring} onChange={(v) => setHero({ ring: v })} />
          <BiField label="Товчны текст" value={h.cta} onChange={(v) => setHero({ cta: v })} />
          <BiField label="Товчны текст — утсан дээр" hint="Утсан дээр багана нарийн тул богино хувилбар." value={h.ctaShort} onChange={(v) => setHero({ ctaShort: v })} />
          <div className="flex flex-col gap-1">
            <Label size="small">Товчны холбоос</Label>
            <Input value={h.ctaHref} onChange={(e) => setHero({ ctaHref: e.target.value })} placeholder="/shop (хоосон = өгөгдмөл)" />
          </div>
          <BiField label="Баруун блок — жижиг шошго" value={h.panelLabel} onChange={(v) => setHero({ panelLabel: v })} />
          <BiField label="Баруун блок — гарчиг" value={h.panelTitle} onChange={(v) => setHero({ panelTitle: v })} />
          <div className="flex flex-col gap-1">
            <Label size="small">Баруун блокийн холбоос</Label>
            <Input value={h.panelHref} onChange={(e) => setHero({ panelHref: e.target.value })} placeholder="/shop (хоосон = өгөгдмөл)" />
          </div>
        </div>
      </Panel>

      <Panel title={`Hero зурагнууд (${changedImages}/${SLOTS.length} өөрчилсөн)`}>
        <Text className="text-ui-fg-subtle mb-4 block" size="xsmall">
          Зургууд шатлан зэрэгцсэн 5 багана болж харагдана. Босоо (portrait) зураг хамгийн сайн тохирно.
        </Text>
        <div className="flex flex-col gap-6">
          {SLOTS.map((slot, i) => (
            <div key={i} className="flex flex-col gap-3 border-t border-ui-border-base pt-4 first:border-0 first:pt-0">
              <ImageField
                label={`${i + 1}. ${slot.where}`}
                hint={`${slot.shape} · өгөгдмөл: ${slot.file}`}
                value={h.images[i]?.img || ""}
                onChange={(url) => setImg(i, { img: url })}
              />
              <BiField
                label="Зургийн тайлбар (alt)"
                hint="Хараагүй хүмүүст болон хайлтын системд зориулсан тайлбар."
                value={h.images[i]?.alt || EMPTY_BI}
                onChange={(v) => setImg(i, { alt: v })}
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Урамшууллын баннер">
        <div className="mb-4 flex items-center gap-3">
          <Switch checked={content.promo.enabled} onCheckedChange={(v) => setPromo({ enabled: v })} />
          <Text className="text-ui-fg-subtle" size="xsmall">
            {content.promo.enabled ? "Идэвхтэй — нүүр хуудсан дээр гарна" : "Идэвхгүй — гарахгүй"}
          </Text>
        </div>
        <div className="flex flex-col gap-4">
          <BiField label="Kicker (жижиг гарчиг)" value={content.promo.kicker} onChange={(v) => setPromo({ kicker: v })} />
          <BiField label="Гарчиг" hint="Хоосон бол баннер гарахгүй." value={content.promo.title} onChange={(v) => setPromo({ title: v })} />
          <BiField label="Тайлбар" value={content.promo.desc} onChange={(v) => setPromo({ desc: v })} textarea />
          <BiField label="Товчны текст" value={content.promo.cta} onChange={(v) => setPromo({ cta: v })} />
          <ImageField label="Зураг" hint="Хоосон бол баннер зөвхөн текстээр гарна." value={content.promo.img} onChange={(url) => setPromo({ img: url })} />
          <div className="flex flex-col gap-1">
            <Label size="small">Холбоос</Label>
            <Input value={content.promo.href} onChange={(e) => setPromo({ href: e.target.value })} placeholder="/shop?filter=sale" />
          </div>
        </div>
      </Panel>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Контент",
  icon: DocumentText,
});

export default ContentPage;
