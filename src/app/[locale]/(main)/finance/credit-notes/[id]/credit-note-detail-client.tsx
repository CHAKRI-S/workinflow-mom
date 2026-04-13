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
import { useState } from "react";
import { ArrowLeft, Loader2, XCircle, CheckCircle } from "lucide-react";

interface CreditNoteLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  sortOrder: number;
}

interface CreditNoteDetail {
  id: string;
  creditNoteNumber: string;
  status: string;
  reason: string;
  issueDate: string;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  description: string;
  notes: string | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: string;
    customer: {
      id: string;
      code: string;
      name: string;
    };
  };
  lines: CreditNoteLine[];
  createdAt?: string;
}

const NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ["ISSUED"],
  ISSUED: ["APPLIED", "CANCELLED"],
  APPLIED: ["CANCELLED"],
};

export function CreditNoteDetailClient({
  creditNote,
}: {
  creditNote: CreditNoteDetail;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
    if (newStatus === "CANCELLED" && !confirm(t("common.confirm") + "?"))
      return;
    setLoading(true);

    try {
      const res = await fetch(`/api/finance/credit-notes/${creditNote.id}`, {
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
      setLoading(false);
    }
  };

  const isTerminal =
    creditNote.status === "CANCELLED";
  const nextStatuses = NEXT_STATUSES[creditNote.status] || [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance/credit-notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight font-mono">
              {creditNote.creditNoteNumber}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={creditNote.status}
                label={t(`creditNote.status.${creditNote.status}`)}
              />
              <Badge variant="outline">
                {t(`creditNote.reasonType.${creditNote.reason}`)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isTerminal &&
            nextStatuses.map((s) => (
              <Button
                key={s}
                variant={s === "CANCELLED" ? "destructive" : "default"}
                size="sm"
                onClick={() => handleStatusChange(s)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : s === "CANCELLED" ? (
                  <XCircle className="h-4 w-4 mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                {t(`creditNote.status.${s}`)}
              </Button>
            ))}
        </div>
      </div>

      {/* Credit Note Info + Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("creditNote.title")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("creditNote.number")}
            </span>
            <span className="font-mono">{creditNote.creditNoteNumber}</span>

            <span className="text-muted-foreground">
              {t("creditNote.invoice")}
            </span>
            <Link
              href={`/finance/invoices/${creditNote.invoice.id}`}
              className="font-mono text-sm hover:underline"
            >
              {creditNote.invoice.invoiceNumber}
            </Link>

            <span className="text-muted-foreground">
              {t("invoice.customer")}
            </span>
            <Link
              href={`/sales/customers/${creditNote.invoice.customer.id}`}
              className="font-medium hover:underline"
            >
              {creditNote.invoice.customer.code} -{" "}
              {creditNote.invoice.customer.name}
            </Link>

            <span className="text-muted-foreground">
              {t("creditNote.reason")}
            </span>
            <span>{t(`creditNote.reasonType.${creditNote.reason}`)}</span>

            <span className="text-muted-foreground">
              {t("creditNote.issueDate")}
            </span>
            <span>{formatDate(creditNote.issueDate)}</span>
          </div>
        </Card>

        {/* Financial Summary */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("common.total")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("common.subtotal")}
              </span>
              <span className="font-mono">
                {formatCurrency(creditNote.subtotal)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("common.vat")} ({creditNote.vatRate}%)
              </span>
              <span className="font-mono">
                {formatCurrency(creditNote.vatAmount)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between font-semibold text-base">
              <span>{t("common.grandTotal")}</span>
              <span className="font-mono">
                {formatCurrency(creditNote.totalAmount)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between text-muted-foreground">
              <span>{t("invoice.totalAmount")}</span>
              <span className="font-mono">
                {formatCurrency(creditNote.invoice.totalAmount)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Description */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-2">
          {t("creditNote.description")}
        </h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {creditNote.description}
        </p>
      </Card>

      {/* Line Items */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">
          {t("common.total")} ({creditNote.lines.length})
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
                  {t("creditNote.totalAmount")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditNote.lines.map((line, index) => (
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

      {/* Notes */}
      {creditNote.notes && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("common.notes")}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {creditNote.notes}
          </p>
        </Card>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        {formatDate(creditNote.issueDate)}
      </div>
    </div>
  );
}
