import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OrderListClient } from "./order-list-client";

export default async function SalesOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const orders = await prisma.salesOrder.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { orderDate: "desc" },
    include: {
      customer: { select: { id: true, code: true, name: true } },
      _count: { select: { lines: true } },
    },
  });

  return <OrderListClient orders={JSON.parse(JSON.stringify(orders))} />;
}
