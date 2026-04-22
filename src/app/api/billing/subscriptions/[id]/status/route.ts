import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activateSubscription } from "@/lib/subscription";
import { OMISE_CONFIGURED, getChargeById } from "@/lib/omise";

type Params = { params: Promise<{ id: string }> };

type PollStatus = "PENDING" | "ACTIVE" | "FAILED" | "CANCELLED" | "EXPIRED";

type OmiseChargeLike = {
  status?: string;
  paid?: boolean;
  failure_message?: string;
  failure_code?: string;
};

/**
 * GET /api/billing/subscriptions/[id]/status
 *
 * Used by the 3DS return page to poll for activation. If the subscription is
 * still PENDING and we have an omiseChargeId, we query Omise live — this makes
 * the UX resilient to webhook delays (common in production).
 *
 * Response: { status: "PENDING" | "ACTIVE" | "FAILED" | "CANCELLED" | "EXPIRED",
 *             failureReason?: string }
 *
 * Auth: tenant-scoped. A tenant can only poll subscriptions they own.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const sub = await prisma.subscription.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        status: true,
        omiseChargeId: true,
      },
    });

    if (!sub) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (sub.tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fast path: DB already resolved.
    if (sub.status !== "PENDING") {
      return NextResponse.json({ status: sub.status as PollStatus });
    }

    // PENDING — if we have an Omise charge id, check live state to cover
    // the webhook-delayed / webhook-failed cases.
    if (sub.omiseChargeId && OMISE_CONFIGURED) {
      try {
        const raw = await getChargeById(sub.omiseChargeId);
        const charge = raw as unknown as OmiseChargeLike;

        if (charge.status === "successful" && charge.paid === true) {
          // Atomic claim: flip PENDING → ACTIVE in a single write. Only the
          // caller that wins the claim goes on to generate the invoice / tenant
          // plan update. This is safe against concurrent webhook activation.
          const claimed = await prisma.subscription.updateMany({
            where: { id: sub.id, status: "PENDING" },
            data: { status: "ACTIVE", omiseChargeId: sub.omiseChargeId },
          });
          if (claimed.count > 0) {
            await activateSubscription({
              subscriptionId: sub.id,
              omiseChargeId: sub.omiseChargeId,
            });
          }
          return NextResponse.json({ status: "ACTIVE" as PollStatus });
        }

        if (charge.status === "failed") {
          const reason =
            charge.failure_message ||
            charge.failure_code ||
            "ธนาคารปฏิเสธรายการ";
          return NextResponse.json({
            status: "FAILED" as PollStatus,
            failureReason: reason,
          });
        }
      } catch (err) {
        // Don't leak Omise errors — just report PENDING and let caller retry.
        console.error("[billing/status] omise poll failed", {
          subscriptionId: sub.id,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    return NextResponse.json({ status: "PENDING" as PollStatus });
  } catch (err) {
    console.error("[billing/status] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
