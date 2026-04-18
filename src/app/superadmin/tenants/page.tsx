import { redirect } from "next/navigation";
import Link from "next/link";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { StatusBadge } from "@/components/superadmin/status-badge";
import { Building2, Search } from "lucide-react";

interface SearchParams {
  q?: string;
  status?: string;
  plan?: string;
}

export default async function TenantsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSaSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusFilter = params.status ?? "";
  const planFilter = params.plan ?? "";

  const where: {
    OR?: Array<Record<string, { contains: string; mode: "insensitive" }>>;
    status?: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
    plan?: { slug: string };
  } = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (statusFilter === "TRIAL" || statusFilter === "ACTIVE" || statusFilter === "SUSPENDED" || statusFilter === "CANCELLED") {
    where.status = statusFilter;
  }
  if (planFilter) {
    where.plan = { slug: planFilter };
  }

  const [tenants, plans] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        email: true,
        status: true,
        createdAt: true,
        trialEndsAt: true,
        lastActiveAt: true,
        plan: { select: { name: true, tier: true } },
        _count: { select: { users: true, customers: true, workOrders: true } },
      },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  return (
    <SaShell saName={session.name}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Tenants</h1>
        <p className="text-muted-foreground">จัดการบริษัทที่ใช้งานบน WorkinFlow ทั้งหมด</p>
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, slug, code, email..."
            className="h-10 w-full rounded-lg border bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          name="status"
          defaultValue={statusFilter}
          className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          name="plan"
          defaultValue={planFilter}
          className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-blue-600">
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Tenant</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-center px-4 py-3 font-medium">Users</th>
              <th className="text-center px-4 py-3 font-medium">Customers</th>
              <th className="text-center px-4 py-3 font-medium">WOs</th>
              <th className="text-left px-4 py-3 font-medium">Trial ends</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No tenants found
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30 transition">
                <td className="px-4 py-3">
                  <Link href={`/tenants/${t.id}`} className="block">
                    <div className="font-medium hover:text-primary transition">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.slug} • {t.code} {t.email && `• ${t.email}`}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs">{t.plan?.name ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-center">{t._count.users}</td>
                <td className="px-4 py-3 text-center">{t._count.customers}</td>
                <td className="px-4 py-3 text-center">{t._count.workOrders}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString("th-TH") : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString("th-TH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tenants.length === 100 && (
        <p className="mt-4 text-xs text-center text-muted-foreground">
          แสดงสูงสุด 100 รายการ — กรองเพื่อดูเพิ่มเติม
        </p>
      )}
    </SaShell>
  );
}
