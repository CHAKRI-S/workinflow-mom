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
  paymentGateway: z.enum(["OMISE", "SLIPOK", "MANUAL"]).default("OMISE"),
});

/**
 * POST /api/billing/checkout
 * Create a PENDING Subscription + initiate payment.
 *
 * For Omise PromptPay: returns QR code URL — tenant scans → webhook confirms
 * For SlipOK: returns instructions to upload slip → /api/billing/confirm-slip
 * For MANUAL: returns pending — SA activates manually
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

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

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
          error: "Omise ยังไม่ได้ตั้งค่า — กรุณาติดต่อผู้ดูแล",
          configMissing: true,
        }, { status: 200 });
      }

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

    if (paymentGateway === "SLIPOK") {
      // Return payment instructions; tenant uploads slip to /api/billing/confirm-slip
      return NextResponse.json({
        subscriptionId: sub.id,
        status: "PENDING",
        paymentGateway: "SLIPOK",
        instructions: "โอนเงินไปยังบัญชีบริษัท แล้วอัพโหลดสลิปเพื่อยืนยัน",
        amountSatang: amounts.totalSatang,
      });
    }

    // MANUAL
    return NextResponse.json({
      subscriptionId: sub.id,
      status: "PENDING",
      paymentGateway: "MANUAL",
      message: "รอการยืนยันจากผู้ดูแลระบบ",
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
