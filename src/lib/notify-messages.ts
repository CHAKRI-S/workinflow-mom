/**
 * Pure message builders for platform notifications.
 *
 * Zero imports on purpose — kept free of prisma/telegram so it can be unit
 * tested in the pure-function Vitest suite. The side-effecting senders live in
 * src/lib/notify.ts and format their text through these functions.
 */

/** Escape the 3 characters Telegram's HTML parse_mode is sensitive to. */
export function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Format satang → "1,234.00" baht string. */
export function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const GATEWAY_LABEL: Record<string, string> = {
  OMISE: "บัตรเครดิต (Omise)",
  SLIPOK: "PromptPay + สลิป",
  MANUAL: "โอนผ่านบัญชี (ยืนยันโดยผู้ดูแล)",
};

export function buildSignupMessage(p: {
  tenantName: string;
  email: string;
  planName: string;
}): string {
  return [
    "🆕 <b>ลูกค้าใหม่สมัครใช้งาน</b>",
    `บริษัท: ${escapeHtml(p.tenantName)}`,
    `อีเมล: ${escapeHtml(p.email)}`,
    `แพ็กเกจ: ${escapeHtml(p.planName)}`,
  ].join("\n");
}

export function buildManualTransferMessage(p: {
  tenantName: string;
  planName: string;
  billingCycle: string;
  totalSatang: number;
}): string {
  return [
    "💸 <b>มีการโอนเงินรอยืนยัน</b>",
    `บริษัท: ${escapeHtml(p.tenantName)}`,
    `แพ็กเกจ: ${escapeHtml(p.planName)} (${p.billingCycle === "YEARLY" ? "รายปี" : "รายเดือน"})`,
    `ยอด: ฿${formatBaht(p.totalSatang)}`,
    "👉 ตรวจสอบสลิปแล้วกดยืนยันในหน้า Superadmin",
  ].join("\n");
}

export function buildActivatedMessage(p: {
  tenantName: string;
  planName: string;
  totalSatang: number;
  gateway: string | null;
}): string {
  const method = p.gateway ? GATEWAY_LABEL[p.gateway] ?? p.gateway : "-";
  return [
    "✅ <b>ชำระเงินสำเร็จ / เปิดใช้งานแล้ว</b>",
    `บริษัท: ${escapeHtml(p.tenantName)}`,
    `แพ็กเกจ: ${escapeHtml(p.planName)}`,
    `ยอด: ฿${formatBaht(p.totalSatang)}`,
    `ช่องทาง: ${escapeHtml(method)}`,
  ].join("\n");
}

export function buildPaymentFailedMessage(p: {
  tenantName: string;
  planName: string;
  reason: string;
}): string {
  return [
    "❌ <b>ชำระเงินไม่สำเร็จ</b>",
    `บริษัท: ${escapeHtml(p.tenantName)}`,
    `แพ็กเกจ: ${escapeHtml(p.planName)}`,
    `เหตุผล: ${escapeHtml(p.reason)}`,
  ].join("\n");
}

/**
 * Trial cron summary. Returns null when nothing happened (so we don't spam an
 * empty message every run).
 */
export function buildTrialCronMessage(p: {
  suspended: string[];
  reminders: { name: string; daysLeft: number }[];
}): string | null {
  if (p.suspended.length === 0 && p.reminders.length === 0) return null;
  const lines = ["⏰ <b>สรุปรอบตรวจ Trial</b>"];
  if (p.reminders.length > 0) {
    lines.push(`\n🔔 ใกล้หมดอายุ (${p.reminders.length}):`);
    for (const r of p.reminders.slice(0, 20)) {
      lines.push(`• ${escapeHtml(r.name)} — เหลือ ${r.daysLeft} วัน`);
    }
    if (p.reminders.length > 20) lines.push(`…และอีก ${p.reminders.length - 20}`);
  }
  if (p.suspended.length > 0) {
    lines.push(`\n🚫 หมดอายุ/ระงับ (${p.suspended.length}):`);
    for (const name of p.suspended.slice(0, 20)) {
      lines.push(`• ${escapeHtml(name)}`);
    }
    if (p.suspended.length > 20) lines.push(`…และอีก ${p.suspended.length - 20}`);
  }
  return lines.join("\n");
}

/** Renewal cron summary. Returns null when nothing happened. */
export function buildRenewalCronMessage(p: {
  renewed: string[];
  failed: string[];
  expired: string[];
}): string | null {
  if (p.renewed.length === 0 && p.failed.length === 0 && p.expired.length === 0)
    return null;
  const lines = ["🔄 <b>สรุปรอบต่ออายุอัตโนมัติ</b>"];
  if (p.renewed.length > 0)
    lines.push(`✅ ต่ออายุสำเร็จ: ${p.renewed.length} (${p.renewed.slice(0, 10).map(escapeHtml).join(", ")})`);
  if (p.failed.length > 0)
    lines.push(`❌ ต่ออายุล้มเหลว: ${p.failed.length} (${p.failed.slice(0, 10).map(escapeHtml).join(", ")})`);
  if (p.expired.length > 0)
    lines.push(`🚫 หมดอายุ/ระงับ: ${p.expired.length} (${p.expired.slice(0, 10).map(escapeHtml).join(", ")})`);
  return lines.join("\n");
}
