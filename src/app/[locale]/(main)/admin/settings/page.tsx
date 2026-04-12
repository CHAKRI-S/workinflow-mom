import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  requirePermission(session, ROLES.ADMIN_ONLY);

  const tenantId = session.user.tenantId;

  const [tenant, sequences, counts] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.documentSequence.findMany({
      where: { tenantId },
      orderBy: [{ prefix: "asc" }, { year: "desc" }],
    }),
    // Get counts for system overview
    Promise.all([
      prisma.user.count({ where: { tenantId, isActive: true } }),
      prisma.customer.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.material.count({ where: { tenantId, isActive: true } }),
      prisma.cncMachine.count({ where: { tenantId, isActive: true } }),
      prisma.consumable.count({ where: { tenantId, isActive: true } }),
    ]),
  ]);

  return (
    <SettingsClient
      tenant={JSON.parse(JSON.stringify(tenant))}
      sequences={JSON.parse(JSON.stringify(sequences))}
      systemCounts={{
        users: counts[0],
        customers: counts[1],
        products: counts[2],
        materials: counts[3],
        machines: counts[4],
        consumables: counts[5],
      }}
    />
  );
}
