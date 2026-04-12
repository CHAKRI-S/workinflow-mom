"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  XCircle,
  PackageCheck,
  Truck,
  PackageOpen,
  Send,
} from "lucide-react";

interface POLine {
  id: string;
  materialId: string | null;
  material: { id: string; code: string; name: string; unit: string } | null;
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
  lineTotal: string;
  receivedQty: string;
  notes: string | null;
  sortOrder: number;
}

interface PODetail {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierContact: string | null;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  receivedDate: string | null;
  notes: string | null;
  totalAmount: string;
  lines: POLine[];
}

// Valid status transitions
const STATUS_ACTIONS: Record<
  string,
  { status: string; labelKey: string; icon: React.ReactNode }[]
> = {
  DRAFT: [
    {
      status: "ORDERED",
      labelKey: "purchaseOrder.action.markOrdered",
      icon: <Send className="h-4 w-4 mr-1" />,
    },
  ],
  ORDERED: [
    {
      status: "PARTIALLY_RECEIVED",
      labelKey: "purchaseOrder.action.markPartiallyReceived",
      icon: <PackageOpen className="h-4 w-4 mr-1" />,
    },
    {
      status: "RECEIVED",
      labelKey: "purchaseOrder.action.markReceived",
      icon: <PackageCheck className="h-4 w-4 mr-1" />,
    },
  ],
  PARTIALLY_RECEIVED: [
    {
      status: "RECEIVED",
      labelKey: "purchaseOrder.action.markReceived",
      icon: <PackageCheck className="h-4 w-4 mr-1" />,
    },
  ],
};

export function PODetailClient({
  purchaseOrder,
}: {
  purchaseOrder: PODetail;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: string) => {
    return Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(newStatus);
    try {
      const res = await fetch(
        `/api/procurement/purchase-orders/${purchaseOrder.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to change status");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to change status");
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm(t("purchaseOrder.confirmCancel"))) return;
    setLoading("CANCELLED");
    try {
      const res = await fetch(
        `/api/procurement/purchase-orders/${purchaseOrder.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to cancel");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to cancel");
    } finally {
      setLoading(null);
    }
  };

  const isTerminal =
    purchaseOrder.status === "CANCELLED" ||
    purchaseOrder.status === "RECEIVED";
  const actions = STATUS_ACTIONS[purchaseOrder.status] || [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/procurement/purchase-orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight font-mono">
              {purchaseOrder.poNumber}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={purchaseOrder.status}
                label={t(`purchaseOrder.status.${purchaseOrder.status}`)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status action buttons */}
          {actions.map((action) => (
            <Button
              key={action.status}
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange(action.status)}
              disabled={loading !== null}
            >
              {loading === action.status ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                action.icon
              )}
              {t(action.labelKey)}
            </Button>
          ))}

          {/* Cancel button */}
          {!isTerminal && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={loading !== null}
            >
              {loading === "CANCELLED" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              {t("common.cancel")}
            </Button>
          )}
        </div>
      </div>

      {/* PO Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("purchaseOrder.poInfo")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("purchaseOrder.number")}
            </span>
            <span className="font-mono font-medium">
              {purchaseOrder.poNumber}
            </span>

            <span className="text-muted-foreground">
              {t("purchaseOrder.supplierName")}
            </span>
            <span className="font-medium">{purchaseOrder.supplierName}</span>

            {purchaseOrder.supplierContact && (
              <>
                <span className="text-muted-foreground">
                  {t("purchaseOrder.supplierContact")}
                </span>
                <span>{purchaseOrder.supplierContact}</span>
              </>
            )}

            <span className="text-muted-foreground">
              {t("common.status")}
            </span>
            <StatusBadge
              status={purchaseOrder.status}
              label={t(`purchaseOrder.status.${purchaseOrder.status}`)}
            />

            <span className="text-muted-foreground">
              {t("purchaseOrder.orderDate")}
            </span>
            <span>{formatDate(purchaseOrder.orderDate)}</span>

            <span className="text-muted-foreground">
              {t("purchaseOrder.expectedDate")}
            </span>
            <span>{formatDate(purchaseOrder.expectedDate)}</span>

            {purchaseOrder.receivedDate && (
              <>
                <span className="text-muted-foreground">
                  {t("purchaseOrder.receivedDate")}
                </span>
                <span>{formatDate(purchaseOrder.receivedDate)}</span>
              </>
            )}
          </div>
        </Card>

        {/* Total Card */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("purchaseOrder.totalAmount")}</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold font-mono">
              {formatCurrency(purchaseOrder.totalAmount)}
            </span>
          </div>

          {purchaseOrder.notes && (
            <>
              <Separator />
              <div>
                <span className="text-sm text-muted-foreground">
                  {t("common.notes")}
                </span>
                <p className="text-sm mt-1 whitespace-pre-wrap">
                  {purchaseOrder.notes}
                </p>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Line Items */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">
          {t("purchaseOrder.lines")} ({purchaseOrder.lines.length})
        </h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t("purchaseOrder.description")}</TableHead>
                <TableHead>{t("purchaseOrder.material")}</TableHead>
                <TableHead className="text-right">
                  {t("purchaseOrder.quantity")}
                </TableHead>
                <TableHead>{t("purchaseOrder.unit")}</TableHead>
                <TableHead className="text-right">
                  {t("purchaseOrder.unitCost")}
                </TableHead>
                <TableHead className="text-right">
                  {t("purchaseOrder.lineTotal")}
                </TableHead>
                <TableHead className="text-right">
                  {t("purchaseOrder.receivedQty")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.lines.map((line, index) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {line.description}
                    {line.notes && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {line.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {line.material ? (
                      <div>
                        <div className="text-sm">{line.material.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {line.material.code}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(line.quantity).toLocaleString()}
                  </TableCell>
                  <TableCell>{line.unit}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(line.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(line.lineTotal)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(line.receivedQty).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}

              {/* Total row */}
              <TableRow className="font-semibold">
                <TableCell colSpan={6} className="text-right">
                  {t("purchaseOrder.totalAmount")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(purchaseOrder.totalAmount)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
