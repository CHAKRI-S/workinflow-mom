import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProductForm } from "../product-form";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const materials = await prisma.material.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    select: { id: true, code: true, name: true, unit: true },
    orderBy: { code: "asc" },
  });

  return <ProductForm materials={JSON.parse(JSON.stringify(materials))} />;
}
