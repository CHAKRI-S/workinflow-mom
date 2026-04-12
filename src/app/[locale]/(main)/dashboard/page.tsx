import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { KpiCard } from "@/components/shared/kpi-card";
import {
  FileText,
  ShoppingCart,
  Wrench,
  AlertTriangle,
  CreditCard,
  CheckCircle,
} from "lucide-react";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DashboardContent />;
}

function DashboardContent() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title={t("openQuotations")}
          value={0}
          icon={<FileText className="h-4 w-4" />}
          description="--"
        />
        <KpiCard
          title={t("activeOrders")}
          value={0}
          icon={<ShoppingCart className="h-4 w-4" />}
          description="--"
        />
        <KpiCard
          title={t("workOrdersInProgress")}
          value={0}
          icon={<Wrench className="h-4 w-4" />}
          description="--"
        />
        <KpiCard
          title={t("overdueWorkOrders")}
          value={0}
          icon={<AlertTriangle className="h-4 w-4" />}
          description="--"
        />
        <KpiCard
          title={t("awaitingPayment")}
          value={0}
          icon={<CreditCard className="h-4 w-4" />}
          description="--"
        />
        <KpiCard
          title={t("completionRate")}
          value="--"
          icon={<CheckCircle className="h-4 w-4" />}
          description="--"
        />
      </div>
    </div>
  );
}
