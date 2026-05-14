import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const productFormSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/products/product-form.tsx"),
  "utf8",
);
const quotationFormSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/quotations/quotation-form.tsx"),
  "utf8",
);
const orderFormSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/orders/order-form.tsx"),
  "utf8",
);

function selectValueBlockFor(source: string, helperName: string): string {
  const pattern = new RegExp(`<SelectValue>\\s*\\{\\(value\\) => ${helperName}\\(value\\)[\\s\\S]*?}\\s*</SelectValue>`);
  const match = source.match(pattern);
  return match?.[0] ?? "";
}

describe("Thai select trigger value regressions", () => {
  it("documents why enum/id SelectValue triggers must render explicit labels", () => {
    // Base UI SelectValue can render the selected raw value for self-closing triggers.
    // For Thai UI, enum/id selects must pass children renderers so selected values are
    // readable labels such as สินค้า/VAT นอก/code — name instead of GOODS/ids.
    expect(productFormSource).toContain("SelectValue");
  });

  it("renders Product form enum and material selected values with Thai/readable labels", () => {
    for (const helperName of [
      "getProductKindLabelTh",
      "getVatPriceModeLabelTh",
      "getDrawingSourceLabelTh",
      "getBomMaterialModeLabelTh",
      "getBomMaterialSourcingLabelTh",
      "getMaterialUnitLabelTh",
    ]) {
      expect(productFormSource).toContain(helperName);
      expect(selectValueBlockFor(productFormSource, helperName)).not.toBe("");
    }

    expect(productFormSource).toContain("getMaterialOptionLabel");
    expect(productFormSource).toContain("getMaterialOptionLabel(materials, value)");
    expect(productFormSource).not.toContain("<SelectValue placeholder={t(\"product.selectMaterial\")} />");
  });

  it("renders quotation selected customer/product/tax/currency values with readable labels", () => {
    for (const helperName of [
      "getCustomerOptionLabel",
      "getProductOptionLabel",
      "getTaxTypeLabelTh",
      "getCurrencySelectLabel",
    ]) {
      expect(quotationFormSource).toContain(helperName);
    }

    expect(quotationFormSource).toContain("getCustomerOptionLabel(customers, value)");
    expect(quotationFormSource).toContain("getProductOptionLabel(products, value)");
    expect(quotationFormSource).not.toContain("<SelectValue placeholder={t(\"selectCustomer\")} />");
    expect(quotationFormSource).not.toContain("placeholder={t(\"selectProduct\")}\n                              />");
  });

  it("renders sales order selected customer/product/VAT/tax/currency values with readable labels", () => {
    for (const helperName of [
      "getCustomerOptionLabel",
      "getProductOptionLabel",
      "getVatPriceModeLabelTh",
      "getTaxTypeLabelTh",
      "getCurrencySelectLabel",
    ]) {
      expect(orderFormSource).toContain(helperName);
    }

    expect(orderFormSource).toContain("getCustomerOptionLabel(customers, value)");
    expect(orderFormSource).toContain("getProductOptionLabel(products, value)");
    expect(orderFormSource).not.toContain("<SelectValue placeholder={t(\"salesOrder.selectCustomer\")} />");
    expect(orderFormSource).not.toContain("placeholder={t(\"salesOrder.selectProduct\")}\n                              />");
  });
});
