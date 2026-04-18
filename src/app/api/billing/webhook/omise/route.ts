import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, getCharge } from "@/lib/omise";
import { activateSubscription } from "@/lib/subscription";
import { sendPaymentSuccessEmail } from "@/lib/email";

/**
 * POST /api/billing/webhook/omise
 * Omise sends events like "charge.complete", "charge.create", etc.
 *
 * Key events we handle:
 * - charge.complete — payment succeeded → activate subscription
 * - charge.expire — QR expired → keep PENDING (user can retry)
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
    data?: { id?: string; status?: string; paid?: boolean; metadata?: Record<string, string>; source?: { id?: string } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[omise-webhook]", event.key, event.data?.id);

  try {
    if (event.key === "charge.complete" && event.data?.id && event.data.paid) {
      const charge = await getCharge(event.data.id);
      if (!charge.paid) {
        return NextResponse.json({ ok: true, note: "charge not paid" });
      }

      // Find subscription by source ID (gatewayRef was set during checkout)
      const sourceId = (charge.source as { id?: string } | null)?.id ?? event.data.source?.id;
      if (!sourceId) {
        return NextResponse.json({ ok: true, note: "no source id" });
      }

      const sub = await prisma.subscription.findFirst({
        where: { gatewayRef: sourceId, status: "PENDING" },
        include: { tenant: { include: { users: { where: { role: "ADMIN" }, take: 1 } } }, plan: true },
      });
      if (!sub) {
        return NextResponse.json({ ok: true, note: "subscription not found" });
      }

      await activateSubscription({
        subscriptionId: sub.id,
        omiseChargeId: charge.id,
      });

      // Send confirmation email
      const admin = sub.tenant.users[0];
      if (admin?.email) {
        sendPaymentSuccessEmail(admin.email, {
          name: admin.name,
          planName: sub.plan.name,
          amount: sub.totalSatang,
          billingCycle: sub.billingCycle,
          periodEnd: sub.periodEnd,
        }).catch((e) => console.error("payment email error:", e));
      }

      return NextResponse.json({ ok: true, activated: sub.id });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("omise webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
