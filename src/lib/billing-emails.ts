/**
 * Billing email notifications (Phase 6A)
 *
 * All functions are fire-and-forget safe: they catch their own errors and log
 * to console.error instead of throwing — email delivery failures must NEVER
 * break the billing flow (slip confirmation, Omise webhook, etc.).
 *
 * Templates intentionally inline-HTML to match the visual style of the
 * existing password-reset email (src/lib/email.ts).
 */

import { sendEmail } from "@/lib/email";
import type { BillingCycle } from "@/generated/prisma/client";

const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || "https://workinflow.cloud";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://mom.workinflow.cloud";

// ────────────────────────────────────────────────────
// Shared layout (mirrors src/lib/email.ts layout)
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

function formatBaht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatThaiDate(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function cycleLabel(cycle: BillingCycle): string {
  return cycle === "YEARLY" ? "รายปี" : "รายเดือน";
}

// ────────────────────────────────────────────────────
// Public senders (all fire-and-forget safe)
// ────────────────────────────────────────────────────

export interface PaymentSuccessEmailParams {
  to: string;
  tenantName: string;
  planName: string;
  billingCycle: BillingCycle;
  totalSatang: number;
  subscriptionInvoiceId: string | null;
}

export async function sendPaymentSuccessEmail(
  params: PaymentSuccessEmailParams
): Promise<void> {
  try {
    const {
      to,
      tenantName,
      planName,
      billingCycle,
      totalSatang,
      subscriptionInvoiceId,
    } = params;

    const invoiceUrl = subscriptionInvoiceId
      ? `${APP_URL}/th/admin/billing/invoices/${subscriptionInvoiceId}`
      : null;

    const html = layout(`
      <h2 style="margin:0 0 12px">ชำระเงินสำเร็จ</h2>
      <p>สวัสดี <strong>${escapeHtml(tenantName)}</strong>,</p>
      <p>ขอบคุณสำหรับการชำระเงิน ระบบได้รับการชำระเรียบร้อยแล้ว และบัญชีของคุณพร้อมใช้งาน</p>
      <table style="width:100%;margin-top:16px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b">แผน:</td><td style="text-align:right">${escapeHtml(planName)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">รอบชำระ:</td><td style="text-align:right">${cycleLabel(billingCycle)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">ยอดชำระ:</td><td style="text-align:right"><strong>${formatBaht(totalSatang)}</strong></td></tr>
      </table>
      ${
        invoiceUrl
          ? `<p style="margin-top:24px">
              <a href="${invoiceUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">ดูใบกำกับภาษี</a>
            </p>`
          : ""
      }
      <p style="margin-top:24px;font-size:13px;color:#64748b">
        หากมีข้อสงสัย ตอบกลับอีเมลนี้หรือติดต่อทีมงานได้ทุกเมื่อ
      </p>
    `);

    await sendEmail({
      to,
      subject: `ชำระเงินสำเร็จ — ${planName} (${cycleLabel(billingCycle)})`,
      html,
    });
  } catch (err) {
    console.error("[billing-emails] sendPaymentSuccessEmail failed:", err);
  }
}

export interface PaymentFailedEmailParams {
  to: string;
  tenantName: string;
  planName: string;
  reason: string;
}

export async function sendPaymentFailedEmail(
  params: PaymentFailedEmailParams
): Promise<void> {
  try {
    const { to, tenantName, planName, reason } = params;
    const retryUrl = `${APP_URL}/th/admin/billing`;

    const html = layout(`
      <h2 style="margin:0 0 12px;color:#dc2626">การชำระเงินไม่สำเร็จ</h2>
      <p>สวัสดี <strong>${escapeHtml(tenantName)}</strong>,</p>
      <p>เราไม่สามารถดำเนินการชำระเงินสำหรับแผน <strong>${escapeHtml(planName)}</strong> ได้</p>
      <div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b">
        <strong>สาเหตุ:</strong> ${escapeHtml(reason)}
      </div>
      <p style="margin-top:24px">
        กรุณากดปุ่มด้านล่างเพื่อลองชำระเงินอีกครั้ง
      </p>
      <p style="margin-top:12px">
        <a href="${retryUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">ลองชำระอีกครั้ง</a>
      </p>
      <p style="margin-top:24px;font-size:13px;color:#64748b">
        หากต้องการความช่วยเหลือ ตอบกลับอีเมลนี้ได้ทันที
      </p>
    `);

    await sendEmail({
      to,
      subject: `การชำระเงินไม่สำเร็จ — กรุณาลองอีกครั้ง`,
      html,
    });
  } catch (err) {
    console.error("[billing-emails] sendPaymentFailedEmail failed:", err);
  }
}

export interface SubscriptionActivatedEmailParams {
  to: string;
  tenantName: string;
  planName: string;
  periodStart: Date;
  periodEnd: Date;
}

export async function sendSubscriptionActivatedEmail(
  params: SubscriptionActivatedEmailParams
): Promise<void> {
  try {
    const { to, tenantName, planName, periodStart, periodEnd } = params;
    const dashboardUrl = `${APP_URL}/th`;

    const html = layout(`
      <h2 style="margin:0 0 12px">ยินดีต้อนรับสู่ ${escapeHtml(planName)}</h2>
      <p>สวัสดี <strong>${escapeHtml(tenantName)}</strong>,</p>
      <p>การสมัครสมาชิก <strong>${escapeHtml(planName)}</strong> เริ่มใช้งานได้แล้ว ขอบคุณที่ไว้วางใจ WorkinFlow!</p>
      <table style="width:100%;margin-top:16px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b">เริ่มใช้งาน:</td><td style="text-align:right">${formatThaiDate(periodStart)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">ใช้งานถึง:</td><td style="text-align:right">${formatThaiDate(periodEnd)}</td></tr>
      </table>
      <div style="margin-top:20px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e3a8a;font-size:13px">
        <strong>สิ่งที่คุณได้รับในแผนนี้:</strong><br/>
        • บริหารงานผลิต ใบสั่งงาน BOM และแผนผลิต<br/>
        • ระบบเอกสารการเงิน (ใบเสนอราคา / ใบแจ้งหนี้ / ใบกำกับภาษี / ใบเสร็จ)<br/>
        • รองรับผู้ใช้งานและลูกค้าตามโควต้าของแผน
      </div>
      <p style="margin-top:24px">
        <a href="${dashboardUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">เข้าสู่ Dashboard</a>
      </p>
    `);

    await sendEmail({
      to,
      subject: `สมัครสมาชิก ${planName} สำเร็จ — ยินดีต้อนรับ`,
      html,
    });
  } catch (err) {
    console.error(
      "[billing-emails] sendSubscriptionActivatedEmail failed:",
      err
    );
  }
}

// ────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
