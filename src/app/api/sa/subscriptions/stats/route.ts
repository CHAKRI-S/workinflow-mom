import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { SubscriptionStatus } from "@/generated/prisma/enums";

// GET /api/sa/subscriptions/stats
// Last-12-months revenue, by-plan breakdown, by-gateway breakdown.
// Only ACTIVE subscriptions are counted as realised revenue.
export async function GET() {
  try {
    await requireSaSession();

    const since = startOfMonthNMonthsAgo(11); // include current month + 11 prior = 12 months

    // ── Monthly revenue (raw SQL for date_trunc month bucketing) ──────
    type MonthRow = { ym: string; total_satang: bigint | number; count: bigint | number };
    const monthlyRows = await prisma.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT
        to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS ym,
        COALESCE(SUM("totalSatang"), 0)::bigint AS total_satang,
        COUNT(*)::bigint AS count
      FROM "Subscription"
      WHERE "status" = ${SubscriptionStatus.ACTIVE}
        AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const monthlyRevenue = monthlyRows.map((r) => ({
      ym: r.ym,
      totalSatang: typeof r.total_satang === "bigint" ? Number(r.total_satang) : r.total_satang,
      count: typeof r.count === "bigint" ? Number(r.count) : r.count,
    }));

    // ── By plan ──────────────────────────────────────────────────────
    const byPlanGroup = await prisma.subscription.groupBy({
      by: ["planId"],
      where: { status: SubscriptionStatus.ACTIVE },
      _sum: { totalSatang: true },
      _count: { _all: true },
    });
    const planIds = byPlanGroup.map((g) => g.planId);
    const plans = planIds.length
      ? await prisma.plan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true, tier: true },
        })
      : [];
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const byPlan = byPlanGroup
      .map((g) => ({
        planId: g.planId,
        planName: planMap.get(g.planId)?.name ?? "—",
        planTier: planMap.get(g.planId)?.tier ?? null,
        count: g._count._all,
        revenue: g._sum.totalSatang ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── By gateway ───────────────────────────────────────────────────
    const byGatewayGroup = await prisma.subscription.groupBy({
      by: ["paymentGateway"],
      where: { status: SubscriptionStatus.ACTIVE },
      _sum: { totalSatang: true },
      _count: { _all: true },
    });
    const byGateway = byGatewayGroup
      .map((g) => ({
        gateway: g.paymentGateway,
        count: g._count._all,
        revenue: g._sum.totalSatang ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({ monthlyRevenue, byPlan, byGateway });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA subscriptions stats error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function startOfMonthNMonthsAgo(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  return d;
}
