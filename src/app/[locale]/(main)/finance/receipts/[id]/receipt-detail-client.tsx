"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { ArrowLeft, Loader2, XCircle, CheckCircle } from "lucide-react";

interface ReceiptDetail {
  id: string;
  receiptNumber: string;
  status: string;
  issueDate: string;
  amount: string;
  payerName: string;
  payerTaxId: string | null;
  payerAddress: string | null;
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
  createdBy: { id: string; name: string };
  createdAt?: string;
}

const NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ["ISSUED"],
  ISSUED: ["CANCELLED"],
};

export function ReceiptDetailClient({
  receipt,
}: {
  receipt: ReceiptDetail;
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
      const res = await fetch(`/api/finance/receipts/${receipt.id}`, {
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

  const isTerminal = receipt.status === "CANCELLED";
  const nextStatuses = NEXT_STATUSES[receipt.status] || [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance/receipts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight font-mono">
              {receipt.receiptNumber}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={receipt.status}
                label={t(`receipt.status.${receipt.status}`)}
              />
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
                {t(`receipt.status.${s}`)}
              </Button>
            ))}
        </div>
      </div>

      {/* Receipt Info + Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("receipt.title")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("receipt.number")}
            </span>
            <span className="font-mono">{receipt.receiptNumber}</span>

            <span className="text-muted-foreground">
              {t("receipt.invoice")}
            </span>
            <Link
              href={`/finance/invoices/${receipt.invoice.id}`}
              className="font-mono text-sm hover:underline"
            >
              {receipt.invoice.invoiceNumber}
            </Link>

            <span className="text-muted-foreground">
              {t("invoice.customer")}
            </span>
            <Link
              href={`/sales/customers/${receipt.invoice.customer.id}`}
              className="font-medium hover:underline"
            >
              {receipt.invoice.customer.code} -{" "}
              {receipt.invoice.customer.name}
            </Link>

            <span className="text-muted-foreground">
              {t("receipt.issueDate")}
            </span>
            <span>{formatDate(receipt.issueDate)}</span>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("receipt.payerName")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("receipt.payerName")}
            </span>
            <span>{receipt.payerName}</span>

            {receipt.payerTaxId && (
              <>
                <span className="text-muted-foreground">Tax ID</span>
                <span className="font-mono">{receipt.payerTaxId}</span>
              </>
            )}

            {receipt.payerAddress && (
              <>
                <span className="text-muted-foreground">Address</span>
                <span className="text-sm">{receipt.payerAddress}</span>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-semibold text-base">
              <span>{t("receipt.amount")}</span>
              <span className="font-mono">
                {formatCurrency(receipt.amount)}
              </span>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>{t("invoice.totalAmount")}</span>
              <span className="font-mono">
                {formatCurrency(receipt.invoice.totalAmount)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Notes */}
      {receipt.notes && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("common.notes")}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {receipt.notes}
          </p>
        </Card>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        {t("common.create")}: {receipt.createdBy.name} |{" "}
        {formatDate(receipt.issueDate)}
      </div>
    </div>
  );
}
