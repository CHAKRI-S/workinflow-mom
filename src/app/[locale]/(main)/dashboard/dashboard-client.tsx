"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  ShoppingCart,
  Wrench,
  AlertTriangle,
  CreditCard,
  CheckCircle,
  Info,
} from "lucide-react";

interface KpiData {
  openQuotations: number;
  activeOrders: number;
  woInProgress: number;
  overdueWOs: number;
  awaitingPayment: number;
  completionRate: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  customer: { name: string };
}

export function DashboardClient({
  kpi,
  recentOrders,
  isVatRegistered,
  isAdmin,
}: {
  kpi: KpiData;
  recentOrders: RecentOrder[];
  /** Phase 8.12 — show warning banner if tenant is not VAT-registered. */
  isVatRegistered: boolean;
  isAdmin: boolean;
}) {
  const t = useTranslations("dashboard");
  const tso = useTranslations("salesOrder");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      {!isVatRegistered && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3">
          <Info className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              กิจการนี้ยังไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม (VAT)
            </p>
            <p className="text-amber-800 dark:text-amber-300/90">
              เอกสารทุกใบจะออกเป็น &quot;ใบแจ้งหนี้ / ใบส่งของ&quot; — ระบบจะไม่ยอมให้ออก
              ใบกำกับภาษี (ม.86 ประมวลรัษฎากร)
              {isAdmin && (
                <>
                  {" "}
                  เปลี่ยนได้ที่{" "}
                  <Link
                    href="/admin/settings"
                    className="font-medium underline underline-offset-2"
                  >
                    ตั้งค่าบริษัท
                  </Link>{" "}
                  เมื่อจด VAT แล้ว
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title={t("openQuotations")}
          value={kpi.openQuotations}
          icon={<FileText className="h-4 w-4" />}
          trend={kpi.openQuotations > 0 ? "up" : undefined}
        />
        <KpiCard
          title={t("activeOrders")}
          value={kpi.activeOrders}
          icon={<ShoppingCart className="h-4 w-4" />}
          trend={kpi.activeOrders > 0 ? "up" : undefined}
        />
        <KpiCard
          title={t("workOrdersInProgress")}
          value={kpi.woInProgress}
          icon={<Wrench className="h-4 w-4" />}
        />
        <KpiCard
          title={t("overdueWorkOrders")}
          value={kpi.overdueWOs}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={kpi.overdueWOs > 0 ? "down" : undefined}
          description={kpi.overdueWOs > 0 ? "ต้องเร่ง!" : undefined}
        />
        <KpiCard
          title={t("awaitingPayment")}
          value={kpi.awaitingPayment}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <KpiCard
          title={t("completionRate")}
          value={`${kpi.completionRate}%`}
          icon={<CheckCircle className="h-4 w-4" />}
          trend={kpi.completionRate >= 80 ? "up" : kpi.completionRate > 0 ? "down" : undefined}
        />
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {tso("title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/sales/orders/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <p className="font-mono font-medium text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{order.customer.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <StatusBadge
                      status={order.status}
                      label={tso(`status.${order.status}` as Parameters<typeof tso>[0])}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
