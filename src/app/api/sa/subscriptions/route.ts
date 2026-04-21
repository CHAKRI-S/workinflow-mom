import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import type { Prisma } from "@/generated/prisma/client";
import {
  SubscriptionStatus,
  BillingCycle,
  PaymentGateway,
} from "@/generated/prisma/enums";

const querySchema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "CANCELLED", "TRIAL", "EXPIRED", "SUSPENDED", "ALL"]).optional(),
  plan: z.string().optional(),
  gateway: z.enum(["OMISE", "SLIPOK", "MANUAL", "ALL"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
});

// GET /api/sa/subscriptions
// Returns paginated subscriptions + totals (MRR, ARR, counts)
export async function GET(req: NextRequest) {
  try {
    await requireSaSession();

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      plan: searchParams.get("plan") ?? undefined,
      gateway: searchParams.get("gateway") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 },
      );
    }

    const { status, plan, gateway, page, pageSize, search } = parsed.data;

    // Build where clause
    const where: Prisma.SubscriptionWhereInput = {};

    if (status && status !== "ALL") {
      where.status = status as Prisma.EnumSubscriptionStatusFilter["equals"];
    }
    if (plan) {
      where.planId = plan;
    }
    if (gateway && gateway !== "ALL") {
      where.paymentGateway = gateway as Prisma.EnumPaymentGatewayNullableFilter["equals"];
    }

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      where.OR = [
        { tenant: { name: { contains: trimmedSearch, mode: "insensitive" } } },
        { tenant: { slug: { contains: trimmedSearch, mode: "insensitive" } } },
        { gatewayRef: { contains: trimmedSearch, mode: "insensitive" } },
        { omiseChargeId: { contains: trimmedSearch, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [items, total, activeSubs, pendingCount, failedThisMonthCount] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          tenant: { select: { id: true, name: true, slug: true, code: true, status: true } },
          plan: { select: { id: true, name: true, tier: true } },
        },
      }),
      prisma.subscription.count({ where }),
      // MRR: all ACTIVE subscriptions, regardless of current filters
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
    ]);

    // Compute MRR (satang). YEARLY / 12 rounds down — acceptable for satang.
    let mrrSatang = 0;
    for (const s of activeSubs) {
      if (s.billingCycle === BillingCycle.MONTHLY) {
        mrrSatang += s.totalSatang;
      } else if (s.billingCycle === BillingCycle.YEARLY) {
        mrrSatang += Math.floor(s.totalSatang / 12);
      }
    }
    const arrSatang = mrrSatang * 12;

    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        status: s.status,
        billingCycle: s.billingCycle,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        amountSatang: s.amountSatang,
        discountSatang: s.discountSatang,
        vatSatang: s.vatSatang,
        totalSatang: s.totalSatang,
        paymentGateway: s.paymentGateway,
        gatewayRef: s.gatewayRef,
        omiseChargeId: s.omiseChargeId,
        cancelledAt: s.cancelledAt,
        tenant: s.tenant,
        plan: s.plan,
      })),
      total,
      page,
      pageSize,
      totals: {
        mrr: mrrSatang,
        arr: arrSatang,
        activeCount: activeSubs.length,
        pendingCount,
        failedThisMonth: failedThisMonthCount,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA subscriptions list error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function firstOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Ensure PaymentGateway symbol is considered used (kept for future filters/enum safety)
void PaymentGateway;
