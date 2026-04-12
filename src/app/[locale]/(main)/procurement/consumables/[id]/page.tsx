import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { setRequestLocale } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { ConsumableDetailClient } from "./consumable-detail-client";

export default async function ConsumableDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.PLANNING)) return <AccessDenied />;

  const consumable = await prisma.consumable.findFirst({
    where: { id, tenantId: session.user.tenantId, isActive: true },
  });

  if (!consumable) notFound();

  return <ConsumableDetailClient consumable={JSON.parse(JSON.stringify(consumable))} />;
}
