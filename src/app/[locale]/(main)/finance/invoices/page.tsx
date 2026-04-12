import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { InvoiceListClient } from "./invoice-list-client";

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  const invoices = await prisma.invoice.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { issueDate: "desc" },
    include: {
      customer: { select: { id: true, code: true, name: true } },
      salesOrder: { select: { id: true, orderNumber: true } },
    },
  });

  return <InvoiceListClient invoices={JSON.parse(JSON.stringify(invoices))} />;
}
