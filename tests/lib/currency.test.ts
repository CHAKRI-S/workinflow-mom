import { describe, expect, it } from "vitest";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY_CODE,
  formatMoney,
  getCurrencyLabel,
  isSupportedCurrency,
  normalizeCurrencyCode,
} from "@/lib/currency";

describe("currency helpers", () => {
  it("allows only the MVP currency list and defaults to THB", () => {
    expect(CURRENCY_OPTIONS.map((option) => option.code)).toEqual([
      "THB",
      "USD",
      "JPY",
      "CNY",
      "EUR",
    ]);
    expect(DEFAULT_CURRENCY_CODE).toBe("THB");
  });

  it("normalizes supported lowercase currency codes", () => {
    expect(normalizeCurrencyCode("usd")).toBe("USD");
    expect(normalizeCurrencyCode(" jpy ")).toBe("JPY");
  });

  it("defaults invalid or empty currency codes to THB without FX conversion", () => {
    expect(normalizeCurrencyCode("gbp")).toBe("THB");
    expect(normalizeCurrencyCode("")).toBe("THB");
    expect(normalizeCurrencyCode(null)).toBe("THB");
  });

  it("guards supported currency codes", () => {
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("GBP")).toBe(false);
  });

  it("formats money using the selected currency display only", () => {
    expect(formatMoney(1234.5, "THB")).toContain("฿");
    expect(formatMoney(1234.5, "USD")).toContain("$");
    expect(formatMoney(1234.5, "JPY")).toContain("¥");
  });

  it("returns safe labels for known and unknown codes", () => {
    expect(getCurrencyLabel("THB")).toBe("บาท");
    expect(getCurrencyLabel("usd")).toBe("US Dollar");
    expect(getCurrencyLabel("gbp")).toBe("บาท");
  });
});
