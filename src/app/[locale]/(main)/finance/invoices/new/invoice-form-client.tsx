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
import { useState, useMemo } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";

interface SOLine {
  id: string;
  description: string | null;
  quantity: string;
  unitPrice: string;
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
  customer: {
    id: string;
    code: string;
    name: string;
    isVatRegistered: boolean;
  };
  lines: SOLine[];
}

const INVOICE_TYPES = ["DEPOSIT", "FULL", "REMAINING", "PARTIAL"] as const;

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

  const selectedSO = useMemo(() => {
    return salesOrders.find((so) => so.id === selectedSOId) ?? null;
  }, [salesOrders, selectedSOId]);

  // Build lines from selected SO
  const lines = useMemo(() => {
    if (!selectedSO) return [];
    return selectedSO.lines.map((line) => ({
      salesOrderLineId: line.id,
      description: line.description || line.product.name,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
      notes: line.notes,
      sortOrder: line.sortOrder,
    }));
  }, [selectedSO]);

  // Calculate totals
  const { subtotal, vatRate, vatAmount, totalAmount } = useMemo(() => {
    if (!selectedSO || lines.length === 0) {
      return { subtotal: 0, vatRate: 0, vatAmount: 0, totalAmount: 0 };
    }

    const sub = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const vr = selectedSO.customer.isVatRegistered ? 7 : 0;
    const vat = Math.round(sub * vr) / 100;
    const total = Math.round((sub + vat) * 100) / 100;

    return { subtotal: sub, vatRate: vr, vatAmount: vat, totalAmount: total };
  }, [selectedSO, lines]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
    if (lines.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderId: selectedSOId,
          invoiceType,
          dueDate,
          lines: lines.map((l) => ({
            salesOrderLineId: l.salesOrderLineId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
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
                />
              </SelectTrigger>
              <SelectContent>
                {salesOrders.map((so) => (
                  <SelectItem key={so.id} value={so.id}>
                    {so.orderNumber} - {so.customer.name}
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`invoice.invoiceType.${type}`)}
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
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Lines from SO */}
      {selectedSO && lines.length > 0 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">
            {t("invoice.title")} ({lines.length})
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
                  <TableHead className="text-right">
                    {t("common.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={line.salesOrderLineId}>
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.quantity.toLocaleString()}
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
      )}

      {/* Totals + Notes */}
      {selectedSO && lines.length > 0 && (
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
          disabled={saving || !selectedSOId || !lines.length}
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
