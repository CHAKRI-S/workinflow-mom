import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CustomerListClient } from "./customer-list-client";

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const customers = await prisma.customer.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
    include: { _count: { select: { salesOrders: true, quotations: true } } },
  });

  return <CustomerListClient customers={JSON.parse(JSON.stringify(customers))} />;
}
