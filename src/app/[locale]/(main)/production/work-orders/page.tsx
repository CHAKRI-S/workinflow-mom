import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { setRequestLocale } from "next-intl/server";
import { WorkOrderListClient } from "./work-order-list-client";

export default async function WorkOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);

  const workOrders = await prisma.workOrder.findMany({
    where: { tenantId: session!.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, code: true, name: true } },
      cncMachine: { select: { id: true, code: true, name: true } },
    },
  });

  return (
    <WorkOrderListClient workOrders={JSON.parse(JSON.stringify(workOrders))} />
  );
}
