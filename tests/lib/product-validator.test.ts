import { describe, expect, it } from "vitest";
import { bomLineSchema, productCreateSchema, productUpdateSchema } from "@/lib/validators/product";

const baseProduct = {
  code: "P-001",
  name: "Bracket",
  requiresPainting: false,
  requiresLogoEngraving: false,
  leadTimeDays: 0,
};

describe("product validator", () => {
  it("defaults product kind and drawing source for backward-compatible product creation", () => {
    const parsed = productCreateSchema.parse(baseProduct);

    expect(parsed.productKind).toBe("GOODS");
    expect(parsed.drawingSource).toBe("TENANT_OWNED");
  });

  it("accepts product kind and product-level drawing metadata", () => {
    const parsed = productCreateSchema.parse({
      ...baseProduct,
      productKind: "SERVICE",
      drawingSource: "CUSTOMER_PROVIDED",
      drawingRevision: "REV-A",
      customerDrawingUrl: "https://example.com/customer-drawing.pdf",
      fusionFileUrl: "",
    });

    expect(parsed).toMatchObject({
      productKind: "SERVICE",
      drawingSource: "CUSTOMER_PROVIDED",
      drawingRevision: "REV-A",
      customerDrawingUrl: "https://example.com/customer-drawing.pdf",
      fusionFileUrl: "",
    });
  });

  it("accepts an empty customer drawing URL", () => {
    expect(
      productCreateSchema.parse({
        ...baseProduct,
        customerDrawingUrl: "",
      }).customerDrawingUrl,
    ).toBe("");
  });

  it("rejects invalid customer drawing URLs", () => {
    expect(() =>
      productCreateSchema.parse({
        ...baseProduct,
        customerDrawingUrl: "not-a-url",
      }),
    ).toThrow();
  });

  it("accepts one combined finishing note instead of separate color and surface defaults", () => {
    const parsed = productCreateSchema.parse({
      ...baseProduct,
      requiresPainting: true,
      requiresLogoEngraving: true,
      finishingNotes: "ลูกค้าสั่งสีแดง/ดำใน PO เดียวกัน; ผิว anodize ตาม line item",
    });

    expect(parsed.finishingNotes).toBe(
      "ลูกค้าสั่งสีแดง/ดำใน PO เดียวกัน; ผิว anodize ตาม line item",
    );
  });

  it("does not inject create defaults during partial product updates", () => {
    const parsed = productUpdateSchema.parse({ name: "Updated Bracket" });

    expect(parsed).toEqual({ name: "Updated Bracket" });
    expect(parsed).not.toHaveProperty("productKind");
    expect(parsed).not.toHaveProperty("drawingSource");
    expect(parsed).not.toHaveProperty("defaultVatPriceMode");
  });
});

describe("bomLineSchema", () => {
  const baseLine = {
    qtyPerUnit: 1.5,
    sortOrder: 0,
  };

  it("accepts an existing materialId with STOCK_CUT sourcing", () => {
    const parsed = bomLineSchema.parse({
      ...baseLine,
      materialId: "mat_1",
      sourcing: "STOCK_CUT",
    });

    expect(parsed).toMatchObject({
      materialId: "mat_1",
      sourcing: "STOCK_CUT",
    });
  });

  it("accepts a newMaterial without code with JOB_SPECIFIC sourcing", () => {
    const parsed = bomLineSchema.parse({
      ...baseLine,
      newMaterial: {
        name: "Aluminum 6061 Round Bar",
        type: "ALUMINUM",
        specification: "6061-T6",
        unit: "BAR",
        dimensions: "Ø50 x 3000mm",
        minStockQty: 2,
        unitCost: 1800,
      },
      sourcing: "JOB_SPECIFIC",
    });

    expect(parsed).toMatchObject({
      newMaterial: {
        name: "Aluminum 6061 Round Bar",
        unit: "BAR",
      },
      sourcing: "JOB_SPECIFIC",
    });
    expect(parsed.newMaterial).not.toHaveProperty("code");
  });

  it("does not default sortOrder so the API can preserve array order", () => {
    const parsed = bomLineSchema.parse({
      materialId: "mat_1",
      qtyPerUnit: 1,
    });

    expect(parsed.sortOrder).toBeUndefined();
    expect(parsed.sourcing).toBe("STOCK_CUT");
  });

  it("rejects inline material payloads that try to provide a manual code", () => {
    expect(() =>
      bomLineSchema.parse({
        ...baseLine,
        newMaterial: {
          code: "MANUAL-MAT-001",
          name: "Should auto-generate",
        },
      }),
    ).toThrow();
  });

  it("rejects lines with neither materialId nor newMaterial", () => {
    expect(() =>
      bomLineSchema.parse({
        ...baseLine,
        sourcing: "STOCK_CUT",
      }),
    ).toThrow();
  });

  it("rejects lines with both materialId and newMaterial", () => {
    expect(() =>
      bomLineSchema.parse({
        ...baseLine,
        materialId: "mat_1",
        newMaterial: { name: "Duplicate inline material" },
        sourcing: "JOB_SPECIFIC",
      }),
    ).toThrow();
  });
});
