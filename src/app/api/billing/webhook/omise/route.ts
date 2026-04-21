import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, getCharge } from "@/lib/omise";
import { activateSubscription } from "@/lib/subscription";
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionActivatedEmail,
} from "@/lib/billing-emails";

/**
 * POST /api/billing/webhook/omise
 * Omise sends events like "charge.complete", "charge.create", etc.
 *
 * Handled events:
 * - charge.complete / charge.create (when status=successful) →
 *     activate subscription + email (success + welcome)
 * - charge.complete (status=failed)                         →
 *     email "payment failed" (subscription stays PENDING so user can retry)
 * - charge.expire                                           →
 *     no-op (no email)
 */
export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-omise-webhook-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    key?: string;
    data?: {
      id?: string;
      status?: string;
      paid?: boolean;
      failure_message?: string;
      failure_code?: string;
      metadata?: Record<string, string>;
      source?: { id?: string };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[omise-webhook]", event.key, event.data?.id, event.data?.status);

  try {
    // ─────────────────────────────────────────────
    // charge.expire — keep PENDING, no email
    // ─────────────────────────────────────────────
    if (event.key === "charge.expire") {
      return NextResponse.json({ ok: true, note: "charge expired" });
    }

    // ─────────────────────────────────────────────
    // charge.complete / charge.create — inspect status
    // ─────────────────────────────────────────────
    if (
      (event.key === "charge.complete" || event.key === "charge.create") &&
      event.data?.id
    ) {
      const charge = await getCharge(event.data.id);
      const status = (charge.status ??
        (charge.paid ? "successful" : event.data.status)) as string | undefined;

      // Resolve subscription via source id → gatewayRef
      const sourceId =
        (charge.source as { id?: string } | null)?.id ?? event.data.source?.id;
      if (!sourceId) {
        return NextResponse.json({ ok: true, note: "no source id" });
      }

      const sub = await prisma.subscription.findFirst({
        where: { gatewayRef: sourceId },
        include: {
          tenant: {
            include: {
              users: {
                where: { role: "ADMIN", isActive: true },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
          plan: true,
        },
      });
      if (!sub) {
        return NextResponse.json({ ok: true, note: "subscription not found" });
      }

      const admin = sub.tenant.users[0];

      // ─── Successful payment ───────────────────────
      if (status === "successful" && charge.paid && sub.status === "PENDING") {
        await activateSubscription({
          subscriptionId: sub.id,
          omiseChargeId: charge.id,
        });

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
            "[omise-webhook] no active admin user on tenant — skipping emails",
            { tenantId: sub.tenantId },
          );
        }

        return NextResponse.json({ ok: true, activated: sub.id });
      }

      // ─── Failed payment ───────────────────────────
      if (status === "failed") {
        const reason =
          (charge as { failure_message?: string }).failure_message ||
          event.data.failure_message ||
          (charge as { failure_code?: string }).failure_code ||
          event.data.failure_code ||
          "ธนาคารปฏิเสธรายการ กรุณาลองอีกครั้ง";

        if (admin?.email) {
          void sendPaymentFailedEmail({
            to: admin.email,
            tenantName: sub.tenant.name,
            planName: sub.plan.name,
            reason,
          });
        } else {
          console.warn(
            "[omise-webhook] no active admin user on tenant — skipping failure email",
            { tenantId: sub.tenantId },
          );
        }

        return NextResponse.json({ ok: true, failed: sub.id });
      }

      // ─── Expired payment via charge.complete ──────
      if (status === "expired") {
        return NextResponse.json({ ok: true, note: "charge expired" });
      }

      return NextResponse.json({ ok: true, note: `ignored status=${status}` });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("omise webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
