import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { TaxInvoiceListClient } from "./tax-invoice-list-client";

export default async function TaxInvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  const taxInvoices = await prisma.taxInvoice.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { issueDate: "desc" },
    include: {
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  return (
    <TaxInvoiceListClient
      taxInvoices={JSON.parse(JSON.stringify(taxInvoices))}
    />
  );
}
