// Pure receipt markup — no DOM, no QR library, no @medusajs/ui import.
//
// Kept apart from receipt.ts so the ҮТЕГ layout requirements are testable:
// a tax receipt that loses its seller TIN, or prints a lottery number on a
// B2B slip, fails an inspection — and that is not something to discover by
// squinting at thermal paper.
//
// Without an `ebarimt` block this is a plain store receipt. With one it is
// the official tax receipt.

/* The shop's own details as they appear on a printed till receipt.
 * One place to edit: change these two lines and every receipt follows.
 * Put the shop's phone in `contact` once there is one to print. */
const STORE = {
  name: "X-MAS",
  contact: "xmas.mn",
};

export const tug = (n: number) => `₮${new Intl.NumberFormat("en-US").format(Math.round(n || 0))}`;
export const PAY_LABEL: Record<string, string> = { cash: "Бэлэн мөнгө", card: "Карт", qpay: "QPay", transfer: "Банк шилжүүлэг" };

/**
 * The e-Barimt half of a receipt.
 *
 * ⚠️ `lottery` and `qrData` are PRINT ONLY. ҮТЕГ forbids keeping either in any
 * other form, so they reach this function straight from the PosAPI response
 * and must never be written to a database, a log or an email. Everything else
 * here is also on the stored record, so a reprint can show the ДДТД — but not
 * the QR, which is exactly the intended behaviour.
 */
export type EbarimtPrint = {
  /** 33-digit ДДТД. */
  ddtd: string;
  /** Date PosAPI stamped the receipt, "yyyy-MM-dd HH:mm:ss". */
  date: string;
  merchantTin: string;
  totalVAT: number;
  totalCityTax?: number;
  /** PRINT ONLY. Absent on a B2B receipt, which gets no lottery. */
  lottery?: string;
  /** PRINT ONLY. */
  qrData?: string;
  /** Buying business — when set, the receipt is B2B and prints no lottery. */
  customerTin?: string;
  customerName?: string;
};

export type Receipt = {
  items: { title: string; quantity: number; unit_price: number; amount: number }[];
  subtotal?: number; discount?: number;
  total: number; paymentMethod: string; customerName: string | null; at: string;
  no: string; paid?: boolean; cash?: number; change?: number;
  /** Present once a tax receipt has been filed for this sale. */
  ebarimt?: EbarimtPrint;
};

const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/**
 * Build the markup for a sale receipt on a 72mm thermal roll.
 *
 * Long perfume names wrap badly in a four-column table, so each line gets its
 * own block: the product on one row, then "qty × unit price" with the line total
 * right-aligned underneath. Numbers are tabular so the column stays straight.
 * `logoUrl` is optional — the receipt falls back to the shop name in type.
 *
 * Split out from printing so the ҮТЕГ layout requirements can be asserted in
 * a test — seller TIN, ДДТД, VAT broken out, the lottery number after the
 * word "Сугалаа" — rather than only being checkable by printing one and
 * looking at it. Takes the QR as an already-rendered data URL so it stays
 * free of both the DOM and the QR library.
 */
export function receiptHtml(r: Receipt, qrDataUrl?: string, logoUrl?: string): string {
  const e = r.ebarimt;

  const qrImg = !e?.qrData
    ? ""
    : qrDataUrl
      ? `<img class="qr" src="${qrDataUrl}" alt="e-Barimt QR"/>`
      // A receipt with no QR is still a receipt the cashier can hand over,
      // and the ДДТД makes it traceable. Better than refusing to print.
      : `<div class="qrfail">QR үүсгэж чадсангүй — ДДТД-гаар лавлана уу.</div>`;

  const ebarimtBlock = e ? `
  <div class="rule solid"></div>
  <div class="eb">
    <div class="ebtitle">ТАТВАРЫН БАРИМТ</div>
    <div class="row"><span>Борлуулагчийн ТТД</span><span>${esc(e.merchantTin)}</span></div>
    ${e.customerTin ? `<div class="row"><span>Худалдан авагчийн ТТД</span><span>${esc(e.customerTin)}</span></div>` : ""}
    ${e.customerName ? `<div class="row"><span>Худалдан авагч</span><span>${esc(e.customerName)}</span></div>` : ""}
    <div class="row"><span>Баримт хэвлэсэн</span><span>${esc(e.date)}</span></div>
    <div class="ddtdlabel">ДДТД</div>
    <div class="ddtd">${esc(e.ddtd)}</div>
    <div class="rule"></div>
    <div class="row"><span>НӨАТ</span><span>${tug(e.totalVAT)}</span></div>
    ${e.totalCityTax ? `<div class="row"><span>НХАТ</span><span>${tug(e.totalCityTax)}</span></div>` : ""}
    <div class="row"><span>НӨАТ тооцсон нийт дүн</span><span>${tug(r.total)}</span></div>
    ${e.lottery
      ? `<div class="lottery">Сугалаа ${esc(e.lottery)}</div>`
      : e.customerTin
        // B2B receipts get no lottery by design; say so rather than leave a
        // gap the cashier reads as a printing fault.
        ? `<div class="nolottery">ААН-ийн баримтад сугалаа олгогдохгүй</div>`
        : `<div class="nolottery">Сугалаагүй баримт</div>`}
    ${qrImg ? `<div class="qrwrap">${qrImg}</div>` : ""}
  </div>` : "";

  const rows = r.items.map(it => `
    <div class="item">
      <div class="name">${esc(it.title)}</div>
      <div class="line"><span class="qty">${it.quantity} × ${tug(it.unit_price)}</span><span class="amt">${tug(it.amount)}</span></div>
    </div>`).join("");

  const discRows = r.discount && r.discount > 0
    ? `<div class="row"><span>Дүн</span><span>${tug(r.subtotal ?? r.total + r.discount)}</span></div>
       <div class="row"><span>Хямдрал</span><span>−${tug(r.discount)}</span></div>`
    : "";

  const cashRows = r.paymentMethod === "cash" && r.cash != null
    ? `<div class="row"><span>Авсан</span><span>${tug(r.cash)}</span></div>
       <div class="row"><span>Хариулт</span><span>${tug(r.change ?? 0)}</span></div>`
    : "";

  const head = logoUrl
    ? `<img class="logo" src="${esc(logoUrl)}" alt="${esc(STORE.name)}"/>`
    : `<div class="brand">${esc(STORE.name)}</div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.no)}</title>
<style>
  *{box-sizing:border-box}
  body{width:72mm;margin:0 auto;padding:10px 8px;color:#000;
       font-family:-apple-system,"Segoe UI",Arial,sans-serif;font-size:12px;line-height:1.45}
  .head{text-align:center;margin-bottom:8px}
  .logo{max-width:46mm;height:auto;margin:0 auto 4px;display:block}
  .brand{font-size:15px;font-weight:700;letter-spacing:.5px}
  .contact{font-size:10px;color:#333;margin-top:2px}
  .rule{border-top:1px dashed #000;margin:8px 0}
  .rule.solid{border-top:2px solid #000}
  .row{display:flex;justify-content:space-between;gap:8px;margin:2px 0}
  .row span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap}
  .muted{color:#333}
  .item{margin:6px 0}
  .item .name{font-weight:600;word-break:break-word}
  .item .line{display:flex;justify-content:space-between;gap:8px;color:#333;margin-top:1px}
  .item .qty,.item .amt{font-variant-numeric:tabular-nums;white-space:nowrap}
  .item .amt{font-weight:600;color:#000}
  .total{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:6px 0}
  .total .lbl{font-size:13px;font-weight:700;letter-spacing:.5px}
  .total .val{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}
  .foot{text-align:center;font-size:10px;color:#333;margin-top:10px;line-height:1.6}
  .eb{margin-top:6px}
  .ebtitle{text-align:center;font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:6px}
  .ddtdlabel{font-size:10px;color:#333;margin-top:6px}
  /* 33 digits will not fit one 72mm line, so it wraps on purpose — and in
     mono, because this is the number a person reads back over the phone. */
  .ddtd{font-family:"Courier New",monospace;font-size:12px;font-weight:700;
        letter-spacing:.5px;word-break:break-all;line-height:1.3}
  .lottery{text-align:center;font-size:15px;font-weight:700;letter-spacing:1px;margin:8px 0 4px}
  .nolottery{text-align:center;font-size:10px;color:#333;margin:8px 0 4px}
  .qrwrap{text-align:center;margin-top:6px}
  /* ~32mm square: big enough for a phone camera on thermal paper, which
     prints QR edges softer than it looks on screen. */
  .qr{width:32mm;height:32mm;display:block;margin:0 auto;image-rendering:pixelated}
  .qrfail{text-align:center;font-size:10px;color:#333;margin-top:6px}
  @media print{@page{margin:0}}
</style></head><body>
  <div class="head">
    ${head}
    <div class="contact">${esc(STORE.contact)}</div>
  </div>

  <div class="rule"></div>
  <div class="row muted"><span>Баримт №</span><span>${esc(r.no)}</span></div>
  <div class="row muted"><span>Огноо</span><span>${new Date(r.at).toLocaleString("mn-MN")}</span></div>
  ${r.customerName ? `<div class="row muted"><span>Харилцагч</span><span>${esc(r.customerName)}</span></div>` : ""}

  <div class="rule"></div>
  ${rows}

  <div class="rule"></div>
  ${discRows}
  <div class="rule solid"></div>
  <div class="total"><span class="lbl">НИЙТ</span><span class="val">${tug(r.total)}</span></div>
  <div class="rule solid"></div>

  <div class="row"><span>Төлбөр</span><span>${PAY_LABEL[r.paymentMethod] || r.paymentMethod}</span></div>
  ${cashRows}
  ${ebarimtBlock}

  <div class="foot">Худалдан авсанд баярлалаа!<br/>Дахин уулзацгаая ♡</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close()},400)}</script>
</body></html>`;

  return html;
}
