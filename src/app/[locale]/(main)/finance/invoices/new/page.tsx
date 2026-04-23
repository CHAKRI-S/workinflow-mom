import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { InvoiceFormClient } from "./invoice-form-client";

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  // Fetch confirmed (non-cancelled) sales orders with customer + lines
  const salesOrders = await prisma.salesOrder.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: {
        not: "CANCELLED",
      },
    },
    orderBy: { orderDate: "desc" },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      subtotal: true,
      vatRate: true,
      vatAmount: true,
      discountAmount: true,
      depositAmount: true,
      billingNature: true,
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          isVatRegistered: true,
          withholdsTax: true,
          defaultBillingNature: true,
          brandingAssets: true,
        },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          notes: true,
          sortOrder: true,
          drawingSource: true,
          lineBillingNature: true,
          productCode: true,
          drawingRevision: true,
          customerDrawingUrl: true,
          customerBranding: true,
          product: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return (
    <InvoiceFormClient
      salesOrders={JSON.parse(JSON.stringify(salesOrders))}
    />
  );
}
