"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  RotateCcw,
  Ban,
  ShoppingCart,
  Pencil,
  Loader2,
} from "lucide-react";

interface QuotationLine {
  id: string;
  productId: string;
  product: { id: string; code: string; name: string; unit?: string };
  description?: string;
  quantity: string;
  color?: string;
  surfaceFinish?: string;
  materialSpec?: string;
  unitPrice: string;
  discountPercent: string;
  lineTotal: string;
  notes?: string;
  sortOrder: number;
}

interface QuotationDetail {
  id: string;
  quotationNumber: string;
  revision: number;
  status: string;
  issueDate: string;
  validUntil: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  leadTimeDays?: number;
  subtotal: string;
  discountPercent: string;
  discountAmount: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  notes?: string;
  internalNotes?: string;
  customer: {
    id: string;
    code: string;
    name: string;
    isVatRegistered: boolean;
    contactName?: string;
    phone?: string;
    email?: string;
  };
  createdBy: { id: string; name: string };
  lines: QuotationLine[];
  _count: { salesOrders: number };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary",
  SENT: "default",
  REVISED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  EXPIRED: "destructive",
  CANCELLED: "destructive",
};

export function QuotationDetailClient({
  quotation,
}: {
  quotation: QuotationDetail;
}) {
  const t = useTranslations("quotation");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    status: string;
  }>({ open: false, action: "", status: "" });

  const changeStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/quotations/${quotation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error");
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: "", status: "" });
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/quotations/${quotation.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel");
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error");
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: "", status: "" });
    }
  };

  const openConfirm = (action: string, status: string) => {
    setConfirmDialog({ open: true, action, status });
  };

  const canEdit =
    quotation.status === "DRAFT" || quotation.status === "REVISED";
  const canSend =
    quotation.status === "DRAFT" || quotation.status === "REVISED";
  const canApprove = quotation.status === "SENT";
  const canReject = quotation.status === "SENT";
  const canRevise =
    quotation.status !== "CANCELLED" && quotation.status !== "DRAFT";
  const canCancel =
    quotation.status === "DRAFT" ||
    quotation.status === "SENT" ||
    quotation.status === "REVISED";
  const canConvert =
    quotation.status === "APPROVED" && quotation._count.salesOrders === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales/quotations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              {quotation.quotationNumber}
              {quotation.revision > 1 && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  {t("revision")} {quotation.revision}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              {quotation.customer.name} ({quotation.customer.code})
            </p>
          </div>
          <Badge
            variant={
              STATUS_COLORS[quotation.status] as
                | "default"
                | "secondary"
                | "destructive"
                | "outline"
            }
          >
            {t(`status.${quotation.status}` as Parameters<typeof t>[0])}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link href={`/sales/quotations/${quotation.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                {tc("edit")}
              </Button>
            </Link>
          )}
          {canSend && (
            <Button
              size="sm"
              onClick={() => openConfirm("send", "SENT")}
              disabled={loading}
            >
              <Send className="mr-2 h-4 w-4" />
              {t("send")}
            </Button>
          )}
          {canApprove && (
            <Button
              size="sm"
              variant="default"
              onClick={() => openConfirm("approve", "APPROVED")}
              disabled={loading}
            >
              <Check className="mr-2 h-4 w-4" />
              {t("approve")}
            </Button>
          )}
          {canReject && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => openConfirm("reject", "REJECTED")}
              disabled={loading}
            >
              <X className="mr-2 h-4 w-4" />
              {t("reject")}
            </Button>
          )}
          {canRevise && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openConfirm("revise", "REVISED")}
              disabled={loading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("revise")}
            </Button>
          )}
          {canConvert && (
            <Link href={`/sales/orders/new?fromQuotation=${quotation.id}`}>
              <Button size="sm" variant="default">
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t("convertToOrder")}
              </Button>
            </Link>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openConfirm("cancel", "CANCELLED")}
              disabled={loading}
            >
              <Ban className="mr-2 h-4 w-4" />
              {t("cancel")}
            </Button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("customer")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("customer")}</span>
              <span className="font-medium">
                {quotation.customer.name} ({quotation.customer.code})
              </span>
            </div>
            {quotation.customer.contactName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {tc("notes")}
                </span>
                <span>{quotation.customer.contactName}</span>
              </div>
            )}
            {quotation.customer.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {quotation.customer.phone}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("vatRate")}</span>
              <span>{Number(quotation.vatRate)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("issueDate")}</span>
              <span>
                {new Date(quotation.issueDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("validUntil")}</span>
              <span>
                {new Date(quotation.validUntil).toLocaleDateString()}
              </span>
            </div>
            {quotation.paymentTerms && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("paymentTerms")}
                </span>
                <span>{quotation.paymentTerms}</span>
              </div>
            )}
            {quotation.deliveryTerms && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("deliveryTerms")}
                </span>
                <span>{quotation.deliveryTerms}</span>
              </div>
            )}
            {quotation.leadTimeDays != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("leadTime")}</span>
                <span>
                  {quotation.leadTimeDays} {t("days")}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("revision")}</span>
              <span>{quotation.revision}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t("product")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead>{t("color")}</TableHead>
                  <TableHead>{t("surfaceFinish")}</TableHead>
                  <TableHead className="text-right">
                    {t("unitPrice")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("discountPercent")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("lineTotal")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.lines.map((line, idx) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{line.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.product.code}
                      </div>
                    </TableCell>
                    <TableCell>{line.description || "-"}</TableCell>
                    <TableCell className="text-right">
                      {Number(line.quantity).toLocaleString()}{" "}
                      {line.product.unit && (
                        <span className="text-xs text-muted-foreground">
                          {line.product.unit}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{line.color || "-"}</TableCell>
                    <TableCell>{line.surfaceFinish || "-"}</TableCell>
                    <TableCell className="text-right">
                      {Number(line.unitPrice).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(line.discountPercent) > 0
                        ? `${Number(line.discountPercent)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(line.lineTotal).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span className="font-medium">
                  {Number(quotation.subtotal).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {Number(quotation.discountPercent) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {t("discount")} ({Number(quotation.discountPercent)}%)
                  </span>
                  <span>
                    -
                    {Number(quotation.discountAmount).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 }
                    )}
                  </span>
                </div>
              )}
              {Number(quotation.vatRate) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {t("vatAmount")} ({Number(quotation.vatRate)}%)
                  </span>
                  <span>
                    {Number(quotation.vatAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <span>{t("totalAmount")}</span>
                <span>
                  {Number(quotation.totalAmount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(quotation.notes || quotation.internalNotes) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {quotation.notes && (
            <Card>
              <CardHeader>
                <CardTitle>{tc("notes")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{quotation.notes}</p>
              </CardContent>
            </Card>
          )}
          {quotation.internalNotes && (
            <Card>
              <CardHeader>
                <CardTitle>{t("internalNotes")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {quotation.internalNotes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog({ open: false, action: "", status: "" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmStatusChange")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDialog.action === "cancel"
              ? t("confirmCancel")
              : t("confirmStatusChange")}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog({ open: false, action: "", status: "" })
              }
              disabled={loading}
            >
              {tc("cancel")}
            </Button>
            <Button
              onClick={() => {
                if (confirmDialog.action === "cancel") {
                  handleCancel();
                } else {
                  changeStatus(confirmDialog.status);
                }
              }}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
