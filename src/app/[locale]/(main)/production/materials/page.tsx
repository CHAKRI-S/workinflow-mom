import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MaterialListClient } from "./material-list-client";

export default async function MaterialsPage({
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
    orderBy: { code: "asc" },
  });

  return <MaterialListClient materials={JSON.parse(JSON.stringify(materials))} />;
}
