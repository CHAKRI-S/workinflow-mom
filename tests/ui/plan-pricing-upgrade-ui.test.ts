import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const upgradePageSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/admin/billing/upgrade/page.tsx"),
  "utf8",
);
const upgradeClientSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/admin/billing/upgrade/upgrade-client.tsx"),
  "utf8",
);
const superadminPlansSource = readFileSync(
  join(repoRoot, "src/app/superadmin/plans/plans-client.tsx"),
  "utf8",
);
const dashboardSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/dashboard/dashboard-client.tsx"),
  "utf8",
);
const dashboardPageSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/dashboard/page.tsx"),
  "utf8",
);

describe("plan pricing and upgrade UI contracts", () => {
  it("does not show the recurring non-VAT warning banner on the tenant dashboard", () => {
    expect(dashboardSource).not.toContain("กิจการนี้ยังไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม");
    expect(dashboardSource).not.toContain("ใบแจ้งหนี้ / ใบส่งของ");
    expect(dashboardSource).not.toContain("ม.86 ประมวลรัษฎากร");
    expect(dashboardPageSource).not.toContain("isVatRegistered");
    expect(dashboardPageSource).not.toContain("VAT banner");
  });

  it("loads and renders the same plan feature details on tenant upgrade cards as the public pricing page", () => {
    for (const field of [
      "maxWorkOrdersPerMonth",
      "featureProduction",
      "featureFinance",
      "featurePurchaseOrders",
      "featureMaintenance",
      "featureFactoryDashboard",
      "featureAuditLog",
      "featureAdvancedReports",
      "featureExcelExport",
      "featureCustomBranding",
      "featureApiAccess",
      "featureMultiLocation",
    ]) {
      expect(upgradePageSource).toContain(`${field}: true`);
      expect(upgradeClientSource).toContain(field);
    }

    expect(upgradeClientSource).toContain("เอกสารภาษีไทย (VAT/Non-VAT)");
    expect(upgradeClientSource).toContain("Production (WO, BOM)");
    expect(upgradeClientSource).toContain("Work Orders / เดือน");
  });

  it("edits plan prices in baht while saving satang to the API", () => {
    expect(superadminPlansSource).toContain("satangToBahtInputValue");
    expect(superadminPlansSource).toContain("bahtInputValueToSatang");
    expect(superadminPlansSource).toContain("value={satangToBahtInputValue(value)}");
    expect(superadminPlansSource).toContain("onChange(bahtInputValueToSatang(e.target.value))");
  });
});
