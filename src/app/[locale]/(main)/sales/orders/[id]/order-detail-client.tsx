"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  ArrowLeft,
  Edit,
  Loader2,
  XCircle,
  ChevronRight,
} from "lucide-react";

interface OrderLine {
  id: string;
  productId: string;
  product: { id: string; code: string; name: string };
  description: string | null;
  quantity: string;
  color: string | null;
  surfaceFinish: string | null;
  materialSpec: string | null;
  unitPrice: string;
  discountPercent: string;
  lineTotal: string;
  deliveredQty: string;
  notes: string | null;
  sortOrder: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  orderDate: string;
  requestedDate: string;
  promisedDate: string | null;
  status: string;
  paymentStatus: string;
  customerPoNumber: string | null;
  shippingAddress: string | null;
  depositPercent: string;
  depositAmount: string;
  subtotal: string;
  discountPercent: string;
  discountAmount: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  paymentTerms: string | null;
  notes: string | null;
  internalNotes: string | null;
  customer: {
    id: string;
    code: string;
    name: string;
    isVatRegistered: boolean;
  };
  quotation: { id: string; quotationNumber: string } | null;
  lines: OrderLine[];
  createdBy: { id: string; name: string };
}

// Valid next statuses for the dropdown
const NEXT_STATUSES: Record<string, string[]> = {
  CONFIRMED: ["DEPOSIT_PENDING", "IN_PRODUCTION"],
  DEPOSIT_PENDING: ["IN_PRODUCTION"],
  IN_PRODUCTION: ["PAINTING", "ENGRAVING", "QC_FINAL", "PACKING"],
  PAINTING: ["ENGRAVING", "QC_FINAL"],
  ENGRAVING: ["QC_FINAL"],
  QC_FINAL: ["PACKING"],
  PACKING: ["AWAITING_PAYMENT", "SHIPPED"],
  AWAITING_PAYMENT: ["SHIPPED"],
  SHIPPED: ["COMPLETED"],
};

export function OrderDetailClient({ order }: { order: OrderDetail }) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: string) => {
    return Number(amount).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!newStatus) return;
    setStatusLoading(true);

    try {
      const res = await fetch(`/api/sales/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to change status");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to change status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(t("salesOrder.confirmCancelMsg"))) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/sales/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to cancel");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to cancel");
    } finally {
      setLoading(false);
    }
  };

  const isEditable = order.status === "CONFIRMED";
  const isTerminal =
    order.status === "CANCELLED" || order.status === "COMPLETED";
  const nextStatuses = NEXT_STATUSES[order.status] || [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight font-mono">
              {order.orderNumber}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={order.status}
                label={t(`salesOrder.status.${order.status}`)}
              />
              <StatusBadge
                status={order.paymentStatus}
                label={t(`salesOrder.paymentStatus.${order.paymentStatus}`)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status transition */}
          {!isTerminal && nextStatuses.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                onValueChange={(v) => handleStatusChange(String(v ?? ""))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue
                    placeholder={t("salesOrder.statusTransition")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {nextStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        {t(`salesOrder.status.${s}`)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          )}

          {/* Edit button */}
          {isEditable && (
            <Link href={`/sales/orders/new`}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-1" />
                {t("common.edit")}
              </Button>
            </Link>
          )}

          {/* Cancel button */}
          {!isTerminal && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              {t("common.cancel")}
            </Button>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("salesOrder.orderInfo")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("salesOrder.customer")}
            </span>
            <Link
              href={`/sales/customers/${order.customer.id}`}
              className="font-medium hover:underline"
            >
              {order.customer.code} - {order.customer.name}
            </Link>

            <span className="text-muted-foreground">
              {t("salesOrder.orderDate")}
            </span>
            <span>{formatDate(order.orderDate)}</span>

            <span className="text-muted-foreground">
              {t("salesOrder.requestedDate")}
            </span>
            <span>{formatDate(order.requestedDate)}</span>

            <span className="text-muted-foreground">
              {t("salesOrder.promisedDate")}
            </span>
            <span>{formatDate(order.promisedDate)}</span>

            {order.customerPoNumber && (
              <>
                <span className="text-muted-foreground">
                  {t("salesOrder.customerPoNumber")}
                </span>
                <span>{order.customerPoNumber}</span>
              </>
            )}

            {order.quotation && (
              <>
                <span className="text-muted-foreground">
                  {t("salesOrder.quotation")}
                </span>
                <span className="font-mono text-sm">
                  {order.quotation.quotationNumber}
                </span>
              </>
            )}

            {order.paymentTerms && (
              <>
                <span className="text-muted-foreground">
                  {t("salesOrder.paymentTerms")}
                </span>
                <span>{order.paymentTerms}</span>
              </>
            )}

            <span className="text-muted-foreground">VAT</span>
            <Badge
              variant={
                order.customer.isVatRegistered ? "default" : "outline"
              }
            >
              {order.customer.isVatRegistered ? "VAT" : "Non-VAT"}
            </Badge>
          </div>

          {order.shippingAddress && (
            <>
              <Separator />
              <div>
                <span className="text-sm text-muted-foreground">
                  {t("salesOrder.shippingAddress")}
                </span>
                <p className="text-sm mt-1">{order.shippingAddress}</p>
              </div>
            </>
          )}
        </Card>

        {/* Financial Summary */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">
            {t("salesOrder.financialSummary")}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("salesOrder.subtotal")}
              </span>
              <span className="font-mono">
                {formatCurrency(order.subtotal)}
              </span>
            </div>

            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("salesOrder.discount")} ({order.discountPercent}%)
                </span>
                <span className="font-mono text-red-600">
                  -{formatCurrency(order.discountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("salesOrder.vatAmount")} ({order.vatRate}%)
              </span>
              <span className="font-mono">
                {formatCurrency(order.vatAmount)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between font-semibold text-base">
              <span>{t("salesOrder.totalAmount")}</span>
              <span className="font-mono">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>

            {Number(order.depositPercent) > 0 && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("salesOrder.depositAmount")} ({order.depositPercent}%)
                  </span>
                  <span className="font-mono">
                    {formatCurrency(order.depositAmount)}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">
          {t("salesOrder.lines")} ({order.lines.length})
        </h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t("salesOrder.product")}</TableHead>
                <TableHead>{t("salesOrder.description")}</TableHead>
                <TableHead className="text-right">
                  {t("salesOrder.quantity")}
                </TableHead>
                <TableHead className="text-right">
                  {t("salesOrder.unitPrice")}
                </TableHead>
                <TableHead className="text-right">
                  {t("salesOrder.discountPercent")}
                </TableHead>
                <TableHead className="text-right">
                  {t("salesOrder.lineTotal")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((line, index) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{line.product.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {line.product.code}
                      </div>
                      {(line.color || line.surfaceFinish || line.materialSpec) && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {line.color && (
                            <Badge variant="outline" className="text-xs">
                              {line.color}
                            </Badge>
                          )}
                          {line.surfaceFinish && (
                            <Badge variant="outline" className="text-xs">
                              {line.surfaceFinish}
                            </Badge>
                          )}
                          {line.materialSpec && (
                            <Badge variant="outline" className="text-xs">
                              {line.materialSpec}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {line.description || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(line.quantity).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(line.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(line.discountPercent) > 0
                      ? `${line.discountPercent}%`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(line.lineTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Notes */}
      {(order.notes || order.internalNotes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {order.notes && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-2">
                {t("common.notes")}
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {order.notes}
              </p>
            </Card>
          )}
          {order.internalNotes && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-2">
                {t("salesOrder.internalNotes")}
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {order.internalNotes}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        {t("common.create")}: {order.createdBy.name} |{" "}
        {formatDate(order.orderDate)}
      </div>
    </div>
  );
}
