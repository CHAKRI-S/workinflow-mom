import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import {
  buildSlipKey,
  isS3Configured,
  putObject,
  isAllowedMime,
  MAX_WHT_CERT_BYTES,
} from "@/lib/s3";
import { notifyManualTransferSubmitted } from "@/lib/notify";

/**
 * POST /api/billing/submit-transfer
 * Multipart form: subscriptionId + file (bank-transfer slip image)
 *
 * The MANUAL (bank transfer) counterpart to /api/billing/confirm-slip. Unlike
 * the SlipOK path, this does NOT auto-verify or activate — it records the
 * uploaded proof + timestamp and leaves the subscription PENDING for a super
 * admin to review and confirm in the back office.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    const formData = await req.formData();
    const subscriptionId = formData.get("subscriptionId") as string | null;
    const file = formData.get("file") as File | null;

    if (!subscriptionId || !file) {
      return NextResponse.json(
        { error: "subscriptionId และ file จำเป็น" },
        { status: 400 }
      );
    }

    if (!isAllowedMime(file.type)) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์ PDF, JPG, PNG" },
        { status: 400 }
      );
    }
    if (file.size > MAX_WHT_CERT_BYTES) {
      return NextResponse.json(
        { error: "ไฟล์ใหญ่เกิน 5MB" },
        { status: 400 }
      );
    }

    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, tenantId, status: "PENDING" },
      include: { plan: true, tenant: { select: { name: true } } },
    });
    if (!sub) {
      return NextResponse.json(
        { error: "ไม่พบรายการที่รอชำระเงิน" },
        { status: 404 }
      );
    }

    // Upload proof to R2 (best-effort). Store the object key — bucket is private,
    // the SA views it later via a signed URL.
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
          "[submit-transfer] R2 not configured — recording submission without slipUrl"
        );
      }
    } catch (uploadErr) {
      console.error(
        "[submit-transfer] R2 upload failed — recording submission without slipUrl:",
        uploadErr
      );
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        paymentGateway: "MANUAL",
        slipSubmittedAt: new Date(),
        ...(slipUrl ? { slipUrl } : {}),
      },
    });

    // Fire-and-forget: alert the platform admins that a transfer awaits review.
    notifyManualTransferSubmitted({
      tenantName: sub.tenant.name,
      planName: sub.plan.name,
      billingCycle: sub.billingCycle,
      totalSatang: sub.totalSatang,
    });

    return NextResponse.json({
      success: true,
      subscriptionId: sub.id,
      status: "PENDING",
      slipStored: Boolean(slipUrl),
      message: "ส่งหลักฐานการโอนแล้ว — รอผู้ดูแลระบบยืนยัน",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("submit-transfer error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
