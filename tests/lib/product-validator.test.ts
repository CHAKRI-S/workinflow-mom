import { describe, expect, it } from "vitest";
import { productCreateSchema, productUpdateSchema } from "@/lib/validators/product";

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

  it("does not inject create defaults during partial product updates", () => {
    const parsed = productUpdateSchema.parse({ name: "Updated Bracket" });

    expect(parsed).toEqual({ name: "Updated Bracket" });
    expect(parsed).not.toHaveProperty("productKind");
    expect(parsed).not.toHaveProperty("drawingSource");
    expect(parsed).not.toHaveProperty("defaultVatPriceMode");
  });
});
