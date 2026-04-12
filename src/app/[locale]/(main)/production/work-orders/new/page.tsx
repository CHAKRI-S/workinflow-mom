import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { setRequestLocale } from "next-intl/server";
import { WorkOrderFormClient } from "./work-order-form-client";

export default async function NewWorkOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);

  const tenantId = session!.user.tenantId;

  const [products, machines] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.cncMachine.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <WorkOrderFormClient
      products={JSON.parse(JSON.stringify(products))}
      machines={JSON.parse(JSON.stringify(machines))}
    />
  );
}
