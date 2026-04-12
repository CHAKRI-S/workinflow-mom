import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ConsumableListClient } from "./consumable-list-client";

export default async function ConsumablesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  requirePermission(session, ROLES.PLANNING);

  const consumables = await prisma.consumable.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
  });

  return <ConsumableListClient consumables={JSON.parse(JSON.stringify(consumables))} />;
}
