/**
 * Email delivery via Resend
 *
 * Gracefully no-ops if RESEND_API_KEY not set (logs to console instead) —
 * so local dev and deploys without email configured still work.
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "WorkinFlow <noreply@workinflow.cloud>";
const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || "https://workinflow.cloud";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mom.workinflow.cloud";

const resend = apiKey ? new Resend(apiKey) : null;

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions) {
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not set — email skipped. to:",
      opts.to,
      "subject:",
      opts.subject,
    );
    return { skipped: true };
  }

  const result = await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (result.error) {
    console.error("[email] send failed:", result.error);
    throw new Error(result.error.message || "Email send failed");
  }
  return { id: result.data?.id };
}

// ────────────────────────────────────────────────────
// Templates
// ────────────────────────────────────────────────────

function layout(inner: string) {
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Sarabun','Helvetica Neue',sans-serif;background:#f5f7fb;margin:0;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <div style="padding:24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;border-radius:8px;background:#3b82f6;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700">W</div>
      <strong style="font-size:16px">WorkinFlow</strong>
    </div>
    <div style="padding:24px;line-height:1.6;font-size:14px">${inner}</div>
    <div style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px">
      © ${new Date().getFullYear()} WorkinFlow Cloud • <a href="${LANDING_URL}" style="color:#64748b;text-decoration:none">workinflow.cloud</a>
    </div>
  </div>
</body></html>`;
}

export async function sendWelcomeEmail(to: string, params: {
  adminName: string;
  companyName: string;
  trialEndsAt: Date;
}) {
  const loginUrl = `${APP_URL}/th/login`;
  const trial = params.trialEndsAt.toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
  });
  const html = layout(`
    <h2 style="margin:0 0 12px">ยินดีต้อนรับสู่ WorkinFlow! 🎉</h2>
    <p>สวัสดีคุณ${params.adminName},</p>
    <p>บัญชี <strong>${params.companyName}</strong> ถูกสร้างเรียบร้อยแล้ว ทดลองใช้ฟรีถึง <strong>${trial}</strong></p>
    <p style="margin-top:24px">
      <a href="${loginUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">เข้าสู่ระบบ</a>
    </p>
    <p style="margin-top:24px;font-size:13px;color:#64748b">
      เราสร้าง preset users ไว้ให้แล้ว (manager/planner/sales/operator/qc/accounting) — รหัสผ่านเริ่มต้น: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">changeme123</code> กรุณาเปลี่ยนหลัง login
    </p>
  `);
  return sendEmail({ to, subject: `ยินดีต้อนรับสู่ WorkinFlow — ${params.companyName}`, html });
}

export async function sendPasswordResetEmail(to: string, params: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const html = layout(`
    <h2 style="margin:0 0 12px">รีเซ็ตรหัสผ่าน</h2>
    <p>สวัสดีคุณ${params.name},</p>
    <p>เราได้รับคำขอรีเซ็ตรหัสผ่านบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p>
    <p style="margin-top:24px">
      <a href="${params.resetUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">รีเซ็ตรหัสผ่าน</a>
    </p>
    <p style="margin-top:24px;font-size:13px;color:#64748b">
      ลิงก์นี้จะหมดอายุใน ${params.expiresInMinutes} นาที — ถ้าคุณไม่ได้ขอรีเซ็ต สามารถละเว้นอีเมลนี้ได้
    </p>
    <p style="font-size:12px;color:#94a3b8;margin-top:16px;word-break:break-all">
      หากปุ่มไม่ทำงาน คัดลอกลิงก์: ${params.resetUrl}
    </p>
  `);
  return sendEmail({ to, subject: "รีเซ็ตรหัสผ่าน — WorkinFlow", html });
}

export async function sendTrialEndingEmail(to: string, params: {
  name: string;
  companyName: string;
  daysLeft: number;
  upgradeUrl: string;
}) {
  const html = layout(`
    <h2 style="margin:0 0 12px">ทดลองใช้งานเหลืออีก ${params.daysLeft} วัน</h2>
    <p>สวัสดีคุณ${params.name},</p>
    <p>ช่วงทดลองใช้ของ <strong>${params.companyName}</strong> จะหมดในอีก ${params.daysLeft} วัน — อัพเกรดตอนนี้เพื่อใช้งานต่อเนื่อง</p>
    <p style="margin-top:24px">
      <a href="${params.upgradeUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">อัพเกรด Plan</a>
    </p>
  `);
  return sendEmail({ to, subject: `ทดลองใช้เหลืออีก ${params.daysLeft} วัน — WorkinFlow`, html });
}

export async function sendPaymentSuccessEmail(to: string, params: {
  name: string;
  planName: string;
  amount: number; // satang
  billingCycle: string;
  periodEnd: Date;
  invoiceUrl?: string;
}) {
  const amountBaht = `฿${(params.amount / 100).toLocaleString("th-TH")}`;
  const end = params.periodEnd.toLocaleDateString("th-TH");
  const html = layout(`
    <h2 style="margin:0 0 12px">ชำระเงินสำเร็จ ✓</h2>
    <p>สวัสดีคุณ${params.name},</p>
    <p>ขอบคุณสำหรับการชำระเงิน บัญชีของคุณได้รับการต่ออายุแล้ว</p>
    <table style="width:100%;margin-top:16px;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#64748b">Plan:</td><td style="text-align:right">${params.planName} (${params.billingCycle})</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">ยอดชำระ:</td><td style="text-align:right"><strong>${amountBaht}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">ใช้งานถึง:</td><td style="text-align:right">${end}</td></tr>
    </table>
    ${params.invoiceUrl ? `<p style="margin-top:24px"><a href="${params.invoiceUrl}" style="color:#3b82f6">ดาวน์โหลดใบกำกับภาษี</a></p>` : ""}
  `);
  return sendEmail({ to, subject: `ชำระเงินสำเร็จ — ${params.planName}`, html });
}
