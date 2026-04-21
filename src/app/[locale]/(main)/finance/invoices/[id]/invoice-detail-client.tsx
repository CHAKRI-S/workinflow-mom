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
import { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Loader2,
  XCircle,
  ChevronRight,
  FileText,
  Receipt,
  CreditCard,
  Save,
} from "lucide-react";
import { BillingNaturePicker } from "@/components/tax/billing-nature-picker";
import { DrawingSourceRow } from "@/components/tax/drawing-source-row";
import { suggestBillingNature } from "@/lib/validators/billing-nature";
import type {
  BillingNature,
  DrawingSource,
} from "@/lib/validators/billing-nature";

interface InvoiceLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
  sortOrder: number;
  drawingSource?: DrawingSource | null;
  lineBillingNature?: BillingNature | null;
  productCode?: string | null;
  drawingRevision?: string | null;
  customerDrawingUrl?: string | null;
}

interface RelatedTaxInvoice {
  id: string;
  taxInvoiceNumber: string;
  status: string;
  totalAmount: string;
  issueDate: string;
}

interface RelatedReceipt {
  id: string;
  receiptNumber: string;
  status: string;
  amount: string;
  issueDate: string;
}

interface RelatedCreditNote {
  id: string;
  creditNoteNumber: string;
  status: string;
  totalAmount: string;
  issueDate: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  discountAmount: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  paidAmount: string;
  notes: string | null;
  billingNature?: BillingNature | null;
  whtRate?: string | null;
  whtCertStatus?: string | null;
  customer: {
    id: string;
    code: string;
    name: string;
    isVatRegistered: boolean;
    taxId: string | null;
    billingAddress: string | null;
  };
  salesOrder: { id: string; orderNumber: string };
  lines: InvoiceLine[];
  taxInvoices: RelatedTaxInvoice[];
  receipts: RelatedReceipt[];
  creditNotes: RelatedCreditNote[];
  createdBy: { id: string; name: string };
  createdAt?: string;
}

const NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ["ISSUED"],
  ISSUED: ["SENT", "CANCELLED"],
  SENT: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "CANCELLED"],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "CANCELLED"],
};

export function InvoiceDetailClient({
  invoice,
}: {
  invoice: InvoiceDetail;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [taxSaving, setTaxSaving] = useState(false);

  const canEditTax = invoice.status === "DRAFT";
  const [billingNature, setBillingNature] = useState<BillingNature>(
    (invoice.billingNature as BillingNature) ?? "GOODS"
  );
  const [lineEdits, setLineEdits] = useState(() =>
    invoice.lines.map((l) => ({
      id: l.id,
      drawingSource: (l.drawingSource as DrawingSource) ?? "TENANT_OWNED",
      productCode: l.productCode ?? "",
      drawingRevision: l.drawingRevision ?? "",
      customerDrawingUrl: l.customerDrawingUrl ?? "",
    }))
  );

  // Re-sync state if the invoice prop changes (e.g. after router.refresh())
  useEffect(() => {
    setBillingNature((invoice.billingNature as BillingNature) ?? "GOODS");
    setLineEdits(
      invoice.lines.map((l) => ({
        id: l.id,
        drawingSource: (l.drawingSource as DrawingSource) ?? "TENANT_OWNED",
        productCode: l.productCode ?? "",
        drawingRevision: l.drawingRevision ?? "",
        customerDrawingUrl: l.customerDrawingUrl ?? "",
      }))
    );
  }, [invoice]);

  const suggestedBillingNature = useMemo(
    () =>
      suggestBillingNature(
        lineEdits.map((l) => ({ drawingSource: l.drawingSource }))
      ),
    [lineEdits]
  );

  const updateLineEdit = (
    index: number,
    patch: Partial<(typeof lineEdits)[number]>
  ) => {
    setLineEdits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleSaveTaxPolicy = async () => {
    setTaxSaving(true);
    try {
      const res = await fetch(`/api/finance/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingNature,
          lines: lineEdits.map((l) => ({
            id: l.id,
            drawingSource: l.drawingSource,
            productCode: l.productCode || null,
            drawingRevision: l.drawingRevision || null,
            customerDrawingUrl: l.customerDrawingUrl || null,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to save tax policy");
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to save tax policy");
    } finally {
      setTaxSaving(false);
    }
  };

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
    if (!newStatus) return;
    setStatusLoading(true);

    try {
      const res = await fetch(`/api/finance/invoices/${invoice.id}`, {
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
    if (!confirm(t("common.confirm") + "?")) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/finance/invoices/${invoice.id}`, {
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

  const isTerminal =
    invoice.status === "CANCELLED" || invoice.status === "PAID";
  const nextStatuses = NEXT_STATUSES[invoice.status] || [];
  const balance =
    Number(invoice.totalAmount) - Number(invoice.paidAmount);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight font-mono">
              {invoice.invoiceNumber}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={invoice.status}
                label={t(`invoice.status.${invoice.status}`)}
              />
              <Badge variant="outline">
                {t(`invoice.invoiceType.${invoice.invoiceType}`)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isTerminal && nextStatuses.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                onValueChange={(v) => handleStatusChange(String(v ?? ""))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("salesOrder.statusTransition")} />
                </SelectTrigger>
                <SelectContent>
                  {nextStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        {t(`invoice.status.${s}`)}
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

      {/* Invoice Info + Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("invoice.number")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("invoice.customer")}
            </span>
            <Link
              href={`/sales/customers/${invoice.customer.id}`}
              className="font-medium hover:underline"
            >
              {invoice.customer.code} - {invoice.customer.name}
            </Link>

            <span className="text-muted-foreground">
              {t("invoice.salesOrder")}
            </span>
            <Link
              href={`/sales/orders/${invoice.salesOrder.id}`}
              className="font-mono text-sm hover:underline"
            >
              {invoice.salesOrder.orderNumber}
            </Link>

            <span className="text-muted-foreground">
              {t("invoice.type")}
            </span>
            <span>{t(`invoice.invoiceType.${invoice.invoiceType}`)}</span>

            <span className="text-muted-foreground">
              {t("invoice.issueDate")}
            </span>
            <span>{formatDate(invoice.issueDate)}</span>

            <span className="text-muted-foreground">
              {t("invoice.dueDate")}
            </span>
            <span>{formatDate(invoice.dueDate)}</span>

            <span className="text-muted-foreground">VAT</span>
            <Badge
              variant={
                invoice.customer.isVatRegistered ? "default" : "outline"
              }
            >
              {invoice.customer.isVatRegistered ? "VAT" : "Non-VAT"}
            </Badge>
          </div>
        </Card>

        {/* Financial Summary */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">
            {t("salesOrder.financialSummary")}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("common.subtotal")}
              </span>
              <span className="font-mono">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>

            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("common.discount")}
                </span>
                <span className="font-mono text-red-600">
                  -{formatCurrency(invoice.discountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("common.vat")} ({invoice.vatRate}%)
              </span>
              <span className="font-mono">
                {formatCurrency(invoice.vatAmount)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between font-semibold text-base">
              <span>{t("common.grandTotal")}</span>
              <span className="font-mono">
                {formatCurrency(invoice.totalAmount)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("invoice.paidAmount")}
              </span>
              <span className="font-mono text-green-600">
                {formatCurrency(invoice.paidAmount)}
              </span>
            </div>

            <div className="flex justify-between font-semibold">
              <span>{t("invoice.balance")}</span>
              <span
                className={`font-mono ${balance > 0 ? "text-orange-500" : "text-green-600"}`}
              >
                {formatCurrency(String(balance))}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tax Policy (Billing Nature + Drawing Source) */}
      {canEditTax ? (
        <div className="space-y-3">
          <BillingNaturePicker
            value={billingNature}
            suggestion={suggestedBillingNature}
            onChange={setBillingNature}
          />
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">
                แบบงาน / Drawing source per line
              </h2>
              <Button
                size="sm"
                onClick={handleSaveTaxPolicy}
                disabled={taxSaving}
              >
                {taxSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {t("common.save")}
              </Button>
            </div>
            <details>
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                แสดง/ซ่อน drawing source ของแต่ละบรรทัด
              </summary>
              <div className="mt-3 space-y-3">
                {invoice.lines.map((line, index) => {
                  const edit = lineEdits[index];
                  if (!edit) return null;
                  return (
                    <div
                      key={line.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <p className="text-xs text-muted-foreground">
                        #{index + 1} {line.description}
                      </p>
                      <DrawingSourceRow
                        value={edit.drawingSource}
                        onChange={(v) =>
                          updateLineEdit(index, { drawingSource: v })
                        }
                        productCode={edit.productCode}
                        drawingRevision={edit.drawingRevision}
                        customerDrawingUrl={edit.customerDrawingUrl}
                        onProductCodeChange={(v) =>
                          updateLineEdit(index, { productCode: v })
                        }
                        onDrawingRevisionChange={(v) =>
                          updateLineEdit(index, { drawingRevision: v })
                        }
                        onCustomerDrawingUrlChange={(v) =>
                          updateLineEdit(index, { customerDrawingUrl: v })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </details>
          </Card>
        </div>
      ) : (
        invoice.billingNature && (
          <Card className="p-4 space-y-2">
            <h2 className="font-semibold text-sm">นโยบายภาษีเอกสาร</h2>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">
                {invoice.billingNature === "GOODS"
                  ? "ขายสินค้า"
                  : invoice.billingNature === "MANUFACTURING_SERVICE"
                    ? "รับจ้างทำของ"
                    : "ผสม"}
              </Badge>
              {Number(invoice.whtRate ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 text-amber-700"
                >
                  WHT {invoice.whtRate}% · {invoice.whtCertStatus ?? "PENDING"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              แก้ไขได้เฉพาะตอน status = DRAFT เท่านั้น
            </p>
          </Card>
        )
      )}

      {/* Line Items */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">
          {t("salesOrder.lines")} ({invoice.lines.length})
        </h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t("salesOrder.description")}</TableHead>
                <TableHead className="text-right">
                  {t("common.quantity")}
                </TableHead>
                <TableHead className="text-right">
                  {t("salesOrder.unitPrice")}
                </TableHead>
                <TableHead className="text-right">
                  {t("salesOrder.lineTotal")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((line, index) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(line.quantity).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(line.unitPrice)}
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

      {/* Related Documents */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tax Invoices */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">
              {t("taxInvoice.title")} ({invoice.taxInvoices.length})
            </h3>
          </div>
          {invoice.taxInvoices.length > 0 ? (
            <div className="space-y-2">
              {invoice.taxInvoices.map((ti) => (
                <Link
                  key={ti.id}
                  href={`/finance/tax-invoices/${ti.id}`}
                  className="block p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">
                      {ti.taxInvoiceNumber}
                    </span>
                    <StatusBadge
                      status={ti.status}
                      label={t(`taxInvoice.status.${ti.status}`)}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>{formatDate(ti.issueDate)}</span>
                    <span className="font-mono">
                      {formatCurrency(ti.totalAmount)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
          )}
        </Card>

        {/* Receipts */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">
              {t("receipt.title")} ({invoice.receipts.length})
            </h3>
          </div>
          {invoice.receipts.length > 0 ? (
            <div className="space-y-2">
              {invoice.receipts.map((rc) => (
                <Link
                  key={rc.id}
                  href={`/finance/receipts/${rc.id}`}
                  className="block p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">
                      {rc.receiptNumber}
                    </span>
                    <StatusBadge
                      status={rc.status}
                      label={t(`receipt.status.${rc.status}`)}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>{formatDate(rc.issueDate)}</span>
                    <span className="font-mono">
                      {formatCurrency(rc.amount)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
          )}
        </Card>

        {/* Credit Notes */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">
              {t("creditNote.title")} ({invoice.creditNotes.length})
            </h3>
          </div>
          {invoice.creditNotes.length > 0 ? (
            <div className="space-y-2">
              {invoice.creditNotes.map((cn) => (
                <Link
                  key={cn.id}
                  href={`/finance/credit-notes/${cn.id}`}
                  className="block p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">
                      {cn.creditNoteNumber}
                    </span>
                    <StatusBadge
                      status={cn.status}
                      label={t(`creditNote.status.${cn.status}`)}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>{formatDate(cn.issueDate)}</span>
                    <span className="font-mono">
                      {formatCurrency(cn.totalAmount)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
          )}
        </Card>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("common.notes")}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {invoice.notes}
          </p>
        </Card>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        {t("common.create")}: {invoice.createdBy.name} |{" "}
        {formatDate(invoice.issueDate)}
      </div>
    </div>
  );
}
