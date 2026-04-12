import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { UserDetailClient } from "./user-detail-client";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  requirePermission(session, ROLES.ADMIN_ONLY);

  const user = await prisma.user.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) notFound();

  return <UserDetailClient user={JSON.parse(JSON.stringify(user))} />;
}
