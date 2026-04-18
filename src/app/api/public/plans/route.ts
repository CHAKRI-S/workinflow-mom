import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/public/plans — fetch public plans for landing / pricing page
// Cached via Next.js revalidation (60s)
export const revalidate = 60;

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        tier: true,
        slug: true,
        name: true,
        description: true,
        priceMonthly: true,
        priceYearly: true,
        yearlyDiscountPercent: true,
        maxUsers: true,
        maxMachines: true,
        maxCustomers: true,
        maxProducts: true,
        maxWorkOrdersPerMonth: true,
        featureProduction: true,
        featureFinance: true,
        featureMaintenance: true,
        featureFactoryDashboard: true,
        featureAuditLog: true,
        featurePurchaseOrders: true,
        featureAdvancedReports: true,
        featureExcelExport: true,
        featureCustomBranding: true,
        featureApiAccess: true,
        featureMultiLocation: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ plans });
  } catch (err) {
    console.error("GET /api/public/plans error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
