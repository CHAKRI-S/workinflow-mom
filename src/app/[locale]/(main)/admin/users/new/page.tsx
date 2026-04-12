import { auth } from "@/lib/auth";
import { requirePermission, ROLES } from "@/lib/permissions";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { UserFormClient } from "./user-form-client";

export default async function NewUserPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  requirePermission(session, ROLES.ADMIN_ONLY);

  return <UserFormClient />;
}
