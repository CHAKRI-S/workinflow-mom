"use client";

import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";

interface QuotationRow {
  id: string;
  quotationNumber: string;
  revision: number;
  status: string;
  issueDate: string;
  validUntil: string;
  totalAmount: string;
  customer: { id: string; code: string; name: string };
  createdBy: { id: string; name: string };
  _count: { lines: number };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary",
  SENT: "default",
  REVISED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  EXPIRED: "destructive",
  CANCELLED: "destructive",
};

export function QuotationListClient({
  quotations,
}: {
  quotations: QuotationRow[];
}) {
  const t = useTranslations("quotation");
  const tc = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    let result = quotations;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.quotationNumber.toLowerCase().includes(q) ||
          r.customer.name.toLowerCase().includes(q) ||
          r.customer.code.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "ALL") {
      result = result.filter((r) => r.status === statusFilter);
    }
    return result;
  }, [quotations, search, statusFilter]);

  const columns: ColumnDef<QuotationRow>[] = useMemo(
    () => [
      {
        accessorKey: "quotationNumber",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("number")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-medium">
            {row.original.quotationNumber}
            {row.original.revision > 1 && (
              <span className="ml-1 text-xs text-muted-foreground">
                (Rev. {row.original.revision})
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "customer.name",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("customer")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <div>
            <div>{row.original.customer.name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.customer.code}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>{tc("status")}</SortableHeader>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              variant={
                STATUS_COLORS[status] as
                  | "default"
                  | "secondary"
                  | "destructive"
                  | "outline"
              }
            >
              {t(`status.${status}` as Parameters<typeof t>[0])}
            </Badge>
          );
        },
      },
      {
        accessorKey: "issueDate",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("issueDate")}</SortableHeader>
        ),
        cell: ({ row }) =>
          new Date(row.original.issueDate).toLocaleDateString(),
      },
      {
        accessorKey: "validUntil",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("validUntil")}</SortableHeader>
        ),
        cell: ({ row }) =>
          new Date(row.original.validUntil).toLocaleDateString(),
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("totalAmount")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {Number(row.original.totalAmount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        ),
      },
      {
        accessorKey: "_count.lines",
        header: () => <span>{t("product")}</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original._count.lines}
          </span>
        ),
      },
    ],
    [t, tc]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <Link href="/sales/quotations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("new")}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tc("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val ?? "ALL")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tc("filter")}</SelectItem>
            <SelectItem value="DRAFT">{t("status.DRAFT")}</SelectItem>
            <SelectItem value="SENT">{t("status.SENT")}</SelectItem>
            <SelectItem value="REVISED">{t("status.REVISED")}</SelectItem>
            <SelectItem value="APPROVED">{t("status.APPROVED")}</SelectItem>
            <SelectItem value="REJECTED">{t("status.REJECTED")}</SelectItem>
            <SelectItem value="EXPIRED">{t("status.EXPIRED")}</SelectItem>
            <SelectItem value="CANCELLED">{t("status.CANCELLED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/sales/quotations/${row.id}`)}
      />
    </div>
  );
}
