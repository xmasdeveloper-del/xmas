import { toast } from "@medusajs/ui";
import QRCode from "qrcode";
import { receiptHtml, type Receipt } from "./receipt-html";

// Printing side of the receipt; the markup itself lives in receipt-html.ts.
// Re-exported here so the existing POS and day-report imports keep working.
export { tug, PAY_LABEL, receiptHtml } from "./receipt-html";
export type { Receipt, EbarimtPrint } from "./receipt-html";

/** Render the receipt and send it to the printer. */
export async function printReceipt(r: Receipt, logoUrl?: string) {
  // Rendered here, in the browser, straight from the PosAPI response. Sending
  // the payload to an image service would be both a leak and a form of
  // storage, which is the one thing ҮТЕГ forbids outright.
  let qrDataUrl: string | undefined;
  if (r.ebarimt?.qrData) {
    try {
      qrDataUrl = await QRCode.toDataURL(r.ebarimt.qrData, {
        margin: 0, width: 240, errorCorrectionLevel: "M",
      });
    } catch {
      qrDataUrl = undefined;
    }
  }

  const w = window.open("", "_blank", "width=380,height=680");
  if (!w) { toast.error("Хэвлэх цонх нээгдсэнгүй (popup-ыг зөвшөөрнө үү)."); return; }
  w.document.write(receiptHtml(r, qrDataUrl, logoUrl)); w.document.close();
}
