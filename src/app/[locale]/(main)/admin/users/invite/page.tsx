import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { InviteClient } from "./invite-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.ADMIN_ONLY)) return <AccessDenied />;

  const invites = await prisma.userInvite.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <InviteClient
      initialInvites={invites.map((i) => ({
        id: i.id,
        email: i.email,
        name: i.name,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
        acceptedAt: i.acceptedAt?.toISOString() ?? null,
        cancelledAt: i.cancelledAt?.toISOString() ?? null,
        invitedByName: i.invitedByName,
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}
