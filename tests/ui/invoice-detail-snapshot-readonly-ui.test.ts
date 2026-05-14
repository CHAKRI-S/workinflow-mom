import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const invoiceDetailSource = readFileSync(
  join(
    repoRoot,
    "src/app/[locale]/(main)/finance/invoices/[id]/invoice-detail-client.tsx",
  ),
  "utf8",
);

describe("invoice detail snapshot metadata UI contracts", () => {
  it("shows invoice billing/drawing snapshots as read-only details, not editable tax policy controls", () => {
    expect(invoiceDetailSource).not.toContain("BillingNaturePicker");
    expect(invoiceDetailSource).not.toContain("DrawingSourceRow");
    expect(invoiceDetailSource).not.toContain("suggestBillingNature");
    expect(invoiceDetailSource).not.toContain("handleSaveTaxPolicy");
    expect(invoiceDetailSource).not.toContain("updateLineEdit");
    expect(invoiceDetailSource).not.toContain("setBillingNature");
    expect(invoiceDetailSource).not.toContain("setLineEdits");
    expect(invoiceDetailSource).not.toContain("แบบงาน / Drawing source per line");
    expect(invoiceDetailSource).not.toContain("แก้ไขได้เฉพาะตอน status = DRAFT เท่านั้น");

    expect(invoiceDetailSource).toContain("นโยบายภาษีจาก Invoice snapshot");
    expect(invoiceDetailSource).toContain("Line snapshots");
    expect(invoiceDetailSource).toContain("Product/SO/Invoice snapshot");
    expect(invoiceDetailSource).toContain("invoice.billingNature");
    expect(invoiceDetailSource).toContain("line.lineBillingNature");
  });

  it("does not send billingNature or line drawing overrides through the detail PATCH path", () => {
    expect(invoiceDetailSource).not.toContain("billingNature,");
    expect(invoiceDetailSource).not.toContain("lines: lineEdits");
    expect(invoiceDetailSource).not.toContain("drawingSource: l.drawingSource");
    expect(invoiceDetailSource).not.toContain("customerDrawingUrl: l.customerDrawingUrl");
    expect(invoiceDetailSource).toContain("status: newStatus");
    expect(invoiceDetailSource).toContain("status: \"CANCELLED\"");
  });
});
