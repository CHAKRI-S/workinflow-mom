import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.SALES_TEAM)) return <AccessDenied />;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: session.user.tenantId, isActive: true },
  });

  if (!customer) notFound();

  return (
    <CustomerForm
      isEdit
      defaultValues={{
        id: customer.id,
        code: customer.code,
        name: customer.name,
        customerType: customer.customerType,
        contactName: customer.contactName || undefined,
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        lineId: customer.lineId || undefined,
        taxId: customer.taxId || undefined,
        billingAddress: customer.billingAddress || undefined,
        shippingAddress: customer.shippingAddress || undefined,
        isVatRegistered: customer.isVatRegistered,
        paymentTermDays: customer.paymentTermDays,
        creditLimit: customer.creditLimit ? Number(customer.creditLimit) : undefined,
        // Juristic / RD fields — previously not populated, which meant editing
        // an existing customer lost these selections. Include them so the
        // form state matches the DB row.
        juristicType: customer.juristicType || undefined,
        branchNo: customer.branchNo || undefined,
        country: customer.country || "TH",
        // Tax policy (Phase 8A) — load stored values so form reflects current DB row
        withholdsTax: customer.withholdsTax,
        defaultBillingNature: customer.defaultBillingNature,
      }}
    />
  );
}
