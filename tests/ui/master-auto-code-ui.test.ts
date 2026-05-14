import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const productForm = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/products/product-form.tsx"),
  "utf8",
);
const materialForm = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/materials/new/material-form-client.tsx"),
  "utf8",
);
const customerForm = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/customers/customer-form.tsx"),
  "utf8",
);
const machineForm = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/machines/new/machine-form-client.tsx"),
  "utf8",
);
const consumableForm = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/procurement/consumables/new/consumable-form-client.tsx"),
  "utf8",
);

describe("master create forms communicate server-generated codes", () => {
  it("product create form does not ask for a required user-entered code", () => {
    expect(productForm).toContain("ระบบจะสร้างรหัสสินค้าให้อัตโนมัติ");
    expect(productForm).not.toContain('<Label>{t("product.code")} *</Label>');
    expect(productForm).not.toContain('placeholder="PRD-00001"');
  });

  it("material create form does not register code as a required input", () => {
    expect(materialForm).toContain("ระบบจะสร้างรหัสวัตถุดิบให้อัตโนมัติ");
    expect(materialForm).not.toContain('register("code"');
    expect(materialForm).not.toContain("Code is required");
    expect(materialForm).not.toContain("code: data.code");
  });

  it("customer and machine create forms use read-only auto-code helper copy", () => {
    expect(customerForm).toContain("ระบบจะสร้างรหัสลูกค้าให้อัตโนมัติ");
    expect(machineForm).toContain("ระบบจะสร้างรหัสเครื่องจักรให้อัตโนมัติ");
    expect(machineForm).not.toContain('register("code"');
  });

  it("consumable create form no longer blocks submit until a code is typed", () => {
    expect(consumableForm).toContain("ระบบจะสร้างรหัสวัสดุสิ้นเปลืองให้อัตโนมัติ");
    expect(consumableForm).not.toContain("Code and name are required");
    expect(consumableForm).not.toContain("code: code.trim()");
    expect(consumableForm).not.toContain("setCode");
  });
});
