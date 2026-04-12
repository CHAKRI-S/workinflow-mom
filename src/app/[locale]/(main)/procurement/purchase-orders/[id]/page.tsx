import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { notFound, redirect } from "next/navigation";
import { PODetailClient } from "./po-detail-client";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.PLANNING)) return <AccessDenied />;

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          material: {
            select: { id: true, code: true, name: true, unit: true },
          },
        },
      },
    },
  });

  if (!purchaseOrder) notFound();

  return (
    <PODetailClient
      purchaseOrder={JSON.parse(JSON.stringify(purchaseOrder))}
    />
  );
}
