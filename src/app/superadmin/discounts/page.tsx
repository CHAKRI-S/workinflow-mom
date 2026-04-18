import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { DiscountsClient } from "./discounts-client";

export default async function DiscountsPage() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  const codes = await prisma.discountCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <SaShell saName={session.name}>
      <DiscountsClient
        initialCodes={codes.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          discountType: c.discountType,
          discountValue: c.discountValue,
          validFrom: c.validFrom?.toISOString() ?? null,
          validUntil: c.validUntil?.toISOString() ?? null,
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          maxUsesPerTenant: c.maxUsesPerTenant,
          isActive: c.isActive,
          createdAt: c.createdAt.toISOString(),
          usageCount: c._count.subscriptions,
        }))}
      />
    </SaShell>
  );
}
