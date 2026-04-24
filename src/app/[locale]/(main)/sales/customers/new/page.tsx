import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.SALES_TEAM)) return <AccessDenied />;

  // Pull the tenant-level default so new customers inherit (e.g. a pure
  // contract-mfg tenant doesn't have to flip every new customer manually).
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { defaultBillingNature: true },
  });

  return (
    <CustomerForm
      tenantDefaultBillingNature={tenant?.defaultBillingNature ?? "GOODS"}
    />
  );
}
