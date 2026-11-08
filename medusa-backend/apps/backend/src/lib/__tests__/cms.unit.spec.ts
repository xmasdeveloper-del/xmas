import { sanitize, emptyHomepage, safeUrl, promoIsLive, HERO_SLOTS } from "../cms";

describe("cms.emptyHomepage", () => {
  it("is a safe empty scaffold — every field blank, promo off", () => {
    const h = emptyHomepage();
    expect(h.hero.titleA).toEqual({ mn: "", en: "" });
    expect(h.hero.images).toHaveLength(HERO_SLOTS);
    expect(h.hero.images.every((i) => i.img === "")).toBe(true);
    expect(h.promo.enabled).toBe(false);
    expect(h.promo.href).toBe("/shop");
  });

  it("means the storefront keeps its own copy — nothing here overrides anything", () => {
    // The contract the whole feature rests on: an untouched CMS must render the
    // page exactly as it ships, so saving one headline cannot blank the rest.
    const h = emptyHomepage();
    const texts = [h.hero.titleA, h.hero.titleB, h.hero.blurb, h.hero.ring, h.hero.cta, h.hero.panelTitle];
    expect(texts.every((t) => t.mn === "" && t.en === "")).toBe(true);
    expect(h.hero.ctaHref).toBe("");
    expect(h.hero.panelHref).toBe("");
  });
});

describe("cms.sanitize", () => {
  it("returns the empty scaffold for junk / missing input", () => {
    expect(sanitize(undefined)).toEqual(emptyHomepage());
    expect(sanitize({})).toEqual(emptyHomepage());
    expect(sanitize({ hero: 5, promo: "nope" })).toEqual(emptyHomepage());
  });

  it("keeps the hero text the owner typed, in both languages", () => {
    const out = sanitize({
      hero: {
        titleA: { mn: "Жинхэнэ пүүз,", en: "Authentic sneakers," },
        panelTitle: { mn: "Өвөл бэлэн", en: "Winter ready" },
      },
    });
    expect(out.hero.titleA).toEqual({ mn: "Жинхэнэ пүүз,", en: "Authentic sneakers," });
    expect(out.hero.panelTitle).toEqual({ mn: "Өвөл бэлэн", en: "Winter ready" });
    expect(out.hero.titleB).toEqual({ mn: "", en: "" }); // untouched → still a default
  });

  it("discards the legacy slide array — those fields render nowhere", () => {
    // The first model stored hero as a carousel of slides with kicker/accent.
    // Nothing on the page could ever show them, so a stored value is dropped
    // rather than migrated into the real hero.
    const legacy = { hero: [{ kicker: { mn: "a", en: "a" }, top: { mn: "b", en: "b" }, img: "/x.png" }] };
    const out = sanitize(legacy);
    expect(Array.isArray(out.hero)).toBe(false);
    expect(out.hero.titleA).toEqual({ mn: "", en: "" });
    expect(out.hero.images).toHaveLength(HERO_SLOTS);
  });

  it("always returns exactly the wall's seven image slots", () => {
    expect(sanitize({ hero: { images: [] } }).hero.images).toHaveLength(HERO_SLOTS);
    const many = Array.from({ length: 30 }, () => ({ img: "/a.png" }));
    expect(sanitize({ hero: { images: many } }).hero.images).toHaveLength(HERO_SLOTS);
  });

  it("keeps slot order, so a photo lands in the position the owner chose", () => {
    const out = sanitize({
      hero: { images: [{ img: "/one.png" }, {}, { img: "https://cdn.example.com/three.png" }] },
    });
    expect(out.hero.images[0].img).toBe("/one.png");
    expect(out.hero.images[1].img).toBe("");
    expect(out.hero.images[2].img).toBe("https://cdn.example.com/three.png");
  });

  it("drops an unusable image URL instead of rendering a broken picture", () => {
    const out = sanitize({ hero: { images: [{ img: 123 }, { img: "javascript:alert(1)" }] } });
    expect(out.hero.images[0].img).toBe("");
    expect(out.hero.images[1].img).toBe("");
  });

  it("refuses a javascript: link on the CTA and the panel", () => {
    const out = sanitize({ hero: { ctaHref: "javascript:alert(1)", panelHref: "/shop?gender=Men" } });
    expect(out.hero.ctaHref).toBe("");
    expect(out.hero.panelHref).toBe("/shop?gender=Men");
  });

  it("caps text so one pasted essay cannot wreck the layout", () => {
    const long = "x".repeat(5000);
    expect(sanitize({ hero: { titleA: { mn: long, en: long } } }).hero.titleA.mn).toHaveLength(300);
  });

  it("coerces promo.enabled to boolean and preserves fields", () => {
    const out = sanitize({ promo: { enabled: 1, title: { mn: "Хямдрал", en: "Sale" }, href: "/shop?filter=sale" } });
    expect(out.promo.enabled).toBe(true);
    expect(out.promo.title).toEqual({ mn: "Хямдрал", en: "Sale" });
    expect(out.promo.href).toBe("/shop?filter=sale");
  });

  it("defaults promo.href to /shop when absent", () => {
    expect(sanitize({ promo: { enabled: false } }).promo.href).toBe("/shop");
  });
});

describe("cms.promoIsLive", () => {
  it("needs both the switch and something to say", () => {
    const base = emptyHomepage().promo;
    expect(promoIsLive(base)).toBe(false);
    expect(promoIsLive({ ...base, enabled: true })).toBe(false); // on, but no title
    expect(promoIsLive({ ...base, title: { mn: "Хямдрал", en: "" } })).toBe(false); // title, but off
    expect(promoIsLive({ ...base, enabled: true, title: { mn: "Хямдрал", en: "" } })).toBe(true);
    expect(promoIsLive({ ...base, enabled: true, title: { mn: "", en: "Sale" } })).toBe(true);
  });
});

describe("cms.safeUrl — only links the storefront can safely render", () => {
  it("keeps http(s) URLs", () => {
    expect(safeUrl("https://xmas.mn/shop", "/shop")).toBe("https://xmas.mn/shop");
    expect(safeUrl("http://example.com/a.png", "")).toBe("http://example.com/a.png");
  });

  it("keeps site-relative paths", () => {
    expect(safeUrl("/shop?category=UGG", "/shop")).toBe("/shop?category=UGG");
  });

  it("rejects a javascript: URL — it would have become a live href", () => {
    expect(safeUrl("javascript:alert(1)", "/shop")).toBe("/shop");
    expect(safeUrl("  JavaScript:alert(1)  ", "/shop")).toBe("/shop");
  });

  it("rejects data: and protocol-relative URLs", () => {
    expect(safeUrl("data:text/html;base64,PHN2Zz4=", "")).toBe("");
    expect(safeUrl("//evil.example.com", "/shop")).toBe("/shop");
  });

  it("falls back for junk and empty input", () => {
    expect(safeUrl(123, "")).toBe("");
    expect(safeUrl("", "/shop")).toBe("/shop");
    expect(safeUrl(null, "/shop")).toBe("/shop");
  });
});
