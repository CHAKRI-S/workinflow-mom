import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { UpgradeClient } from "./upgrade-client";

export default async function UpgradePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.ADMIN_ONLY)) return <AccessDenied />;

  const tenantId = session.user.tenantId;

  const [tenant, plans] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, planId: true, plan: { select: { name: true } } },
    }),
    prisma.plan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        tier: true,
        name: true,
        description: true,
        priceMonthly: true,
        priceYearly: true,
        yearlyDiscountPercent: true,
        maxUsers: true,
        maxMachines: true,
        maxCustomers: true,
      },
    }),
  ]);

  if (!tenant) redirect(`/${locale}/login`);

  return (
    <UpgradeClient
      plans={plans}
      currentPlanId={tenant.planId}
      currentPlanName={tenant.plan?.name ?? null}
    />
  );
}
