export const DEFAULT_CURRENCY_CODE = "THB";

export const CURRENCY_OPTIONS = [
  { code: "THB", label: "บาท", symbol: "฿", locale: "th-TH" },
  { code: "USD", label: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", locale: "ja-JP" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥", locale: "zh-CN" },
  { code: "EUR", label: "Euro", symbol: "€", locale: "de-DE" },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]["code"];

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    CURRENCY_OPTIONS.some((option) => option.code === value.toUpperCase())
  );
}

export function normalizeCurrencyCode(value: unknown): CurrencyCode {
  if (typeof value !== "string") return DEFAULT_CURRENCY_CODE;

  const normalized = value.trim().toUpperCase();
  return isSupportedCurrency(normalized) ? normalized : DEFAULT_CURRENCY_CODE;
}

export function getCurrencyOption(value: unknown): (typeof CURRENCY_OPTIONS)[number] {
  const code = normalizeCurrencyCode(value);
  return (
    CURRENCY_OPTIONS.find((option) => option.code === code) ?? CURRENCY_OPTIONS[0]
  );
}

export function getCurrencyLabel(value: unknown): string {
  return getCurrencyOption(value).label;
}

export function getCurrencySymbol(value: unknown): string {
  return getCurrencyOption(value).symbol;
}

export function formatMoney(amount: number, currencyCode: unknown): string {
  const option = getCurrencyOption(currencyCode);
  const formatted = new Intl.NumberFormat(option.locale, {
    style: "currency",
    currency: option.code,
    minimumFractionDigits: option.code === "JPY" ? 0 : 2,
    maximumFractionDigits: option.code === "JPY" ? 0 : 2,
  }).format(Number(amount) || 0);

  return option.code === "JPY" || option.code === "CNY"
    ? formatted.replace("￥", option.symbol)
    : formatted;
}
