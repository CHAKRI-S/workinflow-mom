"use client";

import { useTranslations } from "next-intl";
import { ShieldX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
  const t = useTranslations();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 mb-4">
        <ShieldX className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        {t("common.accessDenied") || "ไม่มีสิทธิ์เข้าถึง"}
      </h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {t("common.accessDeniedDesc") || "คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ"}
      </p>
      <Link href="/dashboard">
        <Button variant="outline">{t("nav.dashboard")}</Button>
      </Link>
    </div>
  );
}
