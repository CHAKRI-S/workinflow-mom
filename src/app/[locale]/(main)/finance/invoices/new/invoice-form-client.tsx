"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { calculateDocumentTotals } from "@/lib/document-tax-propagation";
import { formatMoney, getCurrencyLabel, type CurrencyCode } from "@/lib/currency";
import { getTaxTypeLabelTh, type DocumentTaxType } from "@/lib/tax-type";
import { getInvoiceTypeLabelTh } from "@/lib/select-labels";
import type { VatPriceMode } from "@/lib/vat";

interface SOLine {
  id: string;
  description: string | null;
  quantity: string;
  enteredUnitPrice?: string | null;
  unitPrice: string;
  vatPriceMode?: VatPriceMode | null;
  lineTotal: string;
  notes: string | null;
  sortOrder: number;
  product: { id: string; name: string };
}

interface SalesOrderOption {
  id: string;
  orderNumber: string;
  totalAmount: string;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  discountAmount: string;
  depositAmount: string;
  taxType: DocumentTaxType;
  currencyCode: CurrencyCode;
  customer: {
    id: string;
    code: string;
    name: string;
    isVatRegistered: boolean;
    withholdsTax?: boolean;
  };
  lines: SOLine[];
}

interface InvoiceLineDraft {
  salesOrderLineId: string;
  description: string;
  quantity: number;
  enteredUnitPrice: number;
  unitPrice: number;
  vatPriceMode: VatPriceMode;
  lineTotal: number;
  notes: string | null;
  sortOrder: number;
}

const INVOICE_TYPES = ["DEPOSIT", "FULL", "REMAINING", "PARTIAL"] as const;

function getSalesOrderOptionLabel(
  salesOrders: SalesOrderOption[],
  value: string | null | undefined
): string {
  if (!value) return "";
  const salesOrder = salesOrders.find((so) => so.id === value);
  if (!salesOrder) return "ไม่พบใบสั่งขายที่เลือก";
  return `${salesOrder.orderNumber} — ${salesOrder.customer.name} · ${formatMoney(Number(salesOrder.totalAmount), salesOrder.currencyCode)}`;
}

export function InvoiceFormClient({
  salesOrders,
}: {
  salesOrders: SalesOrderOption[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [selectedSOId, setSelectedSOId] = useState<string>("");
  const [invoiceType, setInvoiceType] = useState<string>("FULL");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [lineDrafts, setLineDrafts] = useState<InvoiceLineDraft[]>([]);

  const selectedSO = useMemo(() => {
    return salesOrders.find((so) => so.id === selectedSOId) ?? null;
  }, [salesOrders, selectedSOId]);

  // Initialize line drafts + billing nature from selected SO (snapshot/inherit)
  useEffect(() => {
    if (!selectedSO) {
      setLineDrafts([]);
      return;
    }
    const drafts: InvoiceLineDraft[] = selectedSO.lines.map((line) => ({
      salesOrderLineId: line.id,
      description: line.description || line.product.name,
      quantity: Number(line.quantity),
      enteredUnitPrice: Number(line.enteredUnitPrice ?? line.unitPrice),
      unitPrice: Number(line.enteredUnitPrice ?? line.unitPrice),
      vatPriceMode: line.vatPriceMode ?? "EXCLUSIVE",
      lineTotal: Number(line.lineTotal),
      notes: line.notes,
      sortOrder: line.sortOrder,
    }));
    setLineDrafts(drafts);
  }, [selectedSO]);

  // Calculate totals
  const { subtotal, vatRate, vatAmount, totalAmount, vatSummary, calculatedLines } = useMemo(() => {
    if (!selectedSO || lineDrafts.length === 0) {
      return {
        subtotal: 0,
        vatRate: 0,
        vatAmount: 0,
        totalAmount: 0,
        vatSummary: {
          EXCLUSIVE: { count: 0, subtotal: 0 },
          INCLUSIVE: { count: 0, subtotal: 0 },
        },
        calculatedLines: [],
      };
    }

    const totals = calculateDocumentTotals({
      taxType: selectedSO.taxType,
      currencyCode: selectedSO.currencyCode,
      lines: lineDrafts,
    });

    return {
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      vatSummary: totals.modeSummary,
      calculatedLines: totals.lines,
    };
  }, [selectedSO, lineDrafts]);

  const formatCurrency = (amount: number) => {
    return formatMoney(amount, selectedSO?.currencyCode ?? "THB");
  };

  const handleSubmit = async () => {
    if (!selectedSOId) {
      alert(t("invoice.selectSalesOrder"));
      return;
    }
    if (!dueDate) {
      alert(t("invoice.dueDate"));
      return;
    }
    if (!selectedSO) return;
    if (lineDrafts.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderId: selectedSOId,
          invoiceType,
          dueDate,
          taxType: selectedSO.taxType,
          currencyCode: selectedSO.currencyCode,
          lines: lineDrafts.map((l) => ({
            salesOrderLineId: l.salesOrderLineId,
            description: l.description,
            quantity: l.quantity,
            enteredUnitPrice: l.enteredUnitPrice,
            unitPrice: l.enteredUnitPrice,
            vatPriceMode: l.vatPriceMode,
            notes: l.notes,
            sortOrder: l.sortOrder,
          })),
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create invoice");
        return;
      }

      const data = await res.json();
      router.push(`/finance/invoices/${data.id}`);
    } catch {
      alert("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  // Default due date 30 days from now
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/finance/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {t("invoice.new")}
        </h1>
      </div>

      {/* Sales Order Selection */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">{t("invoice.createFromSO")}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("invoice.selectSalesOrder")}</Label>
            <Select
              value={selectedSOId}
              onValueChange={(v) => setSelectedSOId(String(v ?? ""))}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("invoice.selectSalesOrder")}
                >
                  {(value) =>
                    getSalesOrderOptionLabel(salesOrders, value) ||
                    t("invoice.selectSalesOrder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {salesOrders.map((so) => (
                  <SelectItem key={so.id} value={so.id}>
                    {getSalesOrderOptionLabel(salesOrders, so.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("invoice.type")}</Label>
            <Select
              value={invoiceType}
              onValueChange={(v) => setInvoiceType(String(v ?? "FULL"))}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value) => getInvoiceTypeLabelTh(value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getInvoiceTypeLabelTh(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("invoice.dueDate")}</Label>
            <Input
              type="date"
              value={dueDate || defaultDueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {selectedSO && (
            <div className="space-y-2">
              <Label>{t("invoice.customer")}</Label>
              <div className="text-sm p-2 bg-muted rounded-xl">
                {selectedSO.customer.code} - {selectedSO.customer.name}
                {selectedSO.customer.isVatRegistered && (
                  <span className="ml-2 text-xs text-blue-600 font-medium">
                    VAT
                  </span>
                )}
                {selectedSO.customer.withholdsTax && (
                  <span className="ml-2 text-xs text-amber-700 font-medium">
                    WHT 3%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {selectedSO && (
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>ประเภทภาษีจาก Sales Order</Label>
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{getTaxTypeLabelTh(selectedSO.taxType)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ใบแจ้งหนี้นี้สืบทอดประเภทภาษีจาก Sales Order: รวม VAT / แยก VAT / ไม่มี VAT
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>สกุลเงินจาก Sales Order</Label>
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {selectedSO.currencyCode} — {getCurrencyLabel(selectedSO.currencyCode)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ตัวอย่างยอดรวมจะใช้สกุลเงินเดียวกับเอกสารต้นทาง
                </p>
              </div>
            </div>
            <div className="rounded-md border p-3 text-sm text-muted-foreground md:col-span-2">
              <div className="flex justify-between">
                <span>รายการ VAT นอก</span>
                <span>{vatSummary.EXCLUSIVE.count}</span>
              </div>
              <div className="flex justify-between">
                <span>รายการ VAT ใน</span>
                <span>{vatSummary.INCLUSIVE.count}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Lines from SO */}
      {selectedSO && lineDrafts.length > 0 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">
            {t("invoice.title")} ({lineDrafts.length})
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{t("creditNote.description")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.quantity")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("invoice.totalAmount")}
                  </TableHead>
                  <TableHead className="w-32">VAT</TableHead>
                  <TableHead className="text-right">
                    {t("common.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineDrafts.map((line, index) => {
                  const calculatedLine = calculatedLines[index];
                  const effectiveMode =
                    calculatedLine?.vatPriceMode ?? line.vatPriceMode;
                  return (
                    <TableRow key={line.salesOrderLineId}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {line.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(line.enteredUnitPrice)}
                      </TableCell>
                      <TableCell>
                        <div className="rounded-md border bg-muted/40 px-2 py-1 text-xs">
                          {selectedSO.taxType === "NO_VAT"
                            ? "ไม่มี VAT"
                            : effectiveMode === "INCLUSIVE"
                              ? "รวม VAT"
                              : "แยก VAT"}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          สืบทอดจาก Sales Order
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(calculatedLine?.lineTotal ?? 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

        </Card>
      )}

      {/* Totals + Notes */}
      {selectedSO && lineDrafts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Financial Summary */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">{t("common.total")}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("common.subtotal")}
                </span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("common.vat")} ({vatRate}%)
                </span>
                <span className="font-mono">{formatCurrency(vatAmount)}</span>
              </div>

              <Separator />

              <div className="flex justify-between font-semibold text-base">
                <span>{t("common.grandTotal")}</span>
                <span className="font-mono">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">{t("common.notes")}</h2>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={t("common.notes") + "..."}
            />
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/finance/invoices">
          <Button variant="outline">{t("common.cancel")}</Button>
        </Link>
        <Button
          onClick={handleSubmit}
          disabled={saving || !selectedSOId || !lineDrafts.length}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
