import { Resend } from "resend";

/**
 * Transactional email via Resend. No RESEND_API_KEY → mock (logs instead of sends),
 * so the order flow never breaks in dev/demo.
 */
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "X-MAS <onboarding@resend.dev>";
const resend = KEY ? new Resend(KEY) : null;
export const EMAIL_LIVE = !!resend;

const mnt = (n: number) => `₮${Math.round(n).toLocaleString("en-US")}`;

export type OrderEmail = {
  id: string;
  email: string;
  total: number;
  estimatedDelivery: string;
  items: { title: string; quantity: number; amount: number }[];
};

// Build the order-confirmation email HTML (exported so it can be previewed/tested).
export function renderOrderEmail(o: OrderEmail): string {
  const rows = o.items.map(i =>
    `<tr>
       <td style="padding:8px 0;color:#1C1E16;font-size:14px">${i.title} <span style="color:#9CA095">× ${i.quantity}</span></td>
       <td style="padding:8px 0;text-align:right;color:#1C1E16;font-size:14px;font-weight:600">${mnt(i.amount)}</td>
     </tr>`).join("");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#F4F2FB;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #ECE9F7">
      <div style="background:linear-gradient(120deg,#6E54EC,#A95EEA);padding:26px 28px">
        <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:2px">X-MAS</span>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 6px;font-size:22px;color:#1B1533">Захиалга баталгаажлаа 🎉</h1>
        <p style="margin:0 0 20px;color:#5C5670;font-size:14px;line-height:1.7">
          Захиалга өгсөнд баярлалаа. Бид бэлтгэж эхэллээ — 24 цагийн дотор хүргэлтийн мэдээллийг илгээнэ.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#F7F5FD;border-radius:12px">
          <tr><td style="padding:10px 14px;color:#8B85A0;font-size:13px">Захиалгын дугаар</td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;color:#1B1533">${o.id}</td></tr>
          <tr><td style="padding:10px 14px;color:#8B85A0;font-size:13px">Ойролцоо хүргэлт</td>
              <td style="padding:10px 14px;text-align:right;color:#1B1533">${o.estimatedDelivery}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-top:18px">${rows}
          <tr><td style="border-top:1px solid #ECE9F7;padding:14px 0 0;font-weight:700;color:#1B1533">Нийт</td>
              <td style="border-top:1px solid #ECE9F7;padding:14px 0 0;text-align:right;font-weight:800;color:#6E54EC;font-size:18px">${mnt(o.total)}</td></tr>
        </table>
        <p style="margin:24px 0 0;color:#8B85A0;font-size:12px">X-MAS · Оригинал пүүз, нэг дороос · Улаанбаатар, Монгол</p>
      </div>
    </div>
  </div>`;
  return html;
}

export async function sendOrderConfirmation(o: OrderEmail) {
  const html = renderOrderEmail(o);

  if (!resend) {
    console.log(`[email mock] order ${o.id} → ${o.email} (RESEND_API_KEY тохируулбал бодитоор илгээнэ)`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to: o.email, subject: `X-MAS захиалга ${o.id} баталгаажлаа`, html });
    console.log(`[email] sent order ${o.id} → ${o.email}`);
  } catch (e: any) {
    console.error("email send failed:", e.message);
  }
}
