import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.ALL)) return <AccessDenied />;

  const tenantId = session.user.tenantId;
  const now = new Date();

  // First-time admin → redirect to onboarding
  if (session.user.role === "ADMIN") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardedAt: true },
    });
    if (tenant && !tenant.onboardedAt) {
      redirect(`/${locale}/onboarding`);
    }
  }

  const [
    openQuotations,
    activeOrders,
    woInProgress,
    overdueWOs,
    awaitingPayment,
    woTotal,
    woCompleted,
    recentOrders,
  ] = await Promise.all([
    prisma.quotation.count({
      where: { tenantId, status: { in: ["DRAFT", "SENT", "REVISED"] } },
    }),
    prisma.salesOrder.count({
      where: { tenantId, status: { in: ["CONFIRMED", "DEPOSIT_PENDING", "IN_PRODUCTION", "PAINTING", "ENGRAVING", "QC_FINAL", "PACKING"] } },
    }),
    prisma.workOrder.count({
      where: { tenantId, status: "IN_PROGRESS" },
    }),
    prisma.workOrder.count({
      where: { tenantId, status: { notIn: ["COMPLETED", "CANCELLED"] }, plannedEnd: { lt: now } },
    }),
    prisma.salesOrder.count({
      where: { tenantId, status: "AWAITING_PAYMENT" },
    }),
    prisma.workOrder.count({
      where: { tenantId, status: { not: "CANCELLED" } },
    }),
    prisma.workOrder.count({
      where: { tenantId, status: "COMPLETED" },
    }),
    prisma.salesOrder.findMany({
      where: { tenantId, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const completionRate = woTotal > 0 ? Math.round((woCompleted / woTotal) * 100) : 0;

  return (
    <DashboardClient
      kpi={{
        openQuotations,
        activeOrders,
        woInProgress,
        overdueWOs,
        awaitingPayment,
        completionRate,
      }}
      recentOrders={JSON.parse(JSON.stringify(recentOrders))}
    />
  );
}
