import { describe, expect, it } from "vitest";
import {
  billingNatureFromProductKind,
  deriveDocumentBillingNature,
} from "@/lib/product-billing";

describe("product billing derivation", () => {
  it("maps GOODS product kind to GOODS billing nature", () => {
    expect(billingNatureFromProductKind("GOODS")).toBe("GOODS");
  });

  it("maps SERVICE product kind to MANUFACTURING_SERVICE billing nature", () => {
    expect(billingNatureFromProductKind("SERVICE")).toBe(
      "MANUFACTURING_SERVICE",
    );
  });

  it("derives GOODS when all lines are goods", () => {
    expect(
      deriveDocumentBillingNature([
        { productKind: "GOODS" },
        { productKind: "GOODS" },
      ]),
    ).toBe("GOODS");
  });

  it("derives MANUFACTURING_SERVICE when all lines are services", () => {
    expect(
      deriveDocumentBillingNature([
        { productKind: "SERVICE" },
        { productKind: "SERVICE" },
      ]),
    ).toBe("MANUFACTURING_SERVICE");
  });

  it("derives MIXED when goods and services are both present", () => {
    expect(
      deriveDocumentBillingNature([
        { productKind: "GOODS" },
        { productKind: "SERVICE" },
      ]),
    ).toBe("MIXED");
  });

  it("defaults missing productKind safely to GOODS", () => {
    expect(deriveDocumentBillingNature([{}, { productKind: null }])).toBe(
      "GOODS",
    );
  });

  it("does not use drawingSource to derive billing nature", () => {
    const customerDrawingOnlyLines = [
      {
        productKind: undefined,
        drawingSource: "CUSTOMER_PROVIDED" as const,
      },
    ];
    const goodsWithCustomerDrawingLines = [
      {
        productKind: "GOODS" as const,
        drawingSource: "CUSTOMER_PROVIDED" as const,
      },
    ];
    const serviceWithTenantDrawingLines = [
      {
        productKind: "SERVICE" as const,
        drawingSource: "TENANT_OWNED" as const,
      },
    ];

    expect(deriveDocumentBillingNature(customerDrawingOnlyLines)).toBe("GOODS");
    expect(deriveDocumentBillingNature(goodsWithCustomerDrawingLines)).toBe(
      "GOODS",
    );
    expect(deriveDocumentBillingNature(serviceWithTenantDrawingLines)).toBe(
      "MANUFACTURING_SERVICE",
    );
  });
});
