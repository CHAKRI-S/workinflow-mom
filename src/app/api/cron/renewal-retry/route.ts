import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSubscriptionExpiredEmail } from "@/lib/email";

/**
 * GET /api/cron/renewal-retry
 *
 * Run hourly via Coolify scheduled task (or external cron). Responsibilities:
 * 1. Find ACTIVE subscriptions where periodEnd < now
 *    → mark Subscription.status = EXPIRED
 *    → mark Tenant.status = SUSPENDED (so tenant sees renewal prompt)
 * 2. Email the tenant admin with renewal link
 *
 * NOTE: Phase 6C (real Omise saved-card retry) is not implemented yet, so
 * this cron does NOT attempt to recharge a saved card — tenant must
 * manually re-checkout at /admin/billing/upgrade. When 6C ships, extend
 * this route to: try charge first → only expire on failure.
 *
 * Auth: requires `x-cron-secret` header matching CRON_SECRET env var.
 * If CRON_SECRET is unset, auth check is skipped (dev mode).
 *
 * Idempotent: each run processes only subscriptions still ACTIVE, so
 * re-running is safe.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://mom.workinflow.cloud";
  const renewUrl = `${appUrl}/th/admin/billing/upgrade`;

  // 1. Find expired ACTIVE subscriptions + load tenant + admin email
  const expired = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      periodEnd: { lt: now },
    },
    select: {
      id: true,
      tenantId: true,
      periodEnd: true,
      plan: { select: { name: true } },
      tenant: {
        select: {
          id: true,
          name: true,
          status: true,
          users: {
            where: { role: "ADMIN", isActive: true },
            take: 1,
            select: { email: true, name: true },
          },
        },
      },
    },
  });

  if (expired.length === 0) {
    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      expired: 0,
    });
  }

  // 2. Transition state — one transaction per sub so a single bad row
  //    doesn't abort the whole batch.
  const results: Array<{
    subscriptionId: string;
    tenantId: string;
    status: "expired" | "error";
    error?: string;
  }> = [];

  const emailsToSend: Array<{
    to: string;
    params: Parameters<typeof sendSubscriptionExpiredEmail>[1];
  }> = [];

  for (const sub of expired) {
    try {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "EXPIRED" },
        }),
        // Only suspend if tenant was ACTIVE — don't demote CANCELLED etc.
        ...(sub.tenant.status === "ACTIVE"
          ? [
              prisma.tenant.update({
                where: { id: sub.tenantId },
                data: { status: "SUSPENDED" },
              }),
            ]
          : []),
      ]);

      const admin = sub.tenant.users[0];
      if (admin?.email) {
        emailsToSend.push({
          to: admin.email,
          params: {
            name: admin.name ?? "",
            companyName: sub.tenant.name,
            planName: sub.plan.name,
            periodEnd: sub.periodEnd,
            renewUrl,
          },
        });
      }

      results.push({
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        status: "expired",
      });
    } catch (err) {
      console.error(`[cron/renewal-retry] sub ${sub.id} failed:`, err);
      results.push({
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        status: "error",
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // 3. Send emails fire-and-forget — cron success doesn't depend on delivery
  await Promise.allSettled(
    emailsToSend.map((e) => sendSubscriptionExpiredEmail(e.to, e.params))
  );

  const expiredCount = results.filter((r) => r.status === "expired").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    expired: expiredCount,
    errors: errorCount,
    emailsQueued: emailsToSend.length,
    results,
  });
}
