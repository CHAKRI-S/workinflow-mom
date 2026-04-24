import { describe, it, expect } from "vitest";
import { suggestBillingNature } from "@/lib/validators/billing-nature";

/**
 * Phase 8B auto-suggest: billing nature inferred from per-line drawing source.
 * Drives the "ใครเป็นเจ้าของแบบ" classification that separates OEM goods
 * from contract manufacturing (tax treatment hinges on this).
 */

describe("suggestBillingNature", () => {
  it("empty lines default to GOODS (safer for OEM factor)", () => {
    expect(suggestBillingNature([])).toBe("GOODS");
  });

  it("all TENANT_OWNED → GOODS", () => {
    expect(
      suggestBillingNature([
        { drawingSource: "TENANT_OWNED" },
        { drawingSource: "TENANT_OWNED" },
      ]),
    ).toBe("GOODS");
  });

  it("all CUSTOMER_PROVIDED → MANUFACTURING_SERVICE", () => {
    expect(
      suggestBillingNature([
        { drawingSource: "CUSTOMER_PROVIDED" },
        { drawingSource: "CUSTOMER_PROVIDED" },
      ]),
    ).toBe("MANUFACTURING_SERVICE");
  });

  it("any TENANT_OWNED mixed with CUSTOMER_PROVIDED → MIXED", () => {
    expect(
      suggestBillingNature([
        { drawingSource: "TENANT_OWNED" },
        { drawingSource: "CUSTOMER_PROVIDED" },
      ]),
    ).toBe("MIXED");
  });

  it("JOINT_DEVELOPMENT alone → MIXED (grey area, force user to pick)", () => {
    expect(
      suggestBillingNature([{ drawingSource: "JOINT_DEVELOPMENT" }]),
    ).toBe("MIXED");
  });

  it("JOINT_DEVELOPMENT with anything else → MIXED", () => {
    expect(
      suggestBillingNature([
        { drawingSource: "TENANT_OWNED" },
        { drawingSource: "JOINT_DEVELOPMENT" },
      ]),
    ).toBe("MIXED");
    expect(
      suggestBillingNature([
        { drawingSource: "CUSTOMER_PROVIDED" },
        { drawingSource: "JOINT_DEVELOPMENT" },
      ]),
    ).toBe("MIXED");
  });

  it("missing drawingSource defaults to TENANT_OWNED (OEM factor profile)", () => {
    expect(suggestBillingNature([{}, {}])).toBe("GOODS");
  });

  it("single line variants", () => {
    expect(
      suggestBillingNature([{ drawingSource: "TENANT_OWNED" }]),
    ).toBe("GOODS");
    expect(
      suggestBillingNature([{ drawingSource: "CUSTOMER_PROVIDED" }]),
    ).toBe("MANUFACTURING_SERVICE");
  });
});
