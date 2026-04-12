"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { Search, Plus } from "lucide-react";
import { useState, useMemo } from "react";

const CATEGORIES = [
  "CUTTING_TOOL",
  "COOLANT",
  "ABRASIVE",
  "MEASURING",
  "SAFETY",
  "OTHER",
] as const;

interface Consumable {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string | null;
  specification: string | null;
  unit: string;
  lastPrice: string | number | null;
  lastSupplier: string | null;
  lastPurchaseDate: string | null;
  stockQty: string | number;
  minStockQty: string | number;
}

export function ConsumableListClient({
  consumables,
}: {
  consumables: Consumable[];
}) {
  const t = useTranslations("consumable");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    let result = consumables;

    if (categoryFilter && categoryFilter !== "ALL") {
      result = result.filter((c) => c.category === categoryFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.brand?.toLowerCase().includes(q) ||
          c.lastSupplier?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [consumables, search, categoryFilter]);

  const columns: ColumnDef<Consumable>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("code")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("name")}</SortableHeader>
      ),
    },
    {
      accessorKey: "category",
      header: t("category"),
      cell: ({ row }) => {
        const category = row.getValue("category") as string;
        return (
          <Badge variant="outline">
            {t(`categoryLabel.${category}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "brand",
      header: t("brand"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {(row.getValue("brand") as string) || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "lastPrice",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("lastPrice")}</SortableHeader>
      ),
      cell: ({ row }) => {
        const price = row.getValue("lastPrice") as string | number | null;
        if (price === null || price === undefined) return "\u2014";
        return (
          <span className="font-mono text-sm">
            {Number(price).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      accessorKey: "lastSupplier",
      header: t("lastSupplier"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {(row.getValue("lastSupplier") as string) || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "stockQty",
      header: t("stock"),
      cell: ({ row }) => {
        const stock = Number(row.getValue("stockQty"));
        const minStock = Number(row.original.minStockQty);
        const isLow = stock < minStock && minStock > 0;
        return (
          <span className={isLow ? "text-red-500 font-medium" : ""}>
            {stock.toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: "minStockQty",
      header: t("minStock"),
      cell: ({ row }) => {
        const val = Number(row.getValue("minStockQty"));
        return <span>{val.toLocaleString()}</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
        <Link href="/procurement/consumables/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            {t("new")}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tCommon("search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v ?? "ALL")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tCommon("all")}</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {t(`categoryLabel.${cat}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) =>
          router.push(`/procurement/consumables/${row.id}`)
        }
      />
    </div>
  );
}
