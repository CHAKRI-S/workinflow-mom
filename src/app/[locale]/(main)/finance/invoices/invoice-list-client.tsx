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

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  customer: { id: string; code: string; name: string };
  salesOrder: { id: string; orderNumber: string };
}

const STATUSES = [
  "ALL",
  "DRAFT",
  "ISSUED",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

export function InvoiceListClient({
  invoices,
}: {
  invoices: InvoiceRow[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    let result = invoices;

    if (statusFilter !== "ALL") {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customer.name.toLowerCase().includes(q) ||
          inv.customer.code.toLowerCase().includes(q) ||
          inv.salesOrder.orderNumber.toLowerCase().includes(q)
      );
    }

    return result;
  }, [invoices, search, statusFilter]);

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

  const columns: ColumnDef<InvoiceRow>[] = [
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("invoice.number")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.getValue("invoiceNumber")}
        </span>
      ),
    },
    {
      id: "customer",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("invoice.customer")}
        </SortableHeader>
      ),
      accessorFn: (row) => row.customer.name,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.customer.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.customer.code}
          </div>
        </div>
      ),
    },
    {
      id: "salesOrder",
      header: t("invoice.salesOrder"),
      accessorFn: (row) => row.salesOrder.orderNumber,
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.salesOrder.orderNumber}
        </span>
      ),
    },
    {
      accessorKey: "invoiceType",
      header: t("invoice.type"),
      cell: ({ row }) => {
        const type = row.getValue("invoiceType") as string;
        return (
          <span className="text-sm">
            {t(`invoice.invoiceType.${type}`)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <StatusBadge
            status={status}
            label={t(`invoice.status.${status}`)}
          />
        );
      },
    },
    {
      accessorKey: "issueDate",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("invoice.issueDate")}
        </SortableHeader>
      ),
      cell: ({ row }) => formatDate(row.getValue("issueDate")),
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("invoice.dueDate")}
        </SortableHeader>
      ),
      cell: ({ row }) => formatDate(row.getValue("dueDate")),
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("invoice.totalAmount")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatCurrency(row.getValue("totalAmount"))}
        </span>
      ),
    },
    {
      accessorKey: "paidAmount",
      header: t("invoice.paidAmount"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatCurrency(row.getValue("paidAmount"))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">
          {t("invoice.title")}
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
                {s === "ALL" ? t("common.filter") + ": " + t("common.status") : t(`invoice.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/finance/invoices/${row.id}`)}
      />
    </div>
  );
}
