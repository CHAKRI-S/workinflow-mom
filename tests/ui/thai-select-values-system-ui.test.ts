import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function expectContainsAll(source: string, snippets: string[]): void {
  for (const snippet of snippets) {
    expect(source).toContain(snippet);
  }
}

describe("system-wide Thai/readable SelectValue trigger regressions", () => {
  it("renders remaining sales/admin enum filters and roles with Thai labels", () => {
    expectContainsAll(readSource("src/app/[locale]/(main)/sales/customers/customer-form.tsx"), [
      "getCustomerTypeLabelTh",
      "getCustomerTypeLabelTh(value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/sales/quotations/quotation-list-client.tsx"), [
      "getAllOptionLabelTh",
      "getQuotationStatusLabelTh",
      "getQuotationStatusLabelTh(value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/sales/orders/[id]/order-detail-client.tsx"), [
      "getSalesOrderStatusLabelTh",
      "getSalesOrderStatusLabelTh(value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/admin/settings/settings-client.tsx"), [
      "getVatRegistrationLabelTh",
      "getBillingNatureLabelTh",
      "getVatRegistrationLabelTh(value)",
      "getBillingNatureLabelTh(value)",
    ]);
    for (const file of [
      "src/app/[locale]/(main)/admin/users/user-list-client.tsx",
      "src/app/[locale]/(main)/admin/users/new/user-form-client.tsx",
      "src/app/[locale]/(main)/admin/users/[id]/user-detail-client.tsx",
    ]) {
      expectContainsAll(readSource(file), ["getUserRoleLabelTh", "getUserRoleLabelTh(value)"]);
    }
  });

  it("renders procurement selected line/category/material/consumable values as labels", () => {
    expectContainsAll(readSource("src/app/[locale]/(main)/procurement/purchase-orders/new/po-form-client.tsx"), [
      "getPurchaseOrderLineTypeLabelTh",
      "getPurchaseOrderLineTypeLabelTh(value)",
      "getMaterialOptionLabel",
      "getMaterialOptionLabel(materials, value)",
      "getConsumableOptionLabel",
      "getConsumableOptionLabel(consumables, value)",
    ]);
    for (const file of [
      "src/app/[locale]/(main)/procurement/consumables/consumable-list-client.tsx",
      "src/app/[locale]/(main)/procurement/consumables/new/consumable-form-client.tsx",
      "src/app/[locale]/(main)/procurement/consumables/[id]/consumable-detail-client.tsx",
    ]) {
      expectContainsAll(readSource(file), ["getConsumableCategoryLabelTh", "getConsumableCategoryLabelTh(value)"]);
    }
  });

  it("renders production selected entities/enums with readable labels", () => {
    expectContainsAll(readSource("src/app/[locale]/(main)/production/work-orders/work-order-list-client.tsx"), [
      "getAllOptionLabelTh",
      "getWorkOrderStatusLabelTh",
      "getWorkOrderPriorityLabelTh",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/production/work-orders/new/work-order-form-client.tsx"), [
      "getProductOptionLabel(products, value)",
      "getMachineOptionLabel(machines, value)",
      "getWorkOrderPriorityLabelTh(value)",
    ]);
    for (const file of [
      "src/app/[locale]/(main)/production/materials/new/material-form-client.tsx",
      "src/app/[locale]/(main)/production/materials/[id]/material-detail-client.tsx",
    ]) {
      expectContainsAll(readSource(file), ["getMaterialUnitLabelTh", "getMaterialUnitLabelTh(value)"]);
    }
    expectContainsAll(readSource("src/app/[locale]/(main)/production/products/[id]/product-detail-client.tsx"), [
      "getMaterialOptionLabel(materials, value)",
      "getBomMaterialSourcingLabelTh(value)",
      "sourcing: l.sourcing ?? \"STOCK_CUT\"",
      "sourcing: \"STOCK_CUT\"",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/production/plans/plan-scheduler.tsx"), [
      "getSalesOrderOptionLabel(availableSOs, value)",
      "getSalesOrderLineOptionLabel(selectedSO.lines, value)",
      "getMachineOptionLabel(machines, value)",
      "getMaterialReadinessLabelTh(value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/production/machines/new/machine-form-client.tsx"), [
      "getMachineTypeLabelTh(value)",
      "getMachineStatusLabelTh(value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/production/machines/[id]/machine-detail-client.tsx"), [
      "getMachineTypeLabelTh(value)",
      "getMachineStatusLabelTh(value)",
      "getMaintenanceTypeLabelTh(value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/production/maintenance/maintenance-client.tsx"), [
      "getMachineOptionLabel(machines, value)",
      "getMaintenanceTypeLabelTh(value)",
    ]);
  });

  it("does not fall back to raw ids when selected entity options are missing", () => {
    for (const file of [
      "src/app/[locale]/(main)/sales/quotations/quotation-form.tsx",
      "src/app/[locale]/(main)/sales/orders/order-form.tsx",
      "src/app/[locale]/(main)/procurement/purchase-orders/new/po-form-client.tsx",
      "src/app/[locale]/(main)/production/work-orders/new/work-order-form-client.tsx",
      "src/app/[locale]/(main)/production/products/product-form.tsx",
      "src/app/[locale]/(main)/production/products/[id]/product-detail-client.tsx",
      "src/app/[locale]/(main)/production/plans/plan-scheduler.tsx",
      "src/app/[locale]/(main)/production/maintenance/maintenance-client.tsx",
      "src/app/[locale]/(main)/finance/receipts/new/receipt-form-client.tsx",
      "src/app/[locale]/(main)/finance/invoices/new/invoice-form-client.tsx",
    ]) {
      const source = readSource(file);
      expect(source).not.toMatch(/:\s*(customerId|productId|materialId|machineId|salesOrderId|invoiceId|value)\s*;/);
      expect(source).not.toMatch(/return\s+(customerId|productId|materialId|machineId|salesOrderId|invoiceId|value)\s*;/);
    }
  });

  it("renders finance filters/status/id selects with Thai/readable selected labels", () => {
    for (const file of [
      "src/app/[locale]/(main)/finance/receipts/receipt-list-client.tsx",
      "src/app/[locale]/(main)/finance/invoices/invoice-list-client.tsx",
      "src/app/[locale]/(main)/finance/tax-invoices/tax-invoice-list-client.tsx",
      "src/app/[locale]/(main)/finance/credit-notes/credit-note-list-client.tsx",
    ]) {
      expectContainsAll(readSource(file), ["getAllOptionLabelTh", "getFinanceStatusLabelTh"]);
    }
    expectContainsAll(readSource("src/app/[locale]/(main)/finance/receipts/new/receipt-form-client.tsx"), [
      "getInvoiceOptionLabel(invoices, value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/finance/receipts/[id]/receipt-detail-client.tsx"), [
      "getWhtCertStatusLabelTh(value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/finance/invoices/new/invoice-form-client.tsx"), [
      "getSalesOrderOptionLabel(salesOrders, value)",
      "getInvoiceTypeLabelTh(value)",
    ]);
    expectContainsAll(readSource("src/app/[locale]/(main)/finance/invoices/[id]/invoice-detail-client.tsx"), [
      "getFinanceStatusLabelTh(value)",
    ]);
  });
});
