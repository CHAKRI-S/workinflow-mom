import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProductListClient } from "./product-list-client";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const products = await prisma.product.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { bomLines: true, workOrders: true } },
    },
  });

  return <ProductListClient products={JSON.parse(JSON.stringify(products))} />;
}
