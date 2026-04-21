import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { SubscriptionStatus, BillingCycle } from "@/generated/prisma/enums";
import { SubscriptionsClient } from "./subscriptions-client";

const DEFAULT_PAGE_SIZE = 20;

export default async function SubscriptionsPage() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  // Initial (unfiltered) fetch — client can refine via filters.
  const [items, total, activeSubs, pendingCount, failedThisMonth, plans] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      take: DEFAULT_PAGE_SIZE,
      include: {
        tenant: { select: { id: true, name: true, slug: true, code: true, status: true } },
        plan: { select: { id: true, name: true, tier: true } },
      },
    }),
    prisma.subscription.count(),
    prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      select: { totalSatang: true, billingCycle: true },
    }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.PENDING } }),
    prisma.subscription.count({
      where: {
        status: { in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.SUSPENDED] },
        updatedAt: { gte: firstOfCurrentMonth() },
      },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, tier: true },
    }),
  ]);

  let mrr = 0;
  for (const s of activeSubs) {
    if (s.billingCycle === BillingCycle.MONTHLY) mrr += s.totalSatang;
    else if (s.billingCycle === BillingCycle.YEARLY) mrr += Math.floor(s.totalSatang / 12);
  }

  return (
    <SaShell saName={session.name}>
      <SubscriptionsClient
        initialItems={items.map((s) => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          status: s.status,
          billingCycle: s.billingCycle,
          periodStart: s.periodStart.toISOString(),
          periodEnd: s.periodEnd.toISOString(),
          totalSatang: s.totalSatang,
          paymentGateway: s.paymentGateway,
          tenant: s.tenant,
          plan: s.plan,
        }))}
        initialTotal={total}
        initialTotals={{
          mrr,
          arr: mrr * 12,
          activeCount: activeSubs.length,
          pendingCount,
          failedThisMonth,
        }}
        pageSize={DEFAULT_PAGE_SIZE}
        plans={plans}
      />
    </SaShell>
  );
}

function firstOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
