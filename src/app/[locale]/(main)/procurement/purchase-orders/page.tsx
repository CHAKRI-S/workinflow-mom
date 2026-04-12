import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { POListClient } from "./po-list-client";

export default async function PurchaseOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.PLANNING)) return <AccessDenied />;

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lines: true } } },
  });

  return (
    <POListClient
      purchaseOrders={JSON.parse(JSON.stringify(purchaseOrders))}
    />
  );
}
