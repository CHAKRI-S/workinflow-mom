import { describe, expect, it } from "vitest";
import {
  applyProductSnapshotsToQuotationLines,
  ProductSnapshotLookupError,
} from "@/lib/quotation-product-snapshots";

const baseLine = {
  productId: "prod-goods",
  description: "Bracket",
  quantity: 2,
  unitPrice: 100,
  vatPriceMode: "EXCLUSIVE" as const,
  discountPercent: 0,
  sortOrder: 0,
  // Client-sent values must be ignored by the snapshot helper.
  drawingSource: "CUSTOMER_PROVIDED" as const,
  lineBillingNature: "MANUFACTURING_SERVICE" as const,
  productCode: "FAKE-CODE",
  drawingRevision: "FAKE-REV",
  customerDrawingUrl: "https://fake.example/drawing.pdf",
};

const goodsProduct = {
  id: "prod-goods",
  code: "G-001",
  productKind: "GOODS" as const,
  drawingSource: "TENANT_OWNED" as const,
  drawingRevision: "R2",
  customerDrawingUrl: "https://customer.example/goods.pdf",
  fusionFileUrl: "https://fusion.example/goods.f3d",
};

const serviceProduct = {
  id: "prod-service",
  code: "S-001",
  productKind: "SERVICE" as const,
  drawingSource: "CUSTOMER_PROVIDED" as const,
  drawingRevision: null,
  customerDrawingUrl: null,
  fusionFileUrl: "https://fusion.example/service.f3d",
};

describe("quotation product snapshots", () => {
  it("overrides client-sent drawing/tax fields with Product master snapshots", () => {
    const result = applyProductSnapshotsToQuotationLines({
      lines: [baseLine],
      products: [goodsProduct],
    });

    expect(result.billingNature).toBe("GOODS");
    expect(result.lines[0]).toMatchObject({
      productId: "prod-goods",
      drawingSource: "TENANT_OWNED",
      lineBillingNature: "GOODS",
      productCode: "G-001",
      drawingRevision: "R2",
      customerDrawingUrl: "https://customer.example/goods.pdf",
    });
  });

  it("uses the Fusion file URL as the drawing URL fallback when no customer drawing URL exists", () => {
    const result = applyProductSnapshotsToQuotationLines({
      lines: [{ ...baseLine, productId: "prod-service" }],
      products: [serviceProduct],
    });

    expect(result.billingNature).toBe("MANUFACTURING_SERVICE");
    expect(result.lines[0]).toMatchObject({
      drawingSource: "CUSTOMER_PROVIDED",
      lineBillingNature: "MANUFACTURING_SERVICE",
      productCode: "S-001",
      drawingRevision: null,
      customerDrawingUrl: "https://fusion.example/service.f3d",
    });
  });

  it("derives MIXED header billing nature from goods and service products", () => {
    const result = applyProductSnapshotsToQuotationLines({
      lines: [baseLine, { ...baseLine, productId: "prod-service", sortOrder: 1 }],
      products: [goodsProduct, serviceProduct],
    });

    expect(result.billingNature).toBe("MIXED");
    expect(result.lines.map((line) => line.lineBillingNature)).toEqual([
      "GOODS",
      "MANUFACTURING_SERVICE",
    ]);
  });

  it("fails closed when a line references a product outside the provided tenant/active lookup", () => {
    expect(() =>
      applyProductSnapshotsToQuotationLines({
        lines: [{ ...baseLine, productId: "missing-product" }],
        products: [goodsProduct],
      }),
    ).toThrow(ProductSnapshotLookupError);
  });
});
