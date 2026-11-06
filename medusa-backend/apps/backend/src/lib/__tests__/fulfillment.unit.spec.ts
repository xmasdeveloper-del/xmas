import { remainingQuantities, fulfillmentItems } from "../fulfillment";

const items = [
  { id: "li_42", quantity: 1 }, // size 42
  { id: "li_41", quantity: 1 }, // size 41
];

describe("remainingQuantities — what is still unpacked", () => {
  it("returns everything when nothing has been fulfilled", () => {
    expect(remainingQuantities(items, [])).toEqual(items);
  });

  it("is the bug being fixed: a partly packed order still has work left", () => {
    // Staff fulfilled size 42 only. The old code saw "a fulfillment exists" and
    // treated the whole order as done, shipping size 41 without ever picking it.
    const fulfillments = [{ id: "ful_1", items: [{ line_item_id: "li_42", quantity: 1 }] }];
    expect(remainingQuantities(items, fulfillments)).toEqual([{ id: "li_41", quantity: 1 }]);
  });

  it("reports nothing left once every unit is covered", () => {
    const fulfillments = [
      { id: "ful_1", items: [{ line_item_id: "li_42", quantity: 1 }] },
      { id: "ful_2", items: [{ line_item_id: "li_41", quantity: 1 }] },
    ];
    expect(remainingQuantities(items, fulfillments)).toEqual([]);
  });

  it("handles a partially packed quantity on one line", () => {
    const three = [{ id: "li_a", quantity: 3 }];
    const fulfillments = [{ id: "ful_1", items: [{ line_item_id: "li_a", quantity: 1 }] }];
    expect(remainingQuantities(three, fulfillments)).toEqual([{ id: "li_a", quantity: 2 }]);
  });

  it("sums several fulfillments against the same line", () => {
    const three = [{ id: "li_a", quantity: 3 }];
    const fulfillments = [
      { id: "f1", items: [{ line_item_id: "li_a", quantity: 1 }] },
      { id: "f2", items: [{ line_item_id: "li_a", quantity: 2 }] },
    ];
    expect(remainingQuantities(three, fulfillments)).toEqual([]);
  });

  it("ignores cancelled fulfillments, so their goods become packable again", () => {
    const fulfillments = [
      { id: "ful_1", canceled_at: "2026-01-01", items: [{ line_item_id: "li_42", quantity: 1 }] },
    ];
    expect(remainingQuantities(items, fulfillments)).toEqual(items);
  });

  it("never reports a negative remainder when over-fulfilled", () => {
    const one = [{ id: "li_a", quantity: 1 }];
    const fulfillments = [{ id: "f1", items: [{ line_item_id: "li_a", quantity: 5 }] }];
    expect(remainingQuantities(one, fulfillments)).toEqual([]);
  });

  it("copes with missing or malformed fulfillment rows", () => {
    expect(remainingQuantities(items, [null, {}, { items: null }] as any)).toEqual(items);
    expect(remainingQuantities(items, [{ items: [{ quantity: 2 }] }])).toEqual(items); // no line_item_id
  });
});

describe("fulfillmentItems — a shipment must carry only its own goods", () => {
  it("maps a fulfillment's rows to shipment items", () => {
    const ful = { id: "f1", items: [{ line_item_id: "li_42", quantity: 2 }] };
    expect(fulfillmentItems(ful)).toEqual([{ id: "li_42", quantity: 2 }]);
  });

  it("drops rows with no line item", () => {
    const ful = { id: "f1", items: [{ line_item_id: null, quantity: 1 }, { line_item_id: "li_a", quantity: 1 }] };
    expect(fulfillmentItems(ful)).toEqual([{ id: "li_a", quantity: 1 }]);
  });

  it("is empty for a fulfillment with no items", () => {
    expect(fulfillmentItems({})).toEqual([]);
    expect(fulfillmentItems(null)).toEqual([]);
  });

  it("keeps two fulfillments of one order separate", () => {
    const f1 = { items: [{ line_item_id: "li_42", quantity: 1 }] };
    const f2 = { items: [{ line_item_id: "li_41", quantity: 1 }] };
    // Previously BOTH shipments were sent the order's full item list, which
    // marked the unpicked size as shipped.
    expect(fulfillmentItems(f1)).toEqual([{ id: "li_42", quantity: 1 }]);
    expect(fulfillmentItems(f2)).toEqual([{ id: "li_41", quantity: 1 }]);
  });
});
