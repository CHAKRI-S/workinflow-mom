import { describe, expect, it } from "vitest";
import {
  calculateDocumentTotals,
  inheritDocumentTaxAndCurrency,
} from "@/lib/document-tax-propagation";
import {
  DOC_PREFIX,
  creditNotePrefixFromTaxType,
  invoicePrefixFromTaxType,
  receiptPrefixFromTaxType,
} from "@/lib/doc-numbering";

describe("document tax/currency propagation", () => {
  const line = {
    quantity: 1,
    unitPrice: 1070,
    discountPercent: 0,
    vatPriceMode: "EXCLUSIVE" as const,
  };

  it("NO_VAT forces VAT to zero even when the customer is VAT registered", () => {
    const result = calculateDocumentTotals({
      taxType: "NO_VAT",
      currencyCode: "USD",
      lines: [line],
    });

    expect(result.taxType).toBe("NO_VAT");
    expect(result.currencyCode).toBe("USD");
    expect(result.vatRate).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.totalAmount).toBe(1070);
    expect(result.vatModePolicy).toBe("FORCE_EXCLUSIVE");
  });

  it("VAT_EXCLUSIVE adds VAT even when the customer is not VAT registered", () => {
    const result = calculateDocumentTotals({
      taxType: "VAT_EXCLUSIVE",
      currencyCode: "THB",
      lines: [{ ...line, unitPrice: 1000 }],
    });

    expect(result.vatRate).toBe(7);
    expect(result.subtotal).toBe(1000);
    expect(result.vatAmount).toBe(70);
    expect(result.totalAmount).toBe(1070);
    expect(result.vatModePolicy).toBe("FORCE_EXCLUSIVE");
  });

  it("VAT_INCLUSIVE splits gross prices without increasing the total", () => {
    const result = calculateDocumentTotals({
      taxType: "VAT_INCLUSIVE",
      currencyCode: "THB",
      lines: [line],
    });

    expect(result.vatRate).toBe(7);
    expect(result.subtotal).toBe(1000);
    expect(result.vatAmount).toBe(70);
    expect(result.totalAmount).toBe(1070);
    expect(result.lines[0].unitPrice).toBe(1000);
    expect(result.lines[0].vatPriceMode).toBe("INCLUSIVE");
    expect(result.vatModePolicy).toBe("FORCE_INCLUSIVE");
  });

  it("normalizes and inherits tax type/currency from upstream documents", () => {
    expect(
      inheritDocumentTaxAndCurrency({
        source: { taxType: "NO_VAT", currencyCode: "usd" },
        override: {},
      }),
    ).toEqual({ taxType: "NO_VAT", currencyCode: "USD" });

    expect(
      inheritDocumentTaxAndCurrency({
        source: { taxType: "NO_VAT", currencyCode: "USD" },
        override: { taxType: "VAT_EXCLUSIVE", currencyCode: "thb" },
      }),
    ).toEqual({ taxType: "VAT_EXCLUSIVE", currencyCode: "THB" });
  });
});

describe("document prefixes from tax type", () => {
  it.each([
    ["NO_VAT", DOC_PREFIX.INVOICE_NON_VAT],
    ["VAT_EXCLUSIVE", DOC_PREFIX.INVOICE_VAT],
    ["VAT_INCLUSIVE", DOC_PREFIX.INVOICE_VAT],
  ] as const)("invoice %s uses %s", (taxType, expected) => {
    expect(invoicePrefixFromTaxType(taxType)).toBe(expected);
  });

  it.each([
    ["NO_VAT", DOC_PREFIX.RECEIPT_NON_VAT],
    ["VAT_EXCLUSIVE", DOC_PREFIX.RECEIPT_VAT],
    ["VAT_INCLUSIVE", DOC_PREFIX.RECEIPT_VAT],
  ] as const)("receipt %s uses %s", (taxType, expected) => {
    expect(receiptPrefixFromTaxType(taxType)).toBe(expected);
  });

  it.each([
    ["NO_VAT", DOC_PREFIX.CREDIT_NOTE_NON_VAT],
    ["VAT_EXCLUSIVE", DOC_PREFIX.CREDIT_NOTE_VAT],
    ["VAT_INCLUSIVE", DOC_PREFIX.CREDIT_NOTE_VAT],
  ] as const)("credit note %s uses %s", (taxType, expected) => {
    expect(creditNotePrefixFromTaxType(taxType)).toBe(expected);
  });
});
