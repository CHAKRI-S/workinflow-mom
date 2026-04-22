import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { ReturnClient } from "./return-client";

export default async function BillingReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ subscriptionId?: string }>;
}) {
  const { locale } = await params;
  const { subscriptionId } = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.ADMIN_ONLY)) return <AccessDenied />;

  if (!subscriptionId) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-2">ลิงก์ไม่ถูกต้อง</h1>
        <p className="text-sm text-muted-foreground">
          ไม่พบ subscriptionId ใน URL — กรุณากลับไปที่หน้า Billing แล้วลองใหม่อีกครั้ง
        </p>
      </div>
    );
  }

  // Verify this subscription belongs to the tenant before exposing the ID to client-side polling.
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, tenantId: true },
  });
  if (!sub || sub.tenantId !== session.user.tenantId) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-2">ไม่พบรายการ</h1>
        <p className="text-sm text-muted-foreground">
          ไม่พบ subscription นี้ในบัญชีของคุณ
        </p>
      </div>
    );
  }

  return <ReturnClient subscriptionId={sub.id} />;
}
