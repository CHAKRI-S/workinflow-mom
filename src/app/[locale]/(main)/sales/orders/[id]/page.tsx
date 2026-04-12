import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { OrderDetailClient } from "./order-detail-client";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.SALES_TEAM)) return <AccessDenied />;

  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          isVatRegistered: true,
        },
      },
      quotation: {
        select: { id: true, quotationNumber: true },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
        },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (!order) notFound();

  return <OrderDetailClient order={JSON.parse(JSON.stringify(order))} />;
}
