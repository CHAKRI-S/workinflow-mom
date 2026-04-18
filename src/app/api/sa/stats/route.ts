import { NextResponse } from "next/server";
import { requireSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns the last 6 month keys (ascending), e.g. ["2025-11", ..., "2026-04"] */
function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(toMonthKey(d));
  }
  return months;
}

// ---------------------------------------------------------------------------
// Response shape types
// ---------------------------------------------------------------------------

interface MonthlySignup {
  month: string;
  count: number;
}

interface PlanDistributionItem {
  tier: string;
  name: string;
  count: number;
}

interface StatusBreakdownItem {
  status: string;
  count: number;
}

interface TopPlanItem {
  id: string;
  name: string;
  tier: string;
  activeCount: number;
}

interface StatsResponse {
  monthlySignups: MonthlySignup[];
  planDistribution: PlanDistributionItem[];
  statusBreakdown: StatusBreakdownItem[];
  topPlans: TopPlanItem[];
}

// ---------------------------------------------------------------------------
// GET /api/sa/stats
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    await requireSaSession();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Run all queries in parallel for efficiency
    const [
      recentTenants,
      planGroupRaw,
      allPlans,
      statusGroupRaw,
      activeTenantsByPlan,
    ] = await Promise.all([
      // 1. Tenants created in the last 6 months (only need id + createdAt)
      prisma.tenant.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { id: true, createdAt: true },
      }),

      // 2. Tenant count grouped by planId
      prisma.tenant.groupBy({
        by: ["planId"],
        _count: { id: true },
      }),

      // 3. All plans (to join names/tiers)
      prisma.plan.findMany({
        select: { id: true, name: true, tier: true },
      }),

      // 4. Tenant count grouped by status
      prisma.tenant.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // 5. Active tenants with a plan — grouped by planId
      prisma.tenant.groupBy({
        by: ["planId"],
        where: { status: "ACTIVE", planId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    // ── monthlySignups ────────────────────────────────────────────────────
    const last6 = getLast6Months();
    const countsByMonth = new Map<string, number>();
    for (const key of last6) countsByMonth.set(key, 0);

    for (const tenant of recentTenants) {
      const key = toMonthKey(tenant.createdAt);
      if (countsByMonth.has(key)) {
        countsByMonth.set(key, (countsByMonth.get(key) ?? 0) + 1);
      }
    }

    const monthlySignups: MonthlySignup[] = last6.map((month) => ({
      month,
      count: countsByMonth.get(month) ?? 0,
    }));

    // ── planDistribution ─────────────────────────────────────────────────
    const planMap = new Map(allPlans.map((p) => [p.id, p]));

    const planDistribution: PlanDistributionItem[] = planGroupRaw.map((row) => {
      const plan = row.planId ? planMap.get(row.planId) : undefined;
      return {
        tier: plan?.tier ?? "None",
        name: plan?.name ?? "No Plan",
        count: row._count.id,
      };
    });

    // ── statusBreakdown ───────────────────────────────────────────────────
    const statusBreakdown: StatusBreakdownItem[] = statusGroupRaw.map((row) => ({
      status: row.status,
      count: row._count.id,
    }));

    // ── topPlans ──────────────────────────────────────────────────────────
    const topPlans: TopPlanItem[] = activeTenantsByPlan
      .filter((row): row is typeof row & { planId: string } => row.planId !== null)
      .map((row) => {
        const plan = planMap.get(row.planId);
        return {
          id: row.planId,
          name: plan?.name ?? "Unknown",
          tier: plan?.tier ?? "Unknown",
          activeCount: row._count.id,
        };
      });

    const response: StatsResponse = {
      monthlySignups,
      planDistribution,
      statusBreakdown,
      topPlans,
    };

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
