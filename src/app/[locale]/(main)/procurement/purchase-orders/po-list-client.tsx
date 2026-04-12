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

interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierContact: string | null;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  totalAmount: string;
  _count: { lines: number };
}

export function POListClient({
  purchaseOrders,
}: {
  purchaseOrders: PurchaseOrderRow[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    let result = purchaseOrders;

    // Tab filter
    if (tab === "active") {
      result = result.filter((po) =>
        ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)
      );
    } else if (tab === "received") {
      result = result.filter((po) => po.status === "RECEIVED");
    } else if (tab === "cancelled") {
      result = result.filter((po) => po.status === "CANCELLED");
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (po) =>
          po.poNumber.toLowerCase().includes(q) ||
          po.supplierName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [purchaseOrders, search, tab]);

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

  const columns: ColumnDef<PurchaseOrderRow>[] = [
    {
      accessorKey: "poNumber",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("purchaseOrder.number")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.getValue("poNumber")}
        </span>
      ),
    },
    {
      accessorKey: "supplierName",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("purchaseOrder.supplierName")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("supplierName")}</span>
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
            label={t(`purchaseOrder.status.${status}`)}
          />
        );
      },
    },
    {
      accessorKey: "orderDate",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("purchaseOrder.orderDate")}
        </SortableHeader>
      ),
      cell: ({ row }) => formatDate(row.getValue("orderDate")),
    },
    {
      accessorKey: "expectedDate",
      header: t("purchaseOrder.expectedDate"),
      cell: ({ row }) => formatDate(row.getValue("expectedDate")),
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("purchaseOrder.totalAmount")}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatCurrency(row.getValue("totalAmount"))}
        </span>
      ),
    },
    {
      id: "lines",
      header: t("purchaseOrder.lines"),
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
        <h1 className="text-2xl font-medium tracking-tight">
          {t("purchaseOrder.title")}
        </h1>
        <Link href="/procurement/purchase-orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            {t("purchaseOrder.new")}
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
          <TabsTrigger value="all">{t("purchaseOrder.all")}</TabsTrigger>
          <TabsTrigger value="active">{t("purchaseOrder.active")}</TabsTrigger>
          <TabsTrigger value="received">
            {t("purchaseOrder.status.RECEIVED")}
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            {t("purchaseOrder.status.CANCELLED")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(row) =>
              router.push(`/procurement/purchase-orders/${row.id}`)
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
