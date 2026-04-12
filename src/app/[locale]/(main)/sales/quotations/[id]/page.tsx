import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { QuotationDetailClient } from "./quotation-detail-client";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  requirePermission(session, ROLES.SALES_TEAM);

  const quotation = await prisma.quotation.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          isVatRegistered: true,
          contactName: true,
          phone: true,
          email: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      lines: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { salesOrders: true } },
    },
  });

  if (!quotation) {
    notFound();
  }

  // Serialize Decimal fields
  const serialized = JSON.parse(JSON.stringify(quotation));

  return (
    <div className="mx-auto max-w-5xl">
      <QuotationDetailClient quotation={serialized} />
    </div>
  );
}
