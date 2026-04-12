import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { WorkOrderDetailClient } from "./work-order-detail-client";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);

  const workOrder = await prisma.workOrder.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          requiresPainting: true,
          requiresLogoEngraving: true,
        },
      },
      cncMachine: {
        select: { id: true, code: true, name: true },
      },
      logs: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!workOrder) {
    notFound();
  }

  return (
    <WorkOrderDetailClient
      workOrder={JSON.parse(JSON.stringify(workOrder))}
    />
  );
}
