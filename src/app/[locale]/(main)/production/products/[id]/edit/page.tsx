import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "../../product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const [product, materials] = await Promise.all([
    prisma.product.findFirst({
      where: { id, tenantId: session.user.tenantId, isActive: true },
      include: {
        bomLines: {
          include: { material: { select: { id: true, code: true, name: true, unit: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.material.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, code: true, name: true, unit: true },
      orderBy: { code: "asc" },
    }),
  ]);

  if (!product) notFound();

  const serialized = JSON.parse(JSON.stringify(product));

  return (
    <ProductForm
      isEdit
      materials={JSON.parse(JSON.stringify(materials))}
      defaultValues={{
        id: serialized.id,
        code: serialized.code,
        name: serialized.name,
        description: serialized.description || undefined,
        category: serialized.category || undefined,
        fusionFileName: serialized.fusionFileName || undefined,
        fusionFileUrl: serialized.fusionFileUrl || undefined,
        drawingNotes: serialized.drawingNotes || undefined,
        requiresPainting: serialized.requiresPainting,
        requiresLogoEngraving: serialized.requiresLogoEngraving,
        defaultColor: serialized.defaultColor || undefined,
        defaultSurfaceFinish: serialized.defaultSurfaceFinish || undefined,
        unitPrice: serialized.unitPrice ? Number(serialized.unitPrice) : undefined,
        leadTimeDays: serialized.leadTimeDays,
        cycleTimeMinutes: serialized.cycleTimeMinutes ? Number(serialized.cycleTimeMinutes) : undefined,
      }}
      existingBomLines={serialized.bomLines}
    />
  );
}
