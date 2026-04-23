import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendSubscriptionExpiredEmail,
  sendRenewalSuccessEmail,
  sendRenewalFailedEmail,
} from "@/lib/email";
import { OMISE_CONFIGURED, chargeCustomer } from "@/lib/omise";
import { createSubscriptionInvoice } from "@/lib/subscription-invoice";
import { calculateAmounts, computePeriod } from "@/lib/subscription";

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

  // 1. Find expired ACTIVE subscriptions + load tenant + admin email +
  //    saved-card state (Phase 6D auto-renewal fields)
  const expired = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      periodEnd: { lt: now },
    },
    select: {
      id: true,
      tenantId: true,
      planId: true,
      billingCycle: true,
      periodStart: true,
      periodEnd: true,
      discountCodeId: true,
      plan: {
        select: {
          id: true,
          name: true,
          priceMonthly: true,
          priceYearly: true,
        },
      },
      tenant: {
        select: {
          id: true,
          name: true,
          status: true,
          omiseCustomerId: true,
          omiseDefaultCardId: true,
          omiseDefaultCardLast4: true,
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
    status: "renewed" | "expired" | "error";
    error?: string;
    newSubscriptionId?: string;
  }> = [];

  const expiredEmails: Array<{
    to: string;
    params: Parameters<typeof sendSubscriptionExpiredEmail>[1];
  }> = [];

  const renewalSuccessEmails: Array<{
    to: string;
    params: Parameters<typeof sendRenewalSuccessEmail>[1];
  }> = [];

  const renewalFailedEmails: Array<{
    to: string;
    params: Parameters<typeof sendRenewalFailedEmail>[1];
  }> = [];

  for (const sub of expired) {
    try {
      const admin = sub.tenant.users[0];

      // ─── Phase 6D: saved-card auto-renewal attempt ─────────
      // Only try if tenant has both customer+card fields, Omise is configured,
      // the plan actually costs money, and tenant is still ACTIVE (don't
      // re-bill a tenant who is already SUSPENDED / CANCELLED).
      const planPrice =
        sub.billingCycle === "YEARLY"
          ? sub.plan.priceYearly
          : sub.plan.priceMonthly;
      const canAutoCharge =
        OMISE_CONFIGURED &&
        sub.tenant.omiseCustomerId &&
        sub.tenant.omiseDefaultCardId &&
        planPrice > 0 &&
        sub.tenant.status === "ACTIVE";

      if (canAutoCharge && sub.tenant.omiseCustomerId) {
        const amounts = calculateAmounts({
          priceMonthlySatang: sub.plan.priceMonthly,
          priceYearlySatang: sub.plan.priceYearly,
          billingCycle: sub.billingCycle,
        });

        const charge = await chargeCustomer({
          customerId: sub.tenant.omiseCustomerId,
          amountSatang: amounts.totalSatang,
          description: `Renewal: ${sub.plan.name} ${sub.billingCycle} — ${sub.tenant.name}`,
          metadata: {
            tenantId: sub.tenantId,
            previousSubscriptionId: sub.id,
            planId: sub.plan.id,
            renewal: "auto",
          },
        });

        if (charge.status === "successful" && charge.paid) {
          // New period starts where the old one ends → no gap.
          const { periodStart, periodEnd } = computePeriod(
            sub.billingCycle,
            sub.periodEnd,
          );

          const newSub = await prisma.$transaction(async (tx) => {
            const created = await tx.subscription.create({
              data: {
                tenantId: sub.tenantId,
                planId: sub.planId,
                status: "ACTIVE",
                billingCycle: sub.billingCycle,
                periodStart,
                periodEnd,
                amountSatang: amounts.amountSatang,
                discountSatang: amounts.discountSatang,
                vatSatang: amounts.vatSatang,
                totalSatang: amounts.totalSatang,
                paymentGateway: "OMISE",
                omiseChargeId: charge.chargeId,
                gatewayRef: charge.chargeId,
                discountCodeId: sub.discountCodeId,
              },
            });
            // Close out the old period. Tenant stays ACTIVE.
            await tx.subscription.update({
              where: { id: sub.id },
              data: { status: "EXPIRED" },
            });
            return created;
          });

          // Generate SubscriptionInvoice — non-fatal if it blows up.
          try {
            await createSubscriptionInvoice(newSub.id);
          } catch (err) {
            console.error(
              `[cron/renewal-retry] invoice generation failed for sub ${newSub.id}:`,
              err,
            );
          }

          if (admin?.email) {
            renewalSuccessEmails.push({
              to: admin.email,
              params: {
                name: admin.name ?? "",
                companyName: sub.tenant.name,
                planName: sub.plan.name,
                amountSatang: amounts.totalSatang,
                cardLast4: sub.tenant.omiseDefaultCardLast4 ?? null,
                periodEnd,
              },
            });
          }

          results.push({
            subscriptionId: sub.id,
            tenantId: sub.tenantId,
            status: "renewed",
            newSubscriptionId: newSub.id,
          });
          continue;
        }

        // Charge failed → queue a "please update your card" email, then
        // fall through to the standard EXPIRED flow below.
        if (admin?.email) {
          renewalFailedEmails.push({
            to: admin.email,
            params: {
              name: admin.name ?? "",
              companyName: sub.tenant.name,
              planName: sub.plan.name,
              reason: charge.failureMessage ?? "การเรียกเก็บจากบัตรถูกปฏิเสธ",
              billingUrl: renewUrl,
            },
          });
        }
      }

      // ─── Legacy flow: mark EXPIRED + suspend tenant + email ──
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

      if (admin?.email) {
        expiredEmails.push({
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
  await Promise.allSettled([
    ...expiredEmails.map((e) => sendSubscriptionExpiredEmail(e.to, e.params)),
    ...renewalSuccessEmails.map((e) => sendRenewalSuccessEmail(e.to, e.params)),
    ...renewalFailedEmails.map((e) => sendRenewalFailedEmail(e.to, e.params)),
  ]);

  const renewedCount = results.filter((r) => r.status === "renewed").length;
  const expiredCount = results.filter((r) => r.status === "expired").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    renewed: renewedCount,
    expired: expiredCount,
    errors: errorCount,
    emailsQueued:
      expiredEmails.length +
      renewalSuccessEmails.length +
      renewalFailedEmails.length,
    results,
  });
}
