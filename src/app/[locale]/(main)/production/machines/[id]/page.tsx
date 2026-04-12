import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { MachineDetailClient } from "./machine-detail-client";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.PRODUCTION)) return <AccessDenied />;

  const machine = await prisma.cncMachine.findFirst({
    where: { id, tenantId: session.user.tenantId, isActive: true },
    include: {
      maintenanceLogs: {
        orderBy: { scheduledDate: "desc" },
      },
      _count: { select: { workOrders: true } },
    },
  });

  if (!machine) notFound();

  return <MachineDetailClient machine={JSON.parse(JSON.stringify(machine))} />;
}
