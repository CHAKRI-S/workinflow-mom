import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
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
  requirePermission(session, ROLES.SALES_TEAM);

  const quotations = await prisma.quotation.findMany({
    where: { tenantId: session!.user.tenantId },
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
