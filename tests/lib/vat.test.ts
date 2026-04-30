import { describe, expect, it } from "vitest";
import { calculateVatLine, calculateVatTotals } from "@/lib/vat";

describe("VAT price mode", () => {
  it("keeps VAT-exclusive prices as net prices", () => {
    const totals = calculateVatTotals(
      [{ quantity: 1, unitPrice: 1000, vatPriceMode: "EXCLUSIVE" }],
      { vatRate: 7 },
    );

    expect(totals.subtotal).toBe(1000);
    expect(totals.vatAmount).toBe(70);
    expect(totals.totalAmount).toBe(1070);
    expect(totals.lines[0]).toMatchObject({
      enteredUnitPrice: 1000,
      unitPrice: 1000,
      lineTotal: 1000,
      grossLineTotal: 1070,
      vatPriceMode: "EXCLUSIVE",
    });
  });

  it("extracts net and VAT from VAT-inclusive entered prices", () => {
    const line = calculateVatLine(
      { quantity: 1, unitPrice: 1070, vatPriceMode: "INCLUSIVE" },
      7,
    );

    expect(line).toMatchObject({
      enteredUnitPrice: 1070,
      unitPrice: 1000,
      lineTotal: 1000,
      vatAmount: 70,
      grossLineTotal: 1070,
      vatPriceMode: "INCLUSIVE",
    });
  });

  it("supports mixed per-line modes in one document", () => {
    const totals = calculateVatTotals(
      [
        { quantity: 1, unitPrice: 1000, vatPriceMode: "EXCLUSIVE" },
        { quantity: 1, unitPrice: 1070, vatPriceMode: "INCLUSIVE" },
      ],
      { vatRate: 7, vatModePolicy: "PER_LINE" },
    );

    expect(totals.subtotal).toBe(2000);
    expect(totals.vatAmount).toBe(140);
    expect(totals.totalAmount).toBe(2140);
    expect(totals.modeSummary.EXCLUSIVE.count).toBe(1);
    expect(totals.modeSummary.INCLUSIVE.count).toBe(1);
  });

  it("lets the document policy override line defaults", () => {
    const totals = calculateVatTotals(
      [{ quantity: 1, unitPrice: 1070, vatPriceMode: "EXCLUSIVE" }],
      { vatRate: 7, vatModePolicy: "FORCE_INCLUSIVE" },
    );

    expect(totals.subtotal).toBe(1000);
    expect(totals.vatAmount).toBe(70);
    expect(totals.totalAmount).toBe(1070);
    expect(totals.lines[0].vatPriceMode).toBe("INCLUSIVE");
  });

  it("applies document discount before VAT", () => {
    const totals = calculateVatTotals(
      [{ quantity: 1, unitPrice: 1000, vatPriceMode: "EXCLUSIVE" }],
      { vatRate: 7, discountPercent: 10 },
    );

    expect(totals.discountAmount).toBe(100);
    expect(totals.taxableAmount).toBe(900);
    expect(totals.vatAmount).toBe(63);
    expect(totals.totalAmount).toBe(963);
  });
});
