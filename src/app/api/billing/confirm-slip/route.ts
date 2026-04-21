import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { verifySlipByFile, SLIPOK_CONFIGURED } from "@/lib/slipok";
import { activateSubscription } from "@/lib/subscription";
import {
  buildSlipKey,
  isS3Configured,
  putObject,
} from "@/lib/s3";
import {
  sendPaymentSuccessEmail,
  sendSubscriptionActivatedEmail,
} from "@/lib/billing-emails";

/**
 * POST /api/billing/confirm-slip
 * Multipart form: subscriptionId + file (slip image)
 *
 * Flow:
 * 1. Validate the PENDING subscription belongs to the current tenant
 * 2. Upload slip image → SlipOK verify (amount + duplicate detection)
 * 3. If SlipOK confirms amount ≥ totalSatang/100 → upload slip to R2 →
 *    activate subscription → fire-and-forget billing emails
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
      include: {
        plan: true,
        tenant: {
          include: {
            users: {
              where: { role: "ADMIN", isActive: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
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

    // Upload slip to R2 as audit-trail evidence (best-effort; never fails the flow).
    // We store the R2 object key (bucket is private — caller uses a signed URL later).
    let slipUrl: string | null = null;
    try {
      if (isS3Configured()) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const key = buildSlipKey({
          tenantId,
          subscriptionId: sub.id,
          originalFilename: file.name,
          contentType: file.type,
        });
        await putObject({
          key,
          body: buffer,
          contentType: file.type || "application/octet-stream",
        });
        slipUrl = key;
      } else {
        console.warn(
          "[confirm-slip] R2 not configured — activating without slipUrl",
        );
      }
    } catch (uploadErr) {
      console.error(
        "[confirm-slip] R2 upload failed — activating without slipUrl:",
        uploadErr,
      );
    }

    await activateSubscription({
      subscriptionId: sub.id,
      gatewayRef: result.data.transRef,
      slipVerifiedAt: new Date(),
      ...(slipUrl ? { slipUrl } : {}),
    });

    // Fire-and-forget billing notifications (never throw)
    const admin = sub.tenant.users[0];
    if (admin?.email) {
      void sendPaymentSuccessEmail({
        to: admin.email,
        tenantName: sub.tenant.name,
        planName: sub.plan.name,
        billingCycle: sub.billingCycle,
        totalSatang: sub.totalSatang,
        subscriptionInvoiceId: null,
      });
      void sendSubscriptionActivatedEmail({
        to: admin.email,
        tenantName: sub.tenant.name,
        planName: sub.plan.name,
        periodStart: sub.periodStart,
        periodEnd: sub.periodEnd,
      });
    } else {
      console.warn(
        "[confirm-slip] no active admin user on tenant — skipping emails",
        { tenantId },
      );
    }

    return NextResponse.json({
      success: true,
      subscriptionId: sub.id,
      transRef: result.data.transRef,
      amount: paidBaht,
      slipStored: Boolean(slipUrl),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("confirm-slip error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
