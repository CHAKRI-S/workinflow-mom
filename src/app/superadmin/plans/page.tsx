import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { Check, X } from "lucide-react";

export default async function PlansPage() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { tenants: true, subscriptions: true } } },
  });

  return (
    <SaShell saName={session.name}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Plans</h1>
        <p className="text-muted-foreground">
          แก้ไข plan templates — เปลี่ยนค่า/features ผ่าน seed หรือ Prisma Studio
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Tier</th>
              <th className="text-right px-4 py-3 font-medium">Monthly</th>
              <th className="text-right px-4 py-3 font-medium">Yearly</th>
              <th className="text-center px-4 py-3 font-medium">Max Users</th>
              <th className="text-center px-4 py-3 font-medium">Max Machines</th>
              <th className="text-center px-4 py-3 font-medium">Public</th>
              <th className="text-center px-4 py-3 font-medium">Tenants</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.slug}</div>
                </td>
                <td className="px-4 py-3 text-xs">{p.tier}</td>
                <td className="px-4 py-3 text-right">฿{(p.priceMonthly / 100).toLocaleString("th-TH")}</td>
                <td className="px-4 py-3 text-right">฿{(p.priceYearly / 100).toLocaleString("th-TH")}</td>
                <td className="px-4 py-3 text-center">{p.maxUsers === 0 ? "∞" : p.maxUsers}</td>
                <td className="px-4 py-3 text-center">{p.maxMachines === 0 ? "∞" : p.maxMachines}</td>
                <td className="px-4 py-3 text-center">
                  {p.isPublic ? (
                    <Check className="h-4 w-4 text-green-500 inline" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground/40 inline" />
                  )}
                </td>
                <td className="px-4 py-3 text-center">{p._count.tenants}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <strong>หมายเหตุ:</strong> Plan templates (pricing + limits + features) แก้ผ่าน{" "}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">prisma/seed.ts</code> แล้ว run{" "}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">npx tsx prisma/seed.ts</code>
        {" "}UI สำหรับ edit จะเพิ่มใน phase ถัดไป
      </div>
    </SaShell>
  );
}
