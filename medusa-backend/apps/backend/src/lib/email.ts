// Transactional email from the Medusa backend via Resend's REST API (no extra
// dep). No RESEND_API_KEY → mock (logs), so fulfillment never breaks in dev.
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "X-MAS <onboarding@resend.dev>";

export type ShippedEmail = {
  id: string;
  email: string;
  items: { title: string; quantity: number }[];
};

export function renderShippedEmail(o: ShippedEmail): string {
  const rows = o.items.map(i =>
    `<tr><td style="padding:7px 0;color:#161515;font-size:14px">${i.title} <span style="color:#8A8584">× ${i.quantity}</span></td></tr>`
  ).join("");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#F6F5F4;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #EAE8E6">
      <div style="background:linear-gradient(120deg,#F1592B,#C7371A);padding:26px 28px">
        <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:2px">X-MAS</span>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 6px;font-size:22px;color:#161515">Захиалга хүргэлтэд гарлаа 🚚</h1>
        <p style="margin:0 0 20px;color:#4A4746;font-size:14px;line-height:1.7">
          Таны <b>${o.id}</b> захиалга замдаа гарлаа. Удахгүй хүлээж авах болно.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#F6F5F4;border-radius:12px;padding:4px 14px">${rows}</table>
        <p style="margin:24px 0 0;color:#8A8584;font-size:12px">X-MAS · Оригинал пүүз, нэг дороос · Улаанбаатар, Монгол</p>
      </div>
    </div>
  </div>`;
}

export async function sendShippedEmail(o: ShippedEmail): Promise<void> {
  const html = renderShippedEmail(o);
  if (!KEY) {
    console.log(`[email mock] shipped ${o.id} → ${o.email} (RESEND_API_KEY тохируулбал бодитоор илгээнэ)`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: o.email, subject: `X-MAS захиалга ${o.id} хүргэлтэд гарлаа`, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    console.log(`[email] shipped ${o.id} → ${o.email}`);
  } catch (e: any) {
    console.error("shipped email failed:", e.message);
  }
}

export type PasswordResetEmail = { email: string; url: string };

export function renderPasswordResetEmail(o: PasswordResetEmail): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#FDF3EC;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #F3E2D5">
      <div style="background:linear-gradient(120deg,#FF7A2E,#E8550A);padding:26px 28px">
        <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:2px">X-MAS</span>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 6px;font-size:22px;color:#0E0F10">Нууц үг сэргээх</h1>
        <p style="margin:0 0 20px;color:#5C5F63;font-size:14px;line-height:1.7">
          Та нууц үгээ сэргээх хүсэлт илгээсэн байна. Доорх товчийг дарж шинэ нууц
          үгээ тохируулна уу. Энэ холбоос <b>15 минутын</b> дараа хүчингүй болно.
        </p>
        <a href="${o.url}" style="display:inline-block;background:linear-gradient(95deg,#FF7A2E,#E8550A);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:999px">
          Нууц үг сэргээх
        </a>
        <p style="margin:22px 0 0;color:#8A8F93;font-size:12px;line-height:1.6">
          Товч ажиллахгүй бол энэ холбоосыг хөтөч рүүгээ хуулна уу:<br/>
          <span style="color:#5C5F63;word-break:break-all">${o.url}</span>
        </p>
        <p style="margin:20px 0 0;color:#8A8F93;font-size:12px">
          Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
        </p>
        <p style="margin:22px 0 0;color:#8A8F93;font-size:12px">X-MAS · Оригинал пүүз, нэг дороос · Улаанбаатар, Монгол</p>
      </div>
    </div>
  </div>`;
}

export async function sendPasswordResetEmail(o: PasswordResetEmail): Promise<void> {
  const html = renderPasswordResetEmail(o);
  if (!KEY) {
    // Dev/demo: no email provider configured — log the reset link so it's usable.
    console.log(`[email mock] password reset → ${o.email}\n  reset link: ${o.url}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: o.email, subject: "X-MAS — нууц үг сэргээх", html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    console.log(`[email] password reset → ${o.email}`);
  } catch (e: any) {
    console.error("password reset email failed:", e.message);
  }
}

// --- New order alert for the shop ------------------------------------------
// Nothing told the owner an order had arrived: the admin's notifications page
// is pull-only and has to be remembered. For a shop promising 1-5 day delivery
// in Ulaanbaatar, knowing within the minute is the difference between same-day
// and next-day dispatch. Set OWNER_EMAIL (and RESEND_API_KEY) to switch it on;
// without them this logs and does nothing, exactly like the other senders.

export type NewOrderEmail = {
  id: string;
  total: string;
  customer: string;
  phone: string;
  address: string;
  items: { title: string; variant?: string; quantity: number }[];
  adminUrl?: string;
};

export function renderNewOrderEmail(o: NewOrderEmail): string {
  const rows = o.items.map(i =>
    `<tr><td style="padding:7px 0;color:#161515;font-size:14px">${i.title}${i.variant ? ` · <b>${i.variant}</b>` : ""} <span style="color:#8A8584">× ${i.quantity}</span></td></tr>`
  ).join("");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#F6F5F4;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #EAE8E6">
      <div style="background:linear-gradient(120deg,#F1592B,#C7371A);padding:26px 28px">
        <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:2px">X-MAS</span>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 6px;font-size:22px;color:#161515">Шинэ захиалга ${o.id} 🛒</h1>
        <p style="margin:0 0 18px;color:#4A4746;font-size:14px;line-height:1.7">
          Дүн: <b>${o.total}</b><br/>
          Харилцагч: ${o.customer}${o.phone ? ` · ${o.phone}` : ""}<br/>
          Хаяг: ${o.address || "—"}
        </p>
        <table style="width:100%;border-collapse:collapse;background:#F6F5F4;border-radius:12px;padding:4px 14px">${rows}</table>
        ${o.adminUrl ? `<p style="margin:22px 0 0"><a href="${o.adminUrl}" style="display:inline-block;background:#F1592B;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:999px">Админ дээр нээх</a></p>` : ""}
      </div>
    </div>
  </div>`;
}

export async function sendNewOrderEmail(o: NewOrderEmail): Promise<void> {
  const to = process.env.OWNER_EMAIL;
  if (!to) {
    console.log(`[email mock] new order ${o.id} (OWNER_EMAIL тохируулбал эзэнд мэдэгдэнэ)`);
    return;
  }
  if (!KEY) {
    console.log(`[email mock] new order ${o.id} → ${to} (RESEND_API_KEY тохируулбал бодитоор илгээнэ)`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: to.split(",").map(s => s.trim()).filter(Boolean),
        subject: `🛒 Шинэ захиалга ${o.id} · ${o.total}`,
        html: renderNewOrderEmail(o),
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    console.log(`[email] new order ${o.id} → ${to}`);
  } catch (e: any) {
    console.error("new-order email failed:", e.message);
  }
}
