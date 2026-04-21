/**
 * Shared formatters for PDF documents.
 * Pure functions — no side effects, safe for server + client.
 */

export function formatCurrency(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateTh(
  d: Date | string | null | undefined,
  opts?: { buddhist?: boolean }
): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = opts?.buddhist
    ? date.getFullYear() + 543
    : date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convert a number to Thai baht text.
 * e.g. 1250.50 → "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์"
 */
const THAI_NUMBERS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_UNITS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function readThaiNumber(n: number): string {
  if (n === 0) return "ศูนย์";
  let result = "";
  const str = String(Math.floor(n));
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(str[i]);
    const place = len - i - 1;
    if (digit === 0) continue;
    const unitIdx = place % 6;
    // special cases
    if (unitIdx === 0 && digit === 1 && place !== 0 && len > 1) {
      // หนึ่ง → เอ็ด (units place, not start)
      result += "เอ็ด";
    } else if (unitIdx === 1 && digit === 2) {
      result += "ยี่";
    } else if (unitIdx === 1 && digit === 1) {
      // ไม่ต้องอ่าน "หนึ่ง" หน้า "สิบ"
      // result += "";
    } else {
      result += THAI_NUMBERS[digit];
    }
    result += THAI_UNITS[unitIdx];
    // ล้าน for >= 1,000,000
    if (place === 6 && digit !== 0) {
      // already added "ล้าน" via unitIdx=0 loop? — we need different logic
    }
  }
  // handle ล้าน (millions) — simpler: split by 6 digits
  if (n >= 1_000_000) {
    const millions = Math.floor(n / 1_000_000);
    const remainder = Math.floor(n) % 1_000_000;
    let out = readThaiNumber(millions) + "ล้าน";
    if (remainder > 0) out += readThaiNumber(remainder);
    return out;
  }
  return result;
}

export function bahtText(amount: number | string): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "";
  const rounded = Math.round(num * 100) / 100;
  const bahtPart = Math.floor(rounded);
  const satangPart = Math.round((rounded - bahtPart) * 100);

  if (bahtPart === 0 && satangPart === 0) return "ศูนย์บาทถ้วน";

  const bahtStr = bahtPart > 0 ? readThaiNumber(bahtPart) + "บาท" : "";
  const satangStr =
    satangPart > 0
      ? readThaiNumber(satangPart) + "สตางค์"
      : bahtPart > 0
        ? "ถ้วน"
        : "";
  return bahtStr + satangStr;
}

export function formatTaxId(raw: string | null | undefined): string {
  if (!raw) return "-";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 13) return raw;
  // X-XXXX-XXXXX-XX-X
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
}
