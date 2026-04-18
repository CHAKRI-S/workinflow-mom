import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tenant/me — current tenant + plan summary
 * Used by client components (sidebar, gating) to know feature flags & limits
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      include: { plan: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const now = new Date();
    const trialDaysLeft =
      tenant.status === "TRIAL" && tenant.trialEndsAt
        ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / 86400000))
        : null;

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        trialDaysLeft,
        onboardedAt: tenant.onboardedAt?.toISOString() ?? null,
      },
      plan: tenant.plan
        ? {
            id: tenant.plan.id,
            slug: tenant.plan.slug,
            tier: tenant.plan.tier,
            name: tenant.plan.name,
            features: {
              production: tenant.plan.featureProduction,
              finance: tenant.plan.featureFinance,
              maintenance: tenant.plan.featureMaintenance,
              factoryDashboard: tenant.plan.featureFactoryDashboard,
              auditLog: tenant.plan.featureAuditLog,
              purchaseOrders: tenant.plan.featurePurchaseOrders,
              advancedReports: tenant.plan.featureAdvancedReports,
              excelExport: tenant.plan.featureExcelExport,
              customBranding: tenant.plan.featureCustomBranding,
              apiAccess: tenant.plan.featureApiAccess,
              multiLocation: tenant.plan.featureMultiLocation,
            },
            limits: {
              maxUsers: tenant.plan.maxUsers,
              maxMachines: tenant.plan.maxMachines,
              maxCustomers: tenant.plan.maxCustomers,
              maxProducts: tenant.plan.maxProducts,
              maxWorkOrdersPerMonth: tenant.plan.maxWorkOrdersPerMonth,
            },
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/tenant/me error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
