import { auth } from "@/lib/auth";
import { requirePermission, ROLES } from "@/lib/permissions";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ConsumableFormClient } from "./consumable-form-client";

export default async function NewConsumablePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  requirePermission(session, ROLES.PLANNING);

  return <ConsumableFormClient />;
}
