import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const businessInfoSource = readFileSync(
  join(repoRoot, "src/components/forms/business-info-section.tsx"),
  "utf8",
);
const customerFormSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/customers/customer-form.tsx"),
  "utf8",
);
const editPageSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/customers/[id]/page.tsx"),
  "utf8",
);
const schemaSource = readFileSync(join(repoRoot, "prisma/schema.prisma"), "utf8");

describe("customer structured billing address UI contract", () => {
  it("adds structured billing address fields to the Customer schema", () => {
    expect(schemaSource).toContain("billingSubdistrict");
    expect(schemaSource).toContain("billingDistrict");
    expect(schemaSource).toContain("billingProvince");
    expect(schemaSource).toContain("billingPostalCode");
  });

  it("renders Thai structured address controls in the business info section", () => {
    for (const text of ["ตำบล/แขวง", "อำเภอ/เขต", "จังหวัด", "รหัสไปรษณีย์"]) {
      expect(businessInfoSource).toContain(text);
    }
    expect(businessInfoSource).toContain("/api/locations/thai-addresses");
    expect(businessInfoSource).toContain("billingSubdistrict");
    expect(businessInfoSource).toContain("billingDistrict");
    expect(businessInfoSource).toContain("billingProvince");
    expect(businessInfoSource).toContain("billingPostalCode");
  });

  it("wires structured address fields through customer form create/edit state", () => {
    for (const source of [customerFormSource, editPageSource]) {
      expect(source).toContain("billingSubdistrict");
      expect(source).toContain("billingDistrict");
      expect(source).toContain("billingProvince");
      expect(source).toContain("billingPostalCode");
    }
  });
});
