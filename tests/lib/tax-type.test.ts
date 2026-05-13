import { describe, expect, it } from "vitest";
import {
  TAX_TYPE_OPTIONS,
  deriveTaxTypeFromLegacyVat,
  getTaxTypeLabelTh,
  isDocumentTaxType,
  resolveTaxCalculation,
} from "@/lib/tax-type";

describe("document tax type helpers", () => {
  it.each([
    ["VAT_INCLUSIVE", 7, "FORCE_INCLUSIVE", "รวม VAT"],
    ["VAT_EXCLUSIVE", 7, "FORCE_EXCLUSIVE", "แยก VAT"],
    ["NO_VAT", 0, "FORCE_EXCLUSIVE", "ไม่มี VAT"],
  ] as const)(
    "%s maps to VAT calculation and Thai label",
    (taxType, vatRate, vatModePolicy, labelTh) => {
      expect(resolveTaxCalculation(taxType)).toEqual({
        vatRate,
        vatModePolicy,
      });
      expect(getTaxTypeLabelTh(taxType)).toBe(labelTh);
    },
  );

  it("keeps the option labels exactly as the quotation UI copy", () => {
    expect(TAX_TYPE_OPTIONS.map((option) => option.labelTh)).toEqual([
      "รวม VAT",
      "แยก VAT",
      "ไม่มี VAT",
    ]);
  });

  it("derives legacy records with zero VAT as NO_VAT", () => {
    expect(
      deriveTaxTypeFromLegacyVat({ vatRate: 0, vatModePolicy: "FORCE_EXCLUSIVE" }),
    ).toBe("NO_VAT");
  });

  it("derives legacy inclusive records as VAT_INCLUSIVE", () => {
    expect(
      deriveTaxTypeFromLegacyVat({ vatRate: 7, vatModePolicy: "FORCE_INCLUSIVE" }),
    ).toBe("VAT_INCLUSIVE");
  });

  it("guards document tax type values", () => {
    expect(isDocumentTaxType("VAT_EXCLUSIVE")).toBe(true);
    expect(isDocumentTaxType("PER_LINE")).toBe(false);
  });
});
