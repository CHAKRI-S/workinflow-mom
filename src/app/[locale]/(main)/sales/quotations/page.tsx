import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { QuotationListClient } from "./quotation-list-client";

export default async function QuotationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.SALES_TEAM)) return <AccessDenied />;

  const quotations = await prisma.quotation.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
  });

  // Serialize Decimal fields for client
  const serialized = JSON.parse(JSON.stringify(quotations));

  return <QuotationListClient quotations={serialized} />;
}
