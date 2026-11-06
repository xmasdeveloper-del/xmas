import { parseCsv, validateStockRows } from "../catalog";

describe("catalog.parseCsv", () => {
  it("parses a header + rows into objects", () => {
    const rows = parseCsv("handle,stock\nglow-serum,50\nrose-elixir,12");
    expect(rows).toEqual([
      { handle: "glow-serum", stock: "50" },
      { handle: "rose-elixir", stock: "12" },
    ]);
  });

  it("trims header and cell whitespace", () => {
    const rows = parseCsv(" handle , stock \n  a  , 5 ");
    expect(rows[0]).toEqual({ handle: "a", stock: "5" });
  });

  it("respects quoted fields containing commas", () => {
    const rows = parseCsv('handle,title\np1,"Serum, Glow"');
    expect(rows[0].title).toBe("Serum, Glow");
  });

  it("unescapes doubled quotes inside quoted fields", () => {
    const rows = parseCsv('handle,title\np1,"a ""b"" c"');
    expect(rows[0].title).toBe('a "b" c');
  });

  it("handles CRLF line endings and a trailing newline", () => {
    const rows = parseCsv("handle,stock\r\na,1\r\n");
    expect(rows).toEqual([{ handle: "a", stock: "1" }]);
  });

  it("fills missing trailing columns with empty strings", () => {
    const rows = parseCsv("handle,title,price\np1");
    expect(rows[0]).toEqual({ handle: "p1", title: "", price: "" });
  });

  it("returns [] for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });
});

describe("catalog.validateStockRows — a typo must not zero the shelf", () => {
  const rows = (...stocks: string[]) => stocks.map((stock) => ({ sku: "x", stock }));

  it("accepts plain whole numbers", () => {
    expect(validateStockRows(rows("0", "5", "250", " 12 "))).toEqual([]);
  });

  it("rejects the values that used to silently become 0", () => {
    // Number("12,000") / Number("25 ш") / Number("хорь") are all NaN, and the
    // old `|| 0` wrote zero stock for each one.
    const bad = validateStockRows(rows("12,000", "25 ш", "хорь", "n/a"));
    expect(bad.map((b) => b.value)).toEqual(["12,000", "25 ш", "хорь", "n/a"]);
  });

  it("rejects an empty cell instead of treating it as zero", () => {
    expect(validateStockRows(rows("", "   "))).toHaveLength(2);
  });

  it("rejects negative stock", () => {
    expect(validateStockRows(rows("-3"))).toHaveLength(1);
  });

  it("reports the spreadsheet line number, counting the header as row 1", () => {
    const bad = validateStockRows(rows("10", "oops", "20"));
    expect(bad).toEqual([{ line: 3, value: "oops" }]);
  });

  it("passes a clean file untouched", () => {
    expect(validateStockRows([])).toEqual([]);
  });
});
