import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { PlansClient } from "./plans-client";

export default async function PlansPage() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { tenants: true } } },
  });

  return (
    <SaShell saName={session.name}>
      <PlansClient
        initialPlans={plans.map((p) => ({
          id: p.id,
          tier: p.tier,
          slug: p.slug,
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          yearlyDiscountPercent: p.yearlyDiscountPercent,
          maxUsers: p.maxUsers,
          maxMachines: p.maxMachines,
          maxCustomers: p.maxCustomers,
          maxProducts: p.maxProducts,
          maxWorkOrdersPerMonth: p.maxWorkOrdersPerMonth,
          featureProduction: p.featureProduction,
          featureFinance: p.featureFinance,
          featureMaintenance: p.featureMaintenance,
          featureFactoryDashboard: p.featureFactoryDashboard,
          featureAuditLog: p.featureAuditLog,
          featurePurchaseOrders: p.featurePurchaseOrders,
          featureAdvancedReports: p.featureAdvancedReports,
          featureExcelExport: p.featureExcelExport,
          featureCustomBranding: p.featureCustomBranding,
          featureApiAccess: p.featureApiAccess,
          featureMultiLocation: p.featureMultiLocation,
          sortOrder: p.sortOrder,
          isPublic: p.isPublic,
          isActive: p.isActive,
          tenantCount: p._count.tenants,
        }))}
      />
    </SaShell>
  );
}
