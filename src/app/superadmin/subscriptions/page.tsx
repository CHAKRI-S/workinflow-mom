import { redirect } from "next/navigation";
import Link from "next/link";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { StatusBadge } from "@/components/superadmin/status-badge";

export default async function SubscriptionsPage() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  const subs = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      plan: { select: { name: true } },
    },
  });

  return (
    <SaShell saName={session.name}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Subscriptions</h1>
        <p className="text-muted-foreground">รายการ subscription / การชำระเงินของ tenant ทุกราย</p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Tenant</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Cycle</th>
              <th className="text-left px-4 py-3 font-medium">Period</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Gateway</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No subscriptions yet
                </td>
              </tr>
            )}
            {subs.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/tenants/${s.tenant.id}`} className="font-medium hover:text-primary">
                    {s.tenant.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{s.plan.name}</td>
                <td className="px-4 py-3 text-xs">{s.billingCycle}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(s.periodStart).toLocaleDateString("th-TH")} →{" "}
                  {new Date(s.periodEnd).toLocaleDateString("th-TH")}
                </td>
                <td className="px-4 py-3 text-right">
                  ฿{(s.totalSatang / 100).toLocaleString("th-TH")}
                </td>
                <td className="px-4 py-3 text-xs">{s.paymentGateway ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SaShell>
  );
}
