import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const drawingSourceReport = readFileSync(
  join(repoRoot, "src/app/api/finance/reports/drawing-source-mix/route.ts"),
  "utf8",
);
const revenueByNatureReport = readFileSync(
  join(repoRoot, "src/app/api/finance/reports/revenue-by-nature/route.ts"),
  "utf8",
);
const invoiceMapper = readFileSync(
  join(repoRoot, "src/lib/pdf/mappers.ts"),
  "utf8",
);
const invoiceMixedTemplate = readFileSync(
  join(repoRoot, "src/lib/pdf/templates/invoice-mixed.tsx"),
  "utf8",
);
const invoiceServiceTemplate = readFileSync(
  join(repoRoot, "src/lib/pdf/templates/invoice-service.tsx"),
  "utf8",
);
const drawingSourceClient = readFileSync(
  join(
    repoRoot,
    "src/app/[locale]/(main)/finance/reports/drawing-source-mix/drawing-source-mix-client.tsx",
  ),
  "utf8",
);
const revenueByNatureClient = readFileSync(
  join(
    repoRoot,
    "src/app/[locale]/(main)/finance/reports/revenue-by-nature/revenue-by-nature-client.tsx",
  ),
  "utf8",
);
const reportsIndexPage = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/finance/reports/page.tsx"),
  "utf8",
);

describe("invoice reports and PDF snapshot wording", () => {
  it("describes drawing-source reports as Product/SO/Invoice snapshot metadata, not quote-level tax auto-classification", () => {
    expect(drawingSourceReport).toContain("Product master drawing metadata snapshotted onto InvoiceLine");
    expect(drawingSourceReport).toContain("does not auto-classify billing nature");
    expect(drawingSourceReport).toContain("Source: InvoiceLine snapshot");
    expect(drawingSourceClient).toContain("Drawing Source snapshot จาก Product/SO/Invoice");
    expect(drawingSourceClient).toContain("ไม่ auto-classify Billing Nature");
    expect(drawingSourceClient).toContain("ดูจากรายงาน Billing Nature snapshot แยกต่างหาก");
    expect(reportsIndexPage).toContain("Drawing Source snapshot ใน Product/SO/Invoice");

    const combinedDrawingCopy = `${drawingSourceReport}\n${drawingSourceClient}\n${reportsIndexPage}`;
    expect(combinedDrawingCopy).not.toContain("tax implications (WHT exposure)");
    expect(combinedDrawingCopy).not.toContain("contract-service provider");
    expect(combinedDrawingCopy).not.toContain("Contract Manufacturing");
    expect(combinedDrawingCopy).not.toContain("WHT risk");
  });

  it("documents revenue-by-nature and PDF splitting as invoice snapshot based", () => {
    expect(revenueByNatureReport).toContain("Invoice.billingNature snapshot");
    expect(revenueByNatureReport).toContain("Product/SO-derived snapshot");
    expect(revenueByNatureClient).toContain("Invoice.billingNature snapshot ที่ derive จาก Product/SO");
    expect(invoiceMapper).toContain("InvoiceLine snapshot from Product/SO at invoice creation time");
    expect(invoiceMixedTemplate).toContain("lineBillingNature invoice snapshot");
    expect(invoiceServiceTemplate).toContain("Product/SO-derived invoice snapshot");
    expect(invoiceServiceTemplate).not.toContain("customer-owned drawings");
  });
});
