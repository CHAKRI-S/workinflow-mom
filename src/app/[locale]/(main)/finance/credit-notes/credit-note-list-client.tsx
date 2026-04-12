"use client";

import { useTranslations } from "next-intl";
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

interface CreditNoteRow {
  id: string;
  creditNoteNumber: string;
  status: string;
  reason: string;
  issueDate: string;
  totalAmount: string;
  description: string;
  invoice: { id: string; invoiceNumber: string };
}

const STATUSES = ["ALL", "DRAFT", "ISSUED", "APPLIED", "CANCELLED"];

export function CreditNoteListClient({
  creditNotes,
}: {
  creditNotes: CreditNoteRow[];
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    let result = creditNotes;

    if (statusFilter !== "ALL") {
      result = result.filter((cn) => cn.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (cn) =>
          cn.creditNoteNumber.toLowerCase().includes(q) ||
          cn.description.toLowerCase().includes(q) ||
          cn.invoice.invoiceNumber.toLowerCase().includes(q)
      );
    }

    return result;
  }, [creditNotes, search, statusFilter]);

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

  const columns: ColumnDef<CreditNoteRow>[] = [
    {
      accessorKey: "creditNoteNumber",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("creditNote.number")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.getValue("creditNoteNumber")}
        </span>
      ),
    },
    {
      id: "invoice",
      header: t("creditNote.invoice"),
      accessorFn: (row) => row.invoice.invoiceNumber,
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.invoice.invoiceNumber}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: t("creditNote.reason"),
      cell: ({ row }) => {
        const reason = row.getValue("reason") as string;
        return (
          <span className="text-sm">
            {t(`creditNote.reasonType.${reason}`)}
          </span>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("creditNote.totalAmount")}
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
            label={t(`creditNote.status.${status}`)}
          />
        );
      },
    },
    {
      accessorKey: "issueDate",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("creditNote.issueDate")}
        </SortableHeader>
      ),
      cell: ({ row }) => formatDate(row.getValue("issueDate")),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">
          {t("creditNote.title")}
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
                  : t(`creditNote.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} />
    </div>
  );
}
