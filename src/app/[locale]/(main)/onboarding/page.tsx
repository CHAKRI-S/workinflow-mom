import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage({
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

  const [tenant, counts] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        logo: true,
        onboardedAt: true,
        trialEndsAt: true,
        status: true,
        plan: { select: { name: true, tier: true } },
      },
    }),
    Promise.all([
      prisma.cncMachine.count({ where: { tenantId } }),
      prisma.customer.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.user.count({ where: { tenantId, isActive: true } }),
    ]).then(([machines, customers, products, users]) => ({
      machines,
      customers,
      products,
      users,
    })),
  ]);

  if (!tenant) redirect(`/${locale}/login`);

  return (
    <OnboardingClient
      locale={locale}
      tenantName={tenant.name}
      hasLogo={!!tenant.logo}
      onboardedAt={tenant.onboardedAt?.toISOString() ?? null}
      trialEndsAt={tenant.trialEndsAt?.toISOString() ?? null}
      status={tenant.status}
      planName={tenant.plan?.name ?? "FREE"}
      counts={counts}
    />
  );
}
