import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { InvoiceDetailClient } from "./invoice-detail-client";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          isVatRegistered: true,
          taxId: true,
          billingAddress: true,
        },
      },
      salesOrder: {
        select: { id: true, orderNumber: true },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
      },
      taxInvoices: {
        select: {
          id: true,
          taxInvoiceNumber: true,
          status: true,
          totalAmount: true,
          issueDate: true,
        },
        orderBy: { issueDate: "desc" },
      },
      receipts: {
        select: {
          id: true,
          receiptNumber: true,
          status: true,
          amount: true,
          issueDate: true,
        },
        orderBy: { issueDate: "desc" },
      },
      creditNotes: {
        select: {
          id: true,
          creditNoteNumber: true,
          status: true,
          totalAmount: true,
          issueDate: true,
        },
        orderBy: { issueDate: "desc" },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (!invoice) notFound();

  return <InvoiceDetailClient invoice={JSON.parse(JSON.stringify(invoice))} />;
}
