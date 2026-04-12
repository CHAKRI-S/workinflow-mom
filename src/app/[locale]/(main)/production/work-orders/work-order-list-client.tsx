"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Link, useRouter } from "@/i18n/navigation";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";

interface WorkOrder {
  id: string;
  woNumber: string;
  status: string;
  priority: string;
  plannedQty: string | number;
  completedQty: string | number;
  plannedStart: string;
  plannedEnd: string;
  product: { id: string; code: string; name: string } | null;
  cncMachine: { id: string; code: string; name: string } | null;
}

const ALL_STATUSES = [
  "PENDING",
  "RELEASED",
  "IN_PROGRESS",
  "QC_MACHINING",
  "SENT_TO_PAINTING",
  "PAINTING_DONE",
  "ENGRAVING",
  "QC_FINAL",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;

const ALL_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

interface WorkOrderListClientProps {
  workOrders: WorkOrder[];
}

export function WorkOrderListClient({ workOrders }: WorkOrderListClientProps) {
  const t = useTranslations("workOrder");
  const tc = useTranslations("common");
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  const filteredData = useMemo(() => {
    return workOrders.filter((wo) => {
      const matchSearch =
        !search ||
        wo.woNumber.toLowerCase().includes(search.toLowerCase()) ||
        wo.product?.name.toLowerCase().includes(search.toLowerCase()) ||
        wo.product?.code.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" || wo.status === statusFilter;

      const matchPriority =
        priorityFilter === "ALL" || wo.priority === priorityFilter;

      return matchSearch && matchStatus && matchPriority;
    });
  }, [workOrders, search, statusFilter, priorityFilter]);

  const columns: ColumnDef<WorkOrder>[] = useMemo(
    () => [
      {
        accessorKey: "woNumber",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("number")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.woNumber}</span>
        ),
      },
      {
        id: "productName",
        accessorFn: (row) => row.product?.name ?? "-",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("product")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.product?.name ?? "-"}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.product?.code ?? ""}
            </div>
          </div>
        ),
      },
      {
        id: "machineName",
        accessorFn: (row) => row.cncMachine?.name ?? "-",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("machine")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span>{row.original.cncMachine?.name ?? "-"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>{tc("status")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={t(`status.${row.original.status}` as any)}
          />
        ),
      },
      {
        accessorKey: "priority",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("priority")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.priority}
            label={t(`priority_label.${row.original.priority}` as any)}
          />
        ),
      },
      {
        accessorKey: "plannedQty",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("plannedQty")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {Number(row.original.plannedQty).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "completedQty",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("completedQty")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {Number(row.original.completedQty).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "plannedStart",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("plannedStart")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {new Date(row.original.plannedStart).toLocaleDateString()}
          </span>
        ),
      },
      {
        accessorKey: "plannedEnd",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("plannedEnd")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {new Date(row.original.plannedEnd).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [t, tc]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <Link href="/production/work-orders/new">
          <Button>
            <Plus className="h-4 w-4" data-icon="inline-start" />
            {t("new")}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tc("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "ALL")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tc("status")}: {tc("filter")}</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val ?? "ALL")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("priority")}: {tc("filter")}</SelectItem>
            {ALL_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`priority_label.${p}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        onRowClick={(row) =>
          router.push(`/production/work-orders/${row.id}`)
        }
      />
    </div>
  );
}
