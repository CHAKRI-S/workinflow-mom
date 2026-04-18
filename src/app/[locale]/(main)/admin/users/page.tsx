import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { redirect } from "next/navigation";
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
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.ADMIN_ONLY)) return <AccessDenied />;

  const tenantId = session.user.tenantId;

  const [users, tenant, activeCount] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: { select: { maxUsers: true, name: true } } },
    }),
    prisma.user.count({ where: { tenantId, isActive: true } }),
  ]);

  const maxUsers = tenant?.plan?.maxUsers ?? 0; // 0 = unlimited
  const planName = tenant?.plan?.name ?? null;

  return (
    <UserListClient
      users={JSON.parse(JSON.stringify(users))}
      activeCount={activeCount}
      maxUsers={maxUsers}
      planName={planName}
    />
  );
}
