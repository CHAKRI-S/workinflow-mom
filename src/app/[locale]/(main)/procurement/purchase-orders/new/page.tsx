import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { POFormClient } from "./po-form-client";

export default async function NewPurchaseOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  requirePermission(session, ROLES.PLANNING);

  const [materials, consumables] = await Promise.all([
    prisma.material.findMany({
      where: { tenantId: session!.user.tenantId, isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        unitCost: true,
      },
    }),
    prisma.consumable.findMany({
      where: { tenantId: session!.user.tenantId, isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        lastPrice: true,
      },
    }),
  ]);

  return (
    <POFormClient
      materials={JSON.parse(JSON.stringify(materials))}
      consumables={JSON.parse(JSON.stringify(consumables))}
    />
  );
}
