import { describe, it, expect } from "vitest";
import {
  invoicePrefix,
  receiptPrefix,
  creditNotePrefix,
  previewDocNumber,
  DOC_PREFIX,
} from "@/lib/doc-numbering";

/**
 * Phase 8.12 regression suite: a doc is a VAT doc only when BOTH the
 * seller (tenant) and the buyer (customer) are VAT-registered. Non-VAT
 * sellers CANNOT issue VAT-prefixed docs, even to VAT-registered buyers
 * (ม.86 ประมวลรัษฎากร — 2× tax penalty + criminal).
 */

describe("doc-numbering prefix helpers — VAT gate", () => {
  describe("invoicePrefix", () => {
    it("VAT seller + VAT buyer → INV", () => {
      expect(invoicePrefix(true, true)).toBe(DOC_PREFIX.INVOICE_VAT);
    });

    it("VAT seller + non-VAT buyer → BIL (buyer-side preference)", () => {
      expect(invoicePrefix(true, false)).toBe(DOC_PREFIX.INVOICE_NON_VAT);
    });

    it("non-VAT seller + VAT buyer → BIL (seller cannot issue VAT docs)", () => {
      // Regression: before Phase 8.12 follow-up this returned INV_VAT.
      expect(invoicePrefix(false, true)).toBe(DOC_PREFIX.INVOICE_NON_VAT);
    });

    it("non-VAT seller + non-VAT buyer → BIL", () => {
      expect(invoicePrefix(false, false)).toBe(DOC_PREFIX.INVOICE_NON_VAT);
    });
  });

  describe("receiptPrefix", () => {
    it.each([
      [true, true, DOC_PREFIX.RECEIPT_VAT],
      [true, false, DOC_PREFIX.RECEIPT_NON_VAT],
      [false, true, DOC_PREFIX.RECEIPT_NON_VAT],
      [false, false, DOC_PREFIX.RECEIPT_NON_VAT],
    ] as const)(
      "tenantVat=%s + customerVat=%s → %s",
      (tenantVat, customerVat, expected) => {
        expect(receiptPrefix(tenantVat, customerVat)).toBe(expected);
      },
    );
  });

  describe("creditNotePrefix", () => {
    it.each([
      [true, true, DOC_PREFIX.CREDIT_NOTE_VAT],
      [true, false, DOC_PREFIX.CREDIT_NOTE_NON_VAT],
      [false, true, DOC_PREFIX.CREDIT_NOTE_NON_VAT],
      [false, false, DOC_PREFIX.CREDIT_NOTE_NON_VAT],
    ] as const)(
      "tenantVat=%s + customerVat=%s → %s",
      (tenantVat, customerVat, expected) => {
        expect(creditNotePrefix(tenantVat, customerVat)).toBe(expected);
      },
    );
  });
});

describe("previewDocNumber", () => {
  it("formats with tenant code + prefix + year + 5-digit seq", () => {
    expect(previewDocNumber("WF01", "INV", 1, 2026)).toBe(
      "WF01-INV-2026-00001",
    );
  });

  it("zero-pads short sequences", () => {
    expect(previewDocNumber("ACME", "QT", 42, 2026)).toBe(
      "ACME-QT-2026-00042",
    );
  });

  it("preserves 5-digit sequences without overflow", () => {
    expect(previewDocNumber("X", "SO", 99999, 2026)).toBe(
      "X-SO-2026-99999",
    );
  });

  it("omits the code segment when tenant has none (legacy tenants)", () => {
    expect(previewDocNumber(null, "INV", 1, 2026)).toBe("INV-2026-00001");
    expect(previewDocNumber("", "INV", 1, 2026)).toBe("INV-2026-00001");
    expect(previewDocNumber(undefined, "INV", 1, 2026)).toBe(
      "INV-2026-00001",
    );
  });

  it("trims whitespace from tenant code", () => {
    expect(previewDocNumber("  WF01  ", "INV", 1, 2026)).toBe(
      "WF01-INV-2026-00001",
    );
  });
});
