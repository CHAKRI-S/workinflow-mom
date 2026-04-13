import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { ReceiptDetailClient } from "./receipt-detail-client";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  const receipt = await prisma.receipt.findFirst({
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
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (!receipt) notFound();

  return <ReceiptDetailClient receipt={JSON.parse(JSON.stringify(receipt))} />;
}
