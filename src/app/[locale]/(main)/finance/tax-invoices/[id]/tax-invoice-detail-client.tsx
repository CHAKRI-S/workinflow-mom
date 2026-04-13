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

interface TaxInvoiceDetail {
  id: string;
  taxInvoiceNumber: string;
  status: string;
  issueDate: string;
  buyerName: string;
  buyerTaxId: string | null;
  buyerAddress: string | null;
  buyerBranch: string | null;
  sellerName: string;
  sellerTaxId: string | null;
  sellerAddress: string | null;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
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
  createdAt?: string;
}

const NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ["ISSUED"],
  ISSUED: ["CANCELLED"],
};

export function TaxInvoiceDetailClient({
  taxInvoice,
}: {
  taxInvoice: TaxInvoiceDetail;
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
      const res = await fetch(
        `/api/finance/tax-invoices/${taxInvoice.id}`,
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
      setLoading(false);
    }
  };

  const isTerminal = taxInvoice.status === "CANCELLED";
  const nextStatuses = NEXT_STATUSES[taxInvoice.status] || [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance/tax-invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight font-mono">
              {taxInvoice.taxInvoiceNumber}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={taxInvoice.status}
                label={t(`taxInvoice.status.${taxInvoice.status}`)}
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
                {t(`taxInvoice.status.${s}`)}
              </Button>
            ))}
        </div>
      </div>

      {/* Tax Invoice Info */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">{t("taxInvoice.title")}</h2>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-muted-foreground">
            {t("taxInvoice.number")}
          </span>
          <span className="font-mono">{taxInvoice.taxInvoiceNumber}</span>

          <span className="text-muted-foreground">
            {t("taxInvoice.invoice")}
          </span>
          <Link
            href={`/finance/invoices/${taxInvoice.invoice.id}`}
            className="font-mono text-sm hover:underline"
          >
            {taxInvoice.invoice.invoiceNumber}
          </Link>

          <span className="text-muted-foreground">
            {t("taxInvoice.issueDate")}
          </span>
          <span>{formatDate(taxInvoice.issueDate)}</span>
        </div>
      </Card>

      {/* Buyer & Seller */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Buyer */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("taxInvoice.buyerName")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("taxInvoice.buyerName")}
            </span>
            <span>{taxInvoice.buyerName}</span>

            {taxInvoice.buyerTaxId && (
              <>
                <span className="text-muted-foreground">
                  {t("taxInvoice.buyerTaxId")}
                </span>
                <span className="font-mono">{taxInvoice.buyerTaxId}</span>
              </>
            )}

            {taxInvoice.buyerAddress && (
              <>
                <span className="text-muted-foreground">Address</span>
                <span className="text-sm">{taxInvoice.buyerAddress}</span>
              </>
            )}

            {taxInvoice.buyerBranch && (
              <>
                <span className="text-muted-foreground">Branch</span>
                <span>{taxInvoice.buyerBranch}</span>
              </>
            )}
          </div>
        </Card>

        {/* Seller */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("taxInvoice.sellerName")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("taxInvoice.sellerName")}
            </span>
            <span>{taxInvoice.sellerName}</span>

            {taxInvoice.sellerTaxId && (
              <>
                <span className="text-muted-foreground">Tax ID</span>
                <span className="font-mono">{taxInvoice.sellerTaxId}</span>
              </>
            )}

            {taxInvoice.sellerAddress && (
              <>
                <span className="text-muted-foreground">Address</span>
                <span className="text-sm">{taxInvoice.sellerAddress}</span>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">{t("common.total")}</h2>
        <div className="space-y-2 text-sm max-w-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("common.subtotal")}
            </span>
            <span className="font-mono">
              {formatCurrency(taxInvoice.subtotal)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("common.vat")} ({taxInvoice.vatRate}%)
            </span>
            <span className="font-mono">
              {formatCurrency(taxInvoice.vatAmount)}
            </span>
          </div>

          <Separator />

          <div className="flex justify-between font-semibold text-base">
            <span>{t("common.grandTotal")}</span>
            <span className="font-mono">
              {formatCurrency(taxInvoice.totalAmount)}
            </span>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {taxInvoice.notes && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("common.notes")}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {taxInvoice.notes}
          </p>
        </Card>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        {formatDate(taxInvoice.issueDate)}
      </div>
    </div>
  );
}
