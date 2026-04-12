import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { setRequestLocale } from "next-intl/server";
import { UserListClient } from "./user-list-client";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  requirePermission(session, ROLES.ADMIN_ONLY);

  const users = await prisma.user.findMany({
    where: { tenantId: session!.user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return <UserListClient users={JSON.parse(JSON.stringify(users))} />;
}
