import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { createAuditLog } from "@/lib/audit";
import { activateSubscription } from "@/lib/subscription";
import {
  sendPaymentSuccessEmail,
  sendSubscriptionActivatedEmail,
} from "@/lib/billing-emails";

/**
 * POST /api/sa/subscriptions/:id/confirm
 * Super admin manually confirms a bank-transfer payment.
 *
 * Body (optional): { note?: string }
 *
 * Flow: verify the subscription is PENDING → activateSubscription() (flips to
 * ACTIVE, updates tenant plan/status, generates the SaaS tax invoice, fires the
 * activated notification) → stamp who/when confirmed → audit log → notify the
 * tenant admin by email. Only PENDING subscriptions can be confirmed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sa = await requireSaSession();
    const { id } = await params;

    let note = "";
    try {
      const body = await req.json();
      if (body && typeof body.note === "string") note = body.note.trim().slice(0, 500);
    } catch {
      // no body is fine
    }

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: { select: { name: true } },
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            users: {
              where: { role: "ADMIN", isActive: true },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { email: true },
            },
          },
        },
      },
    });

    if (!sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }
    if (sub.status !== "PENDING") {
      return NextResponse.json(
        { error: `ยืนยันได้เฉพาะรายการที่รอชำระ (สถานะปัจจุบัน: ${sub.status})` },
        { status: 400 }
      );
    }

    // Activate (preserves existing slipUrl — undefined fields are ignored by Prisma).
    await activateSubscription({
      subscriptionId: sub.id,
      slipVerifiedAt: new Date(),
    });

    // Stamp manual-confirmation metadata.
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        paymentGateway: "MANUAL",
        confirmedBySaId: sa.sub,
        confirmedAt: new Date(),
        ...(note ? { manualNote: note } : {}),
      },
    });

    await createAuditLog({
      action: "STATUS_CHANGE",
      entityType: "Subscription",
      entityId: sub.id,
      changes: { status: { from: "PENDING", to: "ACTIVE" } },
      reason: `Manual bank-transfer confirmed by Super Admin (${sa.username})${note ? ` — ${note}` : ""}`,
      userId: sa.sub,
      userName: `SA: ${sa.name}`,
      tenantId: sub.tenant.id,
    });

    // Fire-and-forget tenant emails (never throw).
    const adminEmail = sub.tenant.users[0]?.email;
    if (adminEmail) {
      void sendPaymentSuccessEmail({
        to: adminEmail,
        tenantName: sub.tenant.name,
        planName: sub.plan.name,
        billingCycle: sub.billingCycle,
        totalSatang: sub.totalSatang,
        subscriptionInvoiceId: null,
      });
      void sendSubscriptionActivatedEmail({
        to: adminEmail,
        tenantName: sub.tenant.name,
        planName: sub.plan.name,
        periodStart: sub.periodStart,
        periodEnd: sub.periodEnd,
      });
    }

    return NextResponse.json({ success: true, status: "ACTIVE" });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA confirm subscription error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
