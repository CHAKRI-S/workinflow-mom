"use client";

import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { Search, Plus, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";

interface Material {
  id: string;
  code: string;
  name: string;
  type: string | null;
  specification: string | null;
  unit: string;
  dimensions: string | null;
  stockQty: string | number;
  minStockQty: string | number;
  unitCost: string | number | null;
}

export function MaterialListClient({ materials }: { materials: Material[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return materials;
    const q = search.toLowerCase();
    return materials.filter(
      (m) =>
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.type?.toLowerCase().includes(q) ||
        m.specification?.toLowerCase().includes(q)
    );
  }, [materials, search]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("material.confirmDelete"))) return;

    const res = await fetch(`/api/production/materials/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.refresh();
    }
  };

  const columns: ColumnDef<Material>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("material.code")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("material.name")}</SortableHeader>
      ),
    },
    {
      accessorKey: "type",
      header: t("material.type"),
      cell: ({ row }) =>
        row.getValue("type") ? (
          <Badge variant="outline">{row.getValue("type") as string}</Badge>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "specification",
      header: t("material.specification"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {(row.getValue("specification") as string) || "—"}
        </span>
      ),
    },
    {
      accessorKey: "unit",
      header: t("material.unit"),
      cell: ({ row }) => (
        <Badge variant="secondary">{row.getValue("unit")}</Badge>
      ),
    },
    {
      accessorKey: "dimensions",
      header: t("material.dimensions"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {(row.getValue("dimensions") as string) || "—"}
        </span>
      ),
    },
    {
      accessorKey: "stockQty",
      header: t("material.stock"),
      cell: ({ row }) => {
        const stock = Number(row.getValue("stockQty"));
        const minStock = Number(row.original.minStockQty);
        const isLow = stock < minStock && minStock > 0;
        return (
          <span className={isLow ? "text-[#f87171] font-medium" : ""}>
            {stock.toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: "unitCost",
      header: t("material.unitCost"),
      cell: ({ row }) => {
        const cost = row.getValue("unitCost");
        if (cost === null || cost === undefined) return "—";
        return (
          <span className="font-mono text-sm">
            {Number(cost).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => handleDelete(row.original.id, e)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">
          {t("material.title")}
        </h1>
        <Link href="/production/materials/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            {t("material.new")}
          </Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("common.search") + "..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/production/materials/${row.id}`)}
      />
    </div>
  );
}
