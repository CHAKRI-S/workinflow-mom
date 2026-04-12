import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { redirect } from "next/navigation";
import { POFormClient } from "./po-form-client";

export default async function NewPurchaseOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.PLANNING)) return <AccessDenied />;

  const [materials, consumables] = await Promise.all([
    prisma.material.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
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
      where: { tenantId: session.user.tenantId, isActive: true },
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
