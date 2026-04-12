import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { ProductDetailClient } from "./product-detail-client";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.PRODUCTION)) return <AccessDenied />;

  const product = await prisma.product.findFirst({
    where: { id, tenantId: session.user.tenantId, isActive: true },
    include: {
      bomLines: {
        include: { material: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) notFound();

  const materials = await prisma.material.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
  });

  return (
    <ProductDetailClient
      product={JSON.parse(JSON.stringify(product))}
      materials={JSON.parse(JSON.stringify(materials))}
    />
  );
}
