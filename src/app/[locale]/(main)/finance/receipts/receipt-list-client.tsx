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
import { Search } from "lucide-react";
import { useState, useMemo } from "react";

interface ReceiptRow {
  id: string;
  receiptNumber: string;
  status: string;
  issueDate: string;
  amount: string;
  payerName: string;
  payerTaxId: string | null;
  invoice: { id: string; invoiceNumber: string };
}

const STATUSES = ["ALL", "DRAFT", "ISSUED", "CANCELLED"];

export function ReceiptListClient({
  receipts,
}: {
  receipts: ReceiptRow[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    let result = receipts;

    if (statusFilter !== "ALL") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.receiptNumber.toLowerCase().includes(q) ||
          r.payerName.toLowerCase().includes(q) ||
          r.invoice.invoiceNumber.toLowerCase().includes(q)
      );
    }

    return result;
  }, [receipts, search, statusFilter]);

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

  const columns: ColumnDef<ReceiptRow>[] = [
    {
      accessorKey: "receiptNumber",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("receipt.number")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.getValue("receiptNumber")}
        </span>
      ),
    },
    {
      id: "invoice",
      header: t("receipt.invoice"),
      accessorFn: (row) => row.invoice.invoiceNumber,
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.invoice.invoiceNumber}
        </span>
      ),
    },
    {
      accessorKey: "payerName",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("receipt.payerName")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("payerName")}</span>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("receipt.amount")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatCurrency(row.getValue("amount"))}
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
            label={t(`receipt.status.${status}`)}
          />
        );
      },
    },
    {
      accessorKey: "issueDate",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("receipt.issueDate")}
        </SortableHeader>
      ),
      cell: ({ row }) => formatDate(row.getValue("issueDate")),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">
          {t("receipt.title")}
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
                  : t(`receipt.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/finance/receipts/${row.id}`)}
      />
    </div>
  );
}
