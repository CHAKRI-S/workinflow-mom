import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { ReceiptFormClient } from "./receipt-form-client";
import { isS3Configured } from "@/lib/s3";

export default async function NewReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const { locale } = await params;
  const { invoiceId } = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  // Fetch non-cancelled invoices (ISSUED or PARTIALLY_PAID — open for receipt)
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    orderBy: { issueDate: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      paidAmount: true,
      billingNature: true,
      snapshotCustomerName: true,
      snapshotCustomerAddress: true,
      snapshotCustomerTaxId: true,
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          billingAddress: true,
          taxId: true,
          withholdsTax: true,
          country: true,
        },
      },
    },
  });

  return (
    <ReceiptFormClient
      invoices={JSON.parse(JSON.stringify(invoices))}
      preselectedInvoiceId={invoiceId ?? null}
      storageEnabled={isS3Configured()}
    />
  );
}
