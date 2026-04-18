import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { calculateAmounts, computePeriod } from "@/lib/subscription";
import { OMISE_CONFIGURED, createPromptPaySource } from "@/lib/omise";

const checkoutSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  // MANUAL is intentionally removed — we only support SLIPOK (PromptPay QR + slip)
  // and OMISE (credit card, coming soon)
  paymentGateway: z.enum(["OMISE", "SLIPOK"]).default("SLIPOK"),
});

interface LimitIssue {
  resource: string;
  label: string;
  current: number;
  limit: number;
}

/**
 * Check whether tenant's current resource usage fits within target plan's limits.
 * Returns a list of issues; empty = fits.
 */
async function checkTargetPlanFit(
  tenantId: string,
  target: {
    maxUsers: number;
    maxMachines: number;
    maxCustomers: number;
    maxProducts: number;
  },
): Promise<LimitIssue[]> {
  const [users, machines, customers, products] = await Promise.all([
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.cncMachine.count({ where: { tenantId, isActive: true } }),
    prisma.customer.count({ where: { tenantId, isActive: true } }),
    prisma.product.count({ where: { tenantId, isActive: true } }),
  ]);

  const issues: LimitIssue[] = [];
  if (target.maxUsers > 0 && users > target.maxUsers) {
    issues.push({ resource: "users", label: "ผู้ใช้งาน", current: users, limit: target.maxUsers });
  }
  if (target.maxMachines > 0 && machines > target.maxMachines) {
    issues.push({ resource: "machines", label: "เครื่องจักร", current: machines, limit: target.maxMachines });
  }
  if (target.maxCustomers > 0 && customers > target.maxCustomers) {
    issues.push({ resource: "customers", label: "ลูกค้า", current: customers, limit: target.maxCustomers });
  }
  if (target.maxProducts > 0 && products > target.maxProducts) {
    issues.push({ resource: "products", label: "สินค้า", current: products, limit: target.maxProducts });
  }
  return issues;
}

/**
 * POST /api/billing/checkout
 * Create a PENDING Subscription + initiate payment, OR execute an immediate
 * downgrade-to-FREE without payment.
 *
 * - Omise (card): returns configMissing=true for now (API key pending); when ready
 *   will return QR-less card checkout (scaffolded).
 * - SlipOK (PromptPay + slip): returns instructions → /api/billing/confirm-slip.
 * - Downgrade to FREE (target.priceMonthly === 0 && current price > 0):
 *   validates resource usage against target limits, then immediately activates
 *   the FREE plan without any payment.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { planId, billingCycle, paymentGateway } = parsed.data;

    const [plan, tenant] = await Promise.all([
      prisma.plan.findUnique({ where: { id: planId } }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          planId: true,
          plan: { select: { priceMonthly: true, tier: true } },
        },
      }),
    ]);

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Always validate: current usage must fit target plan limits.
    // (Upgrades pass trivially; downgrades may be blocked.)
    const limitIssues = await checkTargetPlanFit(tenantId, {
      maxUsers: plan.maxUsers,
      maxMachines: plan.maxMachines,
      maxCustomers: plan.maxCustomers,
      maxProducts: plan.maxProducts,
    });
    if (limitIssues.length > 0) {
      const summary = limitIssues
        .map((i) => `${i.label}: ${i.current}/${i.limit}`)
        .join(", ");
      return NextResponse.json(
        {
          error: `ดาวน์เกรดไม่ได้ — เกินโควตาของ Plan เป้าหมาย: ${summary}`,
          code: "PLAN_FIT_EXCEEDED",
          issues: limitIssues,
        },
        { status: 400 },
      );
    }

    const currentPrice = tenant.plan?.priceMonthly ?? 0;
    const isFreeDowngrade = plan.priceMonthly === 0 && currentPrice > 0;

    // ─── Free downgrade path: no payment needed ───
    if (isFreeDowngrade) {
      const { periodStart, periodEnd } = computePeriod(billingCycle);

      const sub = await prisma.$transaction(async (tx) => {
        // Cancel any existing ACTIVE subscriptions for tenant
        await tx.subscription.updateMany({
          where: { tenantId, status: "ACTIVE" },
          data: { status: "CANCELLED" },
        });

        // Create a 0-satang ACTIVE subscription record for the free plan
        const created = await tx.subscription.create({
          data: {
            tenantId,
            planId: plan.id,
            status: "ACTIVE",
            billingCycle,
            periodStart,
            periodEnd,
            amountSatang: 0,
            discountSatang: 0,
            vatSatang: 0,
            totalSatang: 0,
            paymentGateway: "SLIPOK", // nominal value — no actual payment
          },
        });

        // Move tenant to the new free plan
        await tx.tenant.update({
          where: { id: tenantId },
          data: { planId: plan.id, status: "ACTIVE" },
        });

        return created;
      });

      return NextResponse.json({
        subscriptionId: sub.id,
        status: "ACTIVE",
        downgraded: true,
        amountSatang: 0,
        message: "ดาวน์เกรดไป FREE plan สำเร็จ",
      });
    }

    // ─── Paid checkout path ─────────────────────
    const amounts = calculateAmounts({
      priceMonthlySatang: plan.priceMonthly,
      priceYearlySatang: plan.priceYearly,
      billingCycle,
    });
    const { periodStart, periodEnd } = computePeriod(billingCycle);

    // Create pending subscription
    const sub = await prisma.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: "PENDING",
        billingCycle,
        periodStart,
        periodEnd,
        amountSatang: amounts.amountSatang,
        discountSatang: amounts.discountSatang,
        vatSatang: amounts.vatSatang,
        totalSatang: amounts.totalSatang,
        paymentGateway,
      },
    });

    // Gateway-specific initiation
    if (paymentGateway === "OMISE") {
      if (!OMISE_CONFIGURED) {
        return NextResponse.json({
          subscriptionId: sub.id,
          status: "PENDING",
          paymentGateway: "OMISE",
          error: "ระบบบัตรเครดิตยังไม่เปิดให้บริการ — กรุณาเลือก PromptPay QR แทน",
          configMissing: true,
        }, { status: 200 });
      }

      // Note: for credit card we should use Omise.js token flow on the client
      // and POST the token here. Current scaffold: generate a PromptPay source
      // as a placeholder — will be replaced when card flow is wired.
      const source = await createPromptPaySource({
        amountSatang: amounts.totalSatang,
        description: `${plan.name} ${billingCycle} — ${sub.id}`,
      });

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { gatewayRef: source.id },
      });

      return NextResponse.json({
        subscriptionId: sub.id,
        status: "PENDING",
        paymentGateway: "OMISE",
        qrCodeUrl: source.scannable_code?.image?.download_uri ?? null,
        sourceId: source.id,
        amountSatang: amounts.totalSatang,
      });
    }

    // SLIPOK — PromptPay + slip upload
    return NextResponse.json({
      subscriptionId: sub.id,
      status: "PENDING",
      paymentGateway: "SLIPOK",
      instructions: "โอนเงินผ่าน PromptPay ไปยังบัญชีบริษัท แล้วอัพโหลดสลิปเพื่อยืนยัน",
      amountSatang: amounts.totalSatang,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("checkout error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
