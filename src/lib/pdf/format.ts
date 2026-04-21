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
 * Convert a number to Thai baht text per สรรพากร rules.
 * e.g. 1250.50 → "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์"
 *      21     → "ยี่สิบเอ็ดบาทถ้วน"  (เอ็ด rule)
 */
const THAI_NUMBERS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_UNITS_IN_BLOCK = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/**
 * Read a number 1..999,999 (one "ล้าน" block).
 * @param n value in range [1, 999999]
 * @param isLowBlock true when this is the low (units) block of a bigger number;
 *   makes a standalone "1" read as "เอ็ด" (e.g., 1,000,001 → "หนึ่งล้านเอ็ด")
 */
function readThaiBlock(n: number, isLowBlock: boolean): string {
  if (n === 0) return "";
  const digits = String(n).split("").map(Number);
  const len = digits.length;
  let result = "";
  for (let i = 0; i < len; i++) {
    const digit = digits[i];
    const place = len - i - 1; // 0=units, 1=tens, ..., 5=hundred-thousand
    if (digit === 0) continue;

    // Units place (ones)
    if (place === 0) {
      if (digit === 1 && (i > 0 || isLowBlock)) {
        // เอ็ด: digit=1 in units with another non-zero digit in the block,
        // OR this block is the remainder of a bigger number (e.g. 1,000,001)
        result += "เอ็ด";
      } else {
        result += THAI_NUMBERS[digit];
      }
      continue;
    }

    // Tens place
    if (place === 1) {
      if (digit === 1) {
        // สิบ alone (no "หนึ่ง" prefix)
      } else if (digit === 2) {
        result += "ยี่";
      } else {
        result += THAI_NUMBERS[digit];
      }
      result += "สิบ";
      continue;
    }

    // Other places (hundreds, thousands, ten-thousands, hundred-thousands)
    result += THAI_NUMBERS[digit] + THAI_UNITS_IN_BLOCK[place];
  }
  return result;
}

function readThaiNumber(n: number): string {
  if (n === 0) return "ศูนย์";
  if (n < 1_000_000) return readThaiBlock(n, false);
  // Split by 10^6. Recurses to handle ล้านล้าน (>= 10^12).
  const low = n % 1_000_000;
  const high = Math.floor(n / 1_000_000);
  const highStr = readThaiNumber(high) + "ล้าน";
  const lowStr = low > 0 ? readThaiBlock(low, true) : "";
  return highStr + lowStr;
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
