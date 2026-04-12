import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { requirePermission, ROLES } from "@/lib/permissions";
import { QuotationForm } from "../quotation-form";

export default async function NewQuotationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  requirePermission(session, ROLES.SALES_TEAM);

  return (
    <div className="mx-auto max-w-5xl">
      <QuotationForm mode="create" />
    </div>
  );
}
