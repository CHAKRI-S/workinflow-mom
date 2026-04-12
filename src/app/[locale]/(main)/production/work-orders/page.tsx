import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { redirect } from "next/navigation";
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
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.PRODUCTION)) return <AccessDenied />;

  const workOrders = await prisma.workOrder.findMany({
    where: { tenantId: session.user.tenantId },
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
