import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { TaxInvoiceDetailClient } from "./tax-invoice-detail-client";

export default async function TaxInvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  const taxInvoice = await prisma.taxInvoice.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!taxInvoice) notFound();

  return (
    <TaxInvoiceDetailClient
      taxInvoice={JSON.parse(JSON.stringify(taxInvoice))}
    />
  );
}
