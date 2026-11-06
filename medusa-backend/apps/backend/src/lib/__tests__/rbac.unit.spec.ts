import { can, canActor, isRole, ROLES } from "../rbac";

describe("rbac.isRole", () => {
  it("accepts every defined role value", () => {
    for (const r of ROLES) expect(isRole(r.value)).toBe(true);
  });
  it("rejects unknown / non-string values", () => {
    expect(isRole("bogus")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(42)).toBe(false);
  });
});

describe("rbac.can", () => {
  it("super_admin (or unset/unknown role) has every permission", () => {
    expect(can("super_admin", "catalog.write")).toBe(true);
    expect(can("super_admin", "team.manage")).toBe(true);
    // Unset/unknown → treated as super_admin so the sole admin is never locked out.
    expect(can(undefined, "catalog.write")).toBe(true);
    expect(can(null, "team.manage")).toBe(true);
    expect(can("not-a-real-role", "reports.read")).toBe(true);
  });

  it("report_viewer can read analytics/reports but nothing else", () => {
    expect(can("report_viewer", "analytics.read")).toBe(true);
    expect(can("report_viewer", "reports.read")).toBe(true);
    expect(can("report_viewer", "catalog.read")).toBe(false);
    expect(can("report_viewer", "catalog.write")).toBe(false);
    expect(can("report_viewer", "team.manage")).toBe(false);
  });

  it("order_processor handles orders + returns, not team or promotions", () => {
    expect(can("order_processor", "orders.write")).toBe(true);
    expect(can("order_processor", "returns.write")).toBe(true);
    expect(can("order_processor", "catalog.read")).toBe(true);
    expect(can("order_processor", "team.manage")).toBe(false);
    expect(can("order_processor", "promotions.write")).toBe(false);
  });

  it("catalog_manager manages catalog + inventory", () => {
    expect(can("catalog_manager", "catalog.write")).toBe(true);
    expect(can("catalog_manager", "inventory.write")).toBe(true);
    expect(can("catalog_manager", "team.manage")).toBe(false);
  });

  it("marketer manages promotions + content, not orders", () => {
    expect(can("marketer", "promotions.write")).toBe(true);
    expect(can("marketer", "content.write")).toBe(true);
    expect(can("marketer", "orders.write")).toBe(false);
  });

  it("support handles customers + returns (read/write), not catalog writes", () => {
    expect(can("support", "customers.write")).toBe(true);
    expect(can("support", "returns.write")).toBe(true);
    expect(can("support", "orders.read")).toBe(true);
    expect(can("support", "catalog.write")).toBe(false);
  });

  it("only super_admin holds team.manage among non-super roles", () => {
    for (const r of ROLES) {
      if (r.value === "super_admin") continue;
      expect(can(r.value, "team.manage")).toBe(false);
    }
  });
});

describe("rbac.canActor (M2 deny-by-default)", () => {
  const saved = process.env.SUPER_ADMIN_EMAILS;
  afterEach(() => {
    if (saved === undefined) delete process.env.SUPER_ADMIN_EMAILS;
    else process.env.SUPER_ADMIN_EMAILS = saved;
  });

  it("honours an assigned role regardless of the allowlist", () => {
    process.env.SUPER_ADMIN_EMAILS = "boss@naran.mn";
    expect(canActor({ role: "report_viewer", email: "x@naran.mn" }, "reports.read")).toBe(true);
    expect(canActor({ role: "report_viewer", email: "x@naran.mn" }, "catalog.write")).toBe(false);
  });

  it("role-less + allowlist UNSET + sole admin → allowed (owner is never locked out)", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(canActor({ role: null, email: "owner@xmas.mn", soleAdmin: true }, "team.manage")).toBe(true);
    expect(canActor({ role: undefined, email: null, soleAdmin: true }, "catalog.write")).toBe(true);
  });

  it("role-less + allowlist UNSET + other admins exist → DENIED", () => {
    // The gap this closes: with no allowlist configured, a newly invited staff
    // member used to arrive holding every permission, team.manage included.
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(canActor({ role: null, email: "newhire@xmas.mn", soleAdmin: false }, "team.manage")).toBe(false);
    expect(canActor({ role: null, email: "newhire@xmas.mn", soleAdmin: false }, "catalog.write")).toBe(false);
    expect(canActor({ role: null, email: "newhire@xmas.mn", soleAdmin: false }, "reports.read")).toBe(false);
  });

  it("role-less + allowlist UNSET + admin count unknown → allowed (never brick the admin)", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(canActor({ role: null, email: "owner@xmas.mn" }, "team.manage")).toBe(true);
  });

  it("an assigned role still wins once staff exist", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(canActor({ role: "order_processor", email: "staff@xmas.mn", soleAdmin: false }, "orders.write")).toBe(true);
    expect(canActor({ role: "order_processor", email: "staff@xmas.mn", soleAdmin: false }, "team.manage")).toBe(false);
  });

  it("role-less + allowlist SET → allowed only for listed emails (deny-by-default)", () => {
    process.env.SUPER_ADMIN_EMAILS = "boss@naran.mn, owner@naran.mn";
    expect(canActor({ role: null, email: "boss@naran.mn" }, "team.manage")).toBe(true);
    expect(canActor({ role: null, email: "OWNER@NARAN.MN" }, "team.manage")).toBe(true); // case-insensitive
    expect(canActor({ role: null, email: "intern@naran.mn" }, "reports.read")).toBe(false);
    expect(canActor({ role: null, email: null }, "reports.read")).toBe(false);
  });
});
