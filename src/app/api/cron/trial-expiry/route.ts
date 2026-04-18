import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialEndingEmail } from "@/lib/email";

/**
 * GET /api/cron/trial-expiry
 *
 * Run hourly via GitHub Actions or external cron. Responsibilities:
 * 1. Suspend tenants whose trial has expired (status: TRIAL → SUSPENDED)
 * 2. Send reminder emails at 7/3/1 days before expiry
 *
 * Auth: requires `x-cron-secret` header matching CRON_SECRET env var
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
  const upgradeUrl = `${appUrl}/th/admin/billing/upgrade`;

  // 1. Expire trials
  const expired = await prisma.tenant.findMany({
    where: {
      status: "TRIAL",
      trialEndsAt: { lt: now },
    },
    select: { id: true, name: true },
  });

  for (const t of expired) {
    await prisma.tenant.update({
      where: { id: t.id },
      data: { status: "SUSPENDED" },
    });
  }

  // 2. Send reminder emails at 7, 3, 1 day thresholds
  const reminders: Array<{ tenantId: string; emailTo: string; name: string; companyName: string; daysLeft: number }> = [];

  for (const days of [7, 3, 1]) {
    const from = new Date(now);
    from.setDate(from.getDate() + days);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    const dueTenants = await prisma.tenant.findMany({
      where: {
        status: "TRIAL",
        trialEndsAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        name: true,
        users: {
          where: { role: "ADMIN", isActive: true },
          take: 1,
          select: { email: true, name: true },
        },
      },
    });

    for (const t of dueTenants) {
      const admin = t.users[0];
      if (admin?.email) {
        reminders.push({
          tenantId: t.id,
          emailTo: admin.email,
          name: admin.name,
          companyName: t.name,
          daysLeft: days,
        });
      }
    }
  }

  // Send reminders in parallel (fire-and-forget, log errors)
  await Promise.allSettled(
    reminders.map((r) =>
      sendTrialEndingEmail(r.emailTo, {
        name: r.name,
        companyName: r.companyName,
        daysLeft: r.daysLeft,
        upgradeUrl,
      }),
    ),
  );

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    suspended: expired.length,
    suspendedIds: expired.map((t) => t.id),
    remindersSent: reminders.length,
  });
}
