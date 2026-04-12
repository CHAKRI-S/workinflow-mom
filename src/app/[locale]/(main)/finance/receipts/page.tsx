import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReceiptListClient } from "./receipt-list-client";

export default async function ReceiptsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const receipts = await prisma.receipt.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { issueDate: "desc" },
    include: {
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  return <ReceiptListClient receipts={JSON.parse(JSON.stringify(receipts))} />;
}
