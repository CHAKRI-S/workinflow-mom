import thaiAddressRows from "./thai-addresses.json";

export type ThaiAddressRow = {
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

export type ThaiAddressSearchParams = {
  q?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  postalCode?: string | null;
  limit?: number | string | null;
};

export type ThaiAddressField = keyof ThaiAddressRow;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Source: kongvut/thai-province-data api/latest/sub_district_with_district_and_province.json
// Normalized to prefix-less Thai names for form storage: ตำบล/แขวง, อำเภอ/เขต,
// จังหวัด prefixes are presentation concerns, not persisted values.
export const THAI_ADDRESS_ROWS = thaiAddressRows as ThaiAddressRow[];

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLocaleLowerCase("th-TH");
}

function parseLimit(value: ThaiAddressSearchParams["limit"]): number {
  const parsed = typeof value === "number" ? value : Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

function includesText(value: string, needle: string): boolean {
  return normalize(value).includes(needle);
}

function matchesExact(value: string, expected?: string | null): boolean {
  const needle = normalize(expected);
  return !needle || normalize(value) === needle;
}

export function searchThaiAddresses(params: ThaiAddressSearchParams = {}): {
  items: ThaiAddressRow[];
} {
  const q = normalize(params.q);
  const limit = parseLimit(params.limit);
  const items: ThaiAddressRow[] = [];

  for (const row of THAI_ADDRESS_ROWS) {
    if (!matchesExact(row.province, params.province)) continue;
    if (!matchesExact(row.district, params.district)) continue;
    if (!matchesExact(row.subdistrict, params.subdistrict)) continue;
    if (!matchesExact(row.postalCode, params.postalCode)) continue;

    if (
      q &&
      !(
        includesText(row.subdistrict, q) ||
        includesText(row.district, q) ||
        includesText(row.province, q) ||
        includesText(row.postalCode, q)
      )
    ) {
      continue;
    }

    items.push(row);
    if (items.length >= limit) break;
  }

  return { items };
}

export function getThaiAddressFieldOptions(
  field: ThaiAddressField,
  filters: Omit<ThaiAddressSearchParams, "q" | "limit"> = {},
): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const row of THAI_ADDRESS_ROWS) {
    if (!matchesExact(row.province, filters.province)) continue;
    if (!matchesExact(row.district, filters.district)) continue;
    if (!matchesExact(row.subdistrict, filters.subdistrict)) continue;
    if (!matchesExact(row.postalCode, filters.postalCode)) continue;

    const value = row[field];
    if (seen.has(value)) continue;
    seen.add(value);
    options.push(value);
  }

  return options;
}
