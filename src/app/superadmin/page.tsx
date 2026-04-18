import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { StatusBadge } from "@/components/superadmin/status-badge";
import { Building2, Users, DollarSign, TrendingUp, Clock, AlertTriangle } from "lucide-react";

export default async function SuperAdminDashboard() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sevenDaysAhead = new Date(now);
  sevenDaysAhead.setDate(now.getDate() + 7);

  const [
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    newThisMonth,
    trialEndingSoon,
    activeSubs,
    recentTenants,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { status: "TRIAL" } }),
    prisma.tenant.count({ where: { status: "SUSPENDED" } }),
    prisma.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.tenant.count({
      where: {
        status: "TRIAL",
        trialEndsAt: { gte: now, lte: sevenDaysAhead },
      },
    }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { totalSatang: true, billingCycle: true },
    }),
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        trialEndsAt: true,
        plan: { select: { name: true, tier: true } },
        _count: { select: { users: true } },
      },
    }),
  ]);

  // Calculate MRR (satang)
  const mrr = activeSubs.reduce((sum, s) => {
    if (s.billingCycle === "MONTHLY") return sum + s.totalSatang;
    return sum + Math.round(s.totalSatang / 12); // yearly → monthly
  }, 0);
  const arr = mrr * 12;

  function formatCurrency(satang: number) {
    return `฿${(satang / 100).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
  }

  return (
    <SaShell saName={session.name}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">ภาพรวมแพลตฟอร์ม WorkinFlow Cloud</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Building2} label="Total Tenants" value={totalTenants.toString()} accent="primary" />
        <StatCard icon={TrendingUp} label="Active" value={activeTenants.toString()} accent="green" />
        <StatCard icon={Clock} label="On Trial" value={trialTenants.toString()} accent="yellow" />
        <StatCard icon={AlertTriangle} label="Suspended" value={suspendedTenants.toString()} accent="red" />

        <StatCard icon={Users} label="New (30d)" value={newThisMonth.toString()} />
        <StatCard icon={Clock} label="Trial ending (7d)" value={trialEndingSoon.toString()} accent="yellow" />
        <StatCard icon={DollarSign} label="MRR" value={formatCurrency(mrr)} accent="primary" />
        <StatCard icon={DollarSign} label="ARR" value={formatCurrency(arr)} accent="primary" />
      </div>

      {/* Recent Tenants */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold">Recent Tenants</h2>
          <a href="/tenants" className="text-sm text-primary hover:underline">
            View all →
          </a>
        </div>
        <div className="divide-y">
          {recentTenants.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No tenants yet</div>
          )}
          {recentTenants.map((t) => (
            <a
              key={t.id}
              href={`/tenants/${t.id}`}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition"
            >
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.slug} • {t._count.users} users • Created{" "}
                  {new Date(t.createdAt).toLocaleDateString("th-TH")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{t.plan?.name ?? "—"}</span>
                <StatusBadge status={t.status} />
              </div>
            </a>
          ))}
        </div>
      </div>
    </SaShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "primary" | "green" | "yellow" | "red";
}) {
  const accentColors: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    green: "text-green-600 bg-green-500/10",
    yellow: "text-yellow-600 bg-yellow-500/10",
    red: "text-red-600 bg-red-500/10",
  };
  const color = accent ? accentColors[accent] : "text-muted-foreground bg-muted";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

