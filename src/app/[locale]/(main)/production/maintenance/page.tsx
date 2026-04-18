import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { MaintenanceClient } from "./maintenance-client";

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!hasPermission(session, ROLES.PRODUCTION)) return <AccessDenied />;

  const tenantId = session!.user.tenantId;

  // Fetch maintenance logs + machines in parallel
  const [logs, machines] = await Promise.all([
    prisma.maintenanceLog.findMany({
      where: { tenantId },
      include: {
        cncMachine: { select: { id: true, code: true, name: true } },
      },
      orderBy: { scheduledDate: "desc" },
    }),
    prisma.cncMachine.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <MaintenanceClient
      logs={JSON.parse(JSON.stringify(logs))}
      machines={JSON.parse(JSON.stringify(machines))}
    />
  );
}
