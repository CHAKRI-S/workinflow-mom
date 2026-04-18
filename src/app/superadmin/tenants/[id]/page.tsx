import { redirect, notFound } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { TenantDetailClient } from "./tenant-detail-client";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSaSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [tenant, allPlans] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        _count: {
          select: {
            users: true,
            customers: true,
            products: true,
            cncMachines: true,
            workOrders: true,
            invoices: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { plan: { select: { name: true } } },
        },
      },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, tier: true },
    }),
  ]);

  if (!tenant) notFound();

  return (
    <SaShell saName={session.name}>
      <TenantDetailClient
        tenant={{
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          code: tenant.code,
          email: tenant.email,
          phone: tenant.phone,
          taxId: tenant.taxId,
          status: tenant.status,
          trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
          onboardedAt: tenant.onboardedAt?.toISOString() ?? null,
          lastActiveAt: tenant.lastActiveAt?.toISOString() ?? null,
          createdAt: tenant.createdAt.toISOString(),
          planId: tenant.planId,
          planName: tenant.plan?.name ?? null,
          counts: tenant._count,
          subscriptions: tenant.subscriptions.map((s) => ({
            id: s.id,
            planName: s.plan?.name ?? "",
            status: s.status,
            billingCycle: s.billingCycle,
            periodStart: s.periodStart.toISOString(),
            periodEnd: s.periodEnd.toISOString(),
            totalSatang: s.totalSatang,
            paymentGateway: s.paymentGateway,
          })),
        }}
        allPlans={allPlans}
      />
    </SaShell>
  );
}
