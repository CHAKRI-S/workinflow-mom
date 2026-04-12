import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { setRequestLocale } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { MaterialDetailClient } from "./material-detail-client";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  requirePermission(session, ROLES.PRODUCTION);

  const material = await prisma.material.findFirst({
    where: { id, tenantId: session.user.tenantId, isActive: true },
    include: {
      bomLines: {
        include: {
          product: { select: { id: true, code: true, name: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!material) notFound();

  return (
    <MaterialDetailClient material={JSON.parse(JSON.stringify(material))} />
  );
}
