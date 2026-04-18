import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { verifySlipByFile, SLIPOK_CONFIGURED } from "@/lib/slipok";
import { activateSubscription } from "@/lib/subscription";
import { sendPaymentSuccessEmail } from "@/lib/email";

/**
 * POST /api/billing/confirm-slip
 * Multipart form: subscriptionId + file (slip image)
 *
 * Flow:
 * 1. Validate the PENDING subscription belongs to the current tenant
 * 2. Upload slip image → SlipOK verify
 * 3. If SlipOK confirms amount ≥ totalSatang/100 → activate
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    if (!SLIPOK_CONFIGURED) {
      return NextResponse.json(
        { error: "SlipOK ยังไม่ได้ตั้งค่า — ติดต่อผู้ดูแล" },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const subscriptionId = formData.get("subscriptionId") as string | null;
    const file = formData.get("file") as File | null;

    if (!subscriptionId || !file) {
      return NextResponse.json(
        { error: "subscriptionId และ file จำเป็น" },
        { status: 400 },
      );
    }

    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, tenantId, status: "PENDING" },
      include: { plan: true, tenant: { include: { users: { where: { role: "ADMIN" }, take: 1 } } } },
    });
    if (!sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Verify via SlipOK
    const result = await verifySlipByFile(file);
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "ไม่สามารถตรวจสอบสลิปได้" },
        { status: 400 },
      );
    }

    // Check amount match (SlipOK returns baht, sub.totalSatang is satang)
    const paidBaht = result.data.amount;
    const requiredBaht = sub.totalSatang / 100;
    if (paidBaht < requiredBaht) {
      return NextResponse.json(
        { error: `ยอดในสลิป (฿${paidBaht.toLocaleString()}) น้อยกว่ายอดที่ต้องชำระ (฿${requiredBaht.toLocaleString()})` },
        { status: 400 },
      );
    }

    // Save slip + activate
    // NOTE: In production, upload file to S3/Cloudflare R2 and save URL here
    // For now, use placeholder URL; actual upload via /api/upload is an enhancement
    const slipUrl = `slip-${result.data.transRef}`;

    await activateSubscription({
      subscriptionId: sub.id,
      gatewayRef: result.data.transRef,
      slipVerifiedAt: new Date(),
      slipUrl,
    });

    // Email
    const admin = sub.tenant.users[0];
    if (admin?.email) {
      sendPaymentSuccessEmail(admin.email, {
        name: admin.name,
        planName: sub.plan.name,
        amount: sub.totalSatang,
        billingCycle: sub.billingCycle,
        periodEnd: sub.periodEnd,
      }).catch((e) => console.error("email error:", e));
    }

    return NextResponse.json({
      success: true,
      subscriptionId: sub.id,
      transRef: result.data.transRef,
      amount: paidBaht,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("confirm-slip error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
