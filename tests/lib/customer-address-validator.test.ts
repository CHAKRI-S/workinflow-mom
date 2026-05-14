import { describe, expect, it } from "vitest";
import { customerCreateSchema, customerUpdateSchema } from "@/lib/validators/customer";

const baseCustomer = {
  name: "บริษัททดสอบ",
  customerType: "OTHER" as const,
  isVatRegistered: true,
  paymentTermDays: 30,
};

describe("customer structured billing address validation", () => {
  it("accepts complete Thai structured billing address fields", () => {
    const parsed = customerCreateSchema.parse({
      ...baseCustomer,
      country: "TH",
      billingAddress: "99/9 ถนนสุขุมวิท",
      billingSubdistrict: "คลองตันเหนือ",
      billingDistrict: "วัฒนา",
      billingProvince: "กรุงเทพมหานคร",
      billingPostalCode: "10110",
    });

    expect(parsed.billingSubdistrict).toBe("คลองตันเหนือ");
    expect(parsed.billingDistrict).toBe("วัฒนา");
    expect(parsed.billingProvince).toBe("กรุงเทพมหานคร");
    expect(parsed.billingPostalCode).toBe("10110");
  });

  it("rejects invalid postal code when provided", () => {
    const result = customerCreateSchema.safeParse({
      ...baseCustomer,
      country: "TH",
      billingSubdistrict: "บ้านบึง",
      billingDistrict: "บ้านบึง",
      billingProvince: "ชลบุรี",
      billingPostalCode: "2017",
    });

    expect(result.success).toBe(false);
  });

  it("requires a complete Thai structured address set when any structured field is provided", () => {
    const result = customerCreateSchema.safeParse({
      ...baseCustomer,
      country: "TH",
      billingProvince: "ชลบุรี",
      billingPostalCode: "20170",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(
        "billingSubdistrict",
      );
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(
        "billingDistrict",
      );
    }
  });

  it("allows partial structured address fields for non-Thai customers", () => {
    const parsed = customerUpdateSchema.parse({
      country: "OTHER",
      billingProvince: "Tokyo",
      billingPostalCode: "10001",
    });

    expect(parsed.billingProvince).toBe("Tokyo");
    expect(parsed.billingPostalCode).toBe("10001");
  });
});
