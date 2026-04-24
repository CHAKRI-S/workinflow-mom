"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Loader2 } from "lucide-react";

interface PublicPlan {
  id: string;
  tier: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  yearlyDiscountPercent: number;
  maxUsers: number;
  maxMachines: number;
  maxCustomers: number;
  maxProducts: number;
  maxWorkOrdersPerMonth: number;
  featureProduction: boolean;
  featureFinance: boolean;
  featureMaintenance: boolean;
  featureFactoryDashboard: boolean;
  featureAuditLog: boolean;
  featurePurchaseOrders: boolean;
  featureAdvancedReports: boolean;
  featureExcelExport: boolean;
  featureCustomBranding: boolean;
  featureApiAccess: boolean;
  featureMultiLocation: boolean;
  sortOrder: number;
}

export function PricingSection({ showFullTable = false }: { showFullTable?: boolean }) {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetch("/api/public/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans([]));
  }, []);

  if (plans === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        ไม่สามารถโหลดข้อมูลแผนได้ในขณะนี้
      </div>
    );
  }

  function formatPrice(satang: number) {
    if (satang === 0) return "ฟรี";
    return `฿${(satang / 100).toLocaleString("th-TH")}`;
  }

  function limitText(n: number, unit: string) {
    return n === 0 ? `ไม่จำกัด${unit}` : `${n.toLocaleString()} ${unit}`;
  }

  // Grid column classes adapt to plan count so cards stay centered even when
  // a plan (e.g. FREE) is hidden. Tailwind JIT needs full literal class names
  // — that's why this is a lookup map, not a dynamic string.
  // `max-w-*` + `mx-auto` centers the whole grid in its parent.
  const gridColsByCount: Record<number, string> = {
    1: "md:grid-cols-1 lg:grid-cols-1 max-w-sm mx-auto",
    2: "md:grid-cols-2 lg:grid-cols-2 max-w-3xl mx-auto",
    3: "md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };
  const gridColsClass = gridColsByCount[Math.min(plans.length, 4)] ?? gridColsByCount[4];

  return (
    <div>
      {/* Billing cycle toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-full border bg-background p-1">
          <button
            onClick={() => setCycle("monthly")}
            className={`px-5 py-1.5 text-sm font-medium rounded-full transition ${
              cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            รายเดือน
          </button>
          <button
            onClick={() => setCycle("yearly")}
            className={`px-5 py-1.5 text-sm font-medium rounded-full transition ${
              cycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            รายปี
            <span className="ml-1.5 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-green-600">
              -17%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className={`grid ${gridColsClass} gap-4 lg:gap-6`}>
        {plans.map((p) => {
          const isPopular = p.slug === "pro";
          const price = cycle === "monthly" ? p.priceMonthly : Math.round(p.priceYearly / 12);
          const suffix = cycle === "monthly" ? "/เดือน" : "/เดือน (จ่ายรายปี)";

          return (
            <div
              key={p.id}
              className={`relative rounded-2xl border bg-card p-6 flex flex-col ${
                isPopular ? "border-primary ring-2 ring-primary/20" : ""
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  แนะนำ
                </div>
              )}
              <div className="font-semibold text-lg">{p.name}</div>
              {p.description && (
                <div className="text-sm text-muted-foreground mt-1 min-h-[40px]">
                  {p.description}
                </div>
              )}
              <div className="mt-4">
                <div className="text-3xl font-bold">
                  {formatPrice(price)}
                </div>
                {p.priceMonthly > 0 && (
                  <div className="text-xs text-muted-foreground">{suffix}</div>
                )}
              </div>

              <Link
                href="/signup"
                className={`mt-6 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition ${
                  isPopular
                    ? "bg-primary text-primary-foreground hover:bg-blue-600"
                    : "border bg-background hover:bg-muted"
                }`}
              >
                เริ่มใช้ฟรี 30 วัน
              </Link>

              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{limitText(p.maxUsers, "ผู้ใช้งาน")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{limitText(p.maxMachines, "เครื่อง CNC")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{limitText(p.maxCustomers, "ลูกค้า")}</span>
                </li>
                {p.featureFinance && (
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>เอกสารภาษีไทย (VAT/Non-VAT)</span>
                  </li>
                )}
                {p.featureMaintenance && (
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>บันทึกซ่อมบำรุง</span>
                  </li>
                )}
                {p.featureFactoryDashboard && (
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Dashboard TV หน้าโรงงาน</span>
                  </li>
                )}
                {p.featureAuditLog && (
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Audit Log (ISO 9001)</span>
                  </li>
                )}
                {p.featureAdvancedReports && (
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>รายงานขั้นสูง</span>
                  </li>
                )}
                {p.featureCustomBranding && (
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Custom Branding</span>
                  </li>
                )}
                {p.featureApiAccess && (
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>API Access</span>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Full comparison table */}
      {showFullTable && (
        <div className="mt-16 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold">Features</th>
                {plans.map((p) => (
                  <th key={p.id} className="text-center py-3 px-4 font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <FeatureRow label="Users" values={plans.map((p) => limitText(p.maxUsers, ""))} />
              <FeatureRow label="เครื่อง CNC" values={plans.map((p) => limitText(p.maxMachines, ""))} />
              <FeatureRow label="ลูกค้า" values={plans.map((p) => limitText(p.maxCustomers, ""))} />
              <FeatureRow label="สินค้า" values={plans.map((p) => limitText(p.maxProducts, ""))} />
              <FeatureRow label="Work Orders / เดือน" values={plans.map((p) => limitText(p.maxWorkOrdersPerMonth, ""))} />
              <FeatureBoolRow label="Production (WO, BOM)" values={plans.map((p) => p.featureProduction)} />
              <FeatureBoolRow label="Finance (ใบกำกับภาษี)" values={plans.map((p) => p.featureFinance)} />
              <FeatureBoolRow label="Purchase Orders" values={plans.map((p) => p.featurePurchaseOrders)} />
              <FeatureBoolRow label="Maintenance Log" values={plans.map((p) => p.featureMaintenance)} />
              <FeatureBoolRow label="Factory Dashboard TV" values={plans.map((p) => p.featureFactoryDashboard)} />
              <FeatureBoolRow label="Audit Log (ISO)" values={plans.map((p) => p.featureAuditLog)} />
              <FeatureBoolRow label="Excel Export" values={plans.map((p) => p.featureExcelExport)} />
              <FeatureBoolRow label="Advanced Reports" values={plans.map((p) => p.featureAdvancedReports)} />
              <FeatureBoolRow label="Custom Branding" values={plans.map((p) => p.featureCustomBranding)} />
              <FeatureBoolRow label="API Access" values={plans.map((p) => p.featureApiAccess)} />
              <FeatureBoolRow label="Multi-Location" values={plans.map((p) => p.featureMultiLocation)} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FeatureRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-b">
      <td className="py-2 px-4 font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="text-center py-2 px-4 text-muted-foreground">{v}</td>
      ))}
    </tr>
  );
}

function FeatureBoolRow({ label, values }: { label: string; values: boolean[] }) {
  return (
    <tr className="border-b">
      <td className="py-2 px-4 font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="text-center py-2 px-4">
          {v ? (
            <Check className="h-4 w-4 text-green-500 inline" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground/40 inline" />
          )}
        </td>
      ))}
    </tr>
  );
}
