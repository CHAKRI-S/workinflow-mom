"use client";

import { useTranslations } from "next-intl";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  CheckCircle,
} from "lucide-react";

interface ReportData {
  salesThisMonth: { total: number; count: number };
  salesThisYear: { total: number; count: number };
  completionRate: number;
  woByStatus: { status: string; count: number }[];
  overdueInvoices: {
    id: string;
    invoiceNumber: string;
    dueDate: string;
    totalAmount: number;
    customer: { name: string };
  }[];
  topProducts: { name: string; code: string; total: number; count: number }[];
  topCustomers: { name: string; code: string; total: number; count: number }[];
  machineUtilization: { name: string; code: string; count: number }[];
}

function formatAmount(val: number): string {
  return Number(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function ReportsClient({ data }: { data: ReportData }) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const tWo = useTranslations("workOrder");
  const tInv = useTranslations("invoice");

  const maxMachineCount = Math.max(
    ...data.machineUtilization.map((m) => m.count),
    1
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title={`${t("salesSummary")} — ${t("thisMonth")}`}
          value={formatAmount(data.salesThisMonth.total)}
          icon={<DollarSign className="h-4 w-4" />}
          description={`${data.salesThisMonth.count} ${t("orders")}`}
        />
        <KpiCard
          title={`${t("salesSummary")} — ${t("thisYear")}`}
          value={formatAmount(data.salesThisYear.total)}
          icon={<TrendingUp className="h-4 w-4" />}
          description={`${data.salesThisYear.count} ${t("orders")}`}
        />
        <KpiCard
          title={`${t("orders")} ${t("thisYear")}`}
          value={data.salesThisYear.count}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <KpiCard
          title={t("completionRate")}
          value={`${data.completionRate}%`}
          icon={<CheckCircle className="h-4 w-4" />}
          description={t("productionSummary")}
        />
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("topProducts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc("noData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">
                        {tc("noData") ? "" : "#"}
                      </th>
                      <th className="text-left py-2 font-medium">
                        {t("topProducts")}
                      </th>
                      <th className="text-right py-2 font-medium">
                        {tc("quantity")}
                      </th>
                      <th className="text-right py-2 font-medium">
                        {t("revenue")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((product, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2 text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2">
                          <div className="font-medium">{product.name}</div>
                          {product.code && (
                            <div className="text-xs text-muted-foreground">
                              {product.code}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {product.count}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatAmount(product.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("topCustomers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc("noData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">{""}</th>
                      <th className="text-left py-2 font-medium">
                        {t("topCustomers")}
                      </th>
                      <th className="text-right py-2 font-medium">
                        {t("orders")}
                      </th>
                      <th className="text-right py-2 font-medium">
                        {tc("total")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCustomers.map((customer, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2 text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2">
                          <div className="font-medium">{customer.name}</div>
                          {customer.code && (
                            <div className="text-xs text-muted-foreground">
                              {customer.code}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {customer.count}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatAmount(customer.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("overdueInvoices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.overdueInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc("noData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">
                        {tInv("customer")}
                      </th>
                      <th className="text-left py-2 font-medium">
                        {tInv("number")}
                      </th>
                      <th className="text-right py-2 font-medium">
                        {tInv("dueDate")}
                      </th>
                      <th className="text-right py-2 font-medium">
                        {tInv("totalAmount")}
                      </th>
                      <th className="text-right py-2 font-medium">
                        {tInv("overdue")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overdueInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2">{inv.customer.name}</td>
                        <td className="py-2 text-muted-foreground">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatAmount(Number(inv.totalAmount))}
                        </td>
                        <td className="py-2 text-right">
                          <span className="text-[#f87171] font-medium tabular-nums">
                            {daysOverdue(inv.dueDate)}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Machine Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("machineUtilization")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.machineUtilization.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc("noData")}</p>
            ) : (
              <div className="space-y-3">
                {data.machineUtilization.map((machine, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{machine.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {machine.count} WO
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{
                          width: `${(machine.count / maxMachineCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Order Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("productionSummary")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.woByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc("noData")}</p>
            ) : (
              <div className="space-y-2">
                {data.woByStatus.map((wo, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1"
                  >
                    <StatusBadge
                      status={wo.status}
                      label={tWo(`status.${wo.status}`)}
                    />
                    <span className="text-sm font-medium tabular-nums">
                      {wo.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
