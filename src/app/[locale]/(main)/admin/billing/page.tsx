import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CreditCard, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.ADMIN_ONLY)) return <AccessDenied />;

  const tenantId = session.user.tenantId;

  const [tenant, counts, subs] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    }),
    Promise.all([
      prisma.user.count({ where: { tenantId, isActive: true } }),
      prisma.cncMachine.count({ where: { tenantId, isActive: true } }),
      prisma.customer.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
    ]).then(([users, machines, customers, products]) => ({ users, machines, customers, products })),
    prisma.subscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { plan: { select: { name: true } } },
    }),
  ]);

  if (!tenant) redirect(`/${locale}/login`);

  const plan = tenant.plan;
  const now = new Date();
  const trialDaysLeft =
    tenant.status === "TRIAL" && tenant.trialEndsAt
      ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

  function fmt(sat: number) {
    return `฿${(sat / 100).toLocaleString("th-TH")}`;
  }

  function usageBar(current: number, max: number, label: string) {
    const unlimited = max === 0;
    const pct = unlimited ? 0 : Math.min(100, (current / max) * 100);
    const overLimit = !unlimited && current >= max;

    return (
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>{label}</span>
          <span className={`font-medium ${overLimit ? "text-red-600" : "text-muted-foreground"}`}>
            {current.toLocaleString()} {unlimited ? "/ ไม่จำกัด" : `/ ${max.toLocaleString()}`}
          </span>
        </div>
        {!unlimited && (
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${overLimit ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">การชำระเงิน (Billing)</h1>
        <p className="text-sm text-muted-foreground">
          จัดการ plan การใช้งาน และประวัติการชำระเงิน
        </p>
      </div>

      {/* Current plan */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-sm text-muted-foreground">Current Plan</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold">{plan?.name ?? "—"}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  tenant.status === "ACTIVE"
                    ? "bg-green-500/10 text-green-600"
                    : tenant.status === "TRIAL"
                      ? "bg-yellow-500/10 text-yellow-600"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {tenant.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Monthly</div>
            <div className="text-xl font-semibold">
              {plan ? fmt(plan.priceMonthly) : "—"}
            </div>
          </div>
        </div>

        {/* Trial warning */}
        {trialDaysLeft !== null && (
          <div
            className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
              trialDaysLeft <= 3
                ? "bg-red-500/10 text-red-600"
                : trialDaysLeft <= 7
                  ? "bg-yellow-500/10 text-yellow-700"
                  : "bg-blue-500/10 text-blue-700"
            }`}
          >
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">
                ทดลองใช้ฟรี — เหลืออีก {trialDaysLeft} วัน
              </div>
              <div className="text-xs mt-0.5 opacity-80">
                หมดอายุ {tenant.trialEndsAt?.toLocaleDateString("th-TH")}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <Link
            href={`/${locale}/admin/billing/upgrade`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-blue-600"
          >
            <TrendingUp className="h-4 w-4 mr-2" /> Upgrade Plan
          </Link>
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <div className="mb-4">
          <div className="font-semibold">Usage</div>
          <div className="text-xs text-muted-foreground">
            การใช้งานเทียบกับ limit ของ plan
          </div>
        </div>
        <div className="space-y-4">
          {usageBar(counts.users, plan?.maxUsers ?? 0, "ผู้ใช้งาน")}
          {usageBar(counts.machines, plan?.maxMachines ?? 0, "เครื่อง CNC")}
          {usageBar(counts.customers, plan?.maxCustomers ?? 0, "ลูกค้า")}
          {usageBar(counts.products, plan?.maxProducts ?? 0, "สินค้า")}
        </div>
      </div>

      {/* Payment history */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4">
          <div className="font-semibold">ประวัติการชำระเงิน</div>
          <div className="text-xs text-muted-foreground">Subscription และ invoice ทั้งหมด</div>
        </div>

        {subs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
            ยังไม่มีประวัติการชำระเงิน
          </div>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{s.plan.name} — {s.billingCycle}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.periodStart).toLocaleDateString("th-TH")} →{" "}
                    {new Date(s.periodEnd).toLocaleDateString("th-TH")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span>{fmt(s.totalSatang)}</span>
                  {s.status === "ACTIVE" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coming soon note */}
      <div className="mt-6 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        <strong>หมายเหตุ:</strong> การ upgrade ผ่านบัตรเครดิต (Omise) และ PromptPay QR (SlipOK) จะ
        เปิดใช้งานเมื่อ Phase 6 เสร็จ — ระหว่างนี้กรุณาติดต่อ{" "}
        <a href="mailto:hello@workinflow.cloud" className="text-primary hover:underline">
          hello@workinflow.cloud
        </a>
      </div>
    </div>
  );
}
