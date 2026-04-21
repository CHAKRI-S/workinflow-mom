"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileDown } from "lucide-react";
import { useState, useMemo } from "react";

interface TaxInvoiceRow {
  id: string;
  taxInvoiceNumber: string;
  status: string;
  issueDate: string;
  buyerName: string;
  buyerTaxId: string | null;
  totalAmount: string;
  invoice: { id: string; invoiceNumber: string };
}

const STATUSES = ["ALL", "DRAFT", "ISSUED", "CANCELLED"];

export function TaxInvoiceListClient({
  taxInvoices,
}: {
  taxInvoices: TaxInvoiceRow[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    let result = taxInvoices;

    if (statusFilter !== "ALL") {
      result = result.filter((ti) => ti.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (ti) =>
          ti.taxInvoiceNumber.toLowerCase().includes(q) ||
          ti.buyerName.toLowerCase().includes(q) ||
          ti.invoice.invoiceNumber.toLowerCase().includes(q)
      );
    }

    return result;
  }, [taxInvoices, search, statusFilter]);

  const formatDate = (dateStr: string) => {
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

  const columns: ColumnDef<TaxInvoiceRow>[] = [
    {
      accessorKey: "taxInvoiceNumber",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("taxInvoice.number")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.getValue("taxInvoiceNumber")}
        </span>
      ),
    },
    {
      id: "invoice",
      header: t("taxInvoice.invoice"),
      accessorFn: (row) => row.invoice.invoiceNumber,
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.invoice.invoiceNumber}
        </span>
      ),
    },
    {
      accessorKey: "buyerName",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("taxInvoice.buyerName")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("buyerName")}</span>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("common.total")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatCurrency(row.getValue("totalAmount"))}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <StatusBadge
            status={status}
            label={t(`taxInvoice.status.${status}`)}
          />
        );
      },
    },
    {
      accessorKey: "issueDate",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("taxInvoice.issueDate")}
        </SortableHeader>
      ),
      cell: ({ row }) => formatDate(row.getValue("issueDate")),
    },
    {
      id: "pdf",
      header: "",
      cell: ({ row }) => (
        <a
          href={`/api/finance/tax-invoices/${row.original.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label="ดาวน์โหลด PDF"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <FileDown className="h-3.5 w-3.5" />
          PDF
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">
          {t("taxInvoice.title")}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(String(v ?? "ALL"))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL"
                  ? t("common.filter") + ": " + t("common.status")
                  : t(`taxInvoice.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/finance/tax-invoices/${row.id}`)}
      />
    </div>
  );
}
