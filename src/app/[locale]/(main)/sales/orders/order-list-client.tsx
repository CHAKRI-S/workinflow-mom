"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState, useMemo } from "react";

interface SalesOrderRow {
  id: string;
  orderNumber: string;
  orderDate: string;
  requestedDate: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  customer: { id: string; code: string; name: string };
  _count: { lines: number };
}

const ACTIVE_STATUSES = [
  "CONFIRMED",
  "DEPOSIT_PENDING",
  "IN_PRODUCTION",
  "PAINTING",
  "ENGRAVING",
  "QC_FINAL",
  "PACKING",
  "AWAITING_PAYMENT",
  "SHIPPED",
];

export function OrderListClient({ orders }: { orders: SalesOrderRow[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    let result = orders;

    // Tab filter
    if (tab === "active") {
      result = result.filter((o) => ACTIVE_STATUSES.includes(o.status));
    } else if (tab === "completed") {
      result = result.filter((o) => o.status === "COMPLETED");
    } else if (tab === "cancelled") {
      result = result.filter((o) => o.status === "CANCELLED");
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.code.toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, search, tab]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: string) => {
    return Number(amount).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const columns: ColumnDef<SalesOrderRow>[] = [
    {
      accessorKey: "orderNumber",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("salesOrder.number")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.getValue("orderNumber")}
        </span>
      ),
    },
    {
      id: "customer",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("salesOrder.customer")}
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
      accessorKey: "orderDate",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("salesOrder.orderDate")}
        </SortableHeader>
      ),
      cell: ({ row }) => formatDate(row.getValue("orderDate")),
    },
    {
      accessorKey: "requestedDate",
      header: t("salesOrder.requestedDate"),
      cell: ({ row }) => formatDate(row.getValue("requestedDate")),
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("salesOrder.totalAmount")}
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
            label={t(`salesOrder.status.${status}`)}
          />
        );
      },
    },
    {
      accessorKey: "paymentStatus",
      header: t("salesOrder.payment"),
      cell: ({ row }) => {
        const ps = row.getValue("paymentStatus") as string;
        return (
          <StatusBadge
            status={ps}
            label={t(`salesOrder.paymentStatus.${ps}`)}
          />
        );
      },
    },
    {
      id: "lines",
      header: t("salesOrder.lines"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original._count.lines}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">{t("salesOrder.title")}</h1>
        <Link href="/sales/orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            {t("salesOrder.new")}
          </Button>
        </Link>
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
      </div>

      <Tabs defaultValue="all" onValueChange={(v) => setTab(v ?? "all")}>
        <TabsList>
          <TabsTrigger value="all">{t("salesOrder.all")}</TabsTrigger>
          <TabsTrigger value="active">{t("salesOrder.active")}</TabsTrigger>
          <TabsTrigger value="completed">
            {t("salesOrder.status.COMPLETED")}
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            {t("salesOrder.status.CANCELLED")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(row) => router.push(`/sales/orders/${row.id}`)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
