"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Paintbrush, Stamp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState, useMemo } from "react";

interface Product {
  id: string;
  code: string;
  name: string;
  category: string | null;
  requiresPainting: boolean;
  requiresLogoEngraving: boolean;
  unitPrice: string | number | null;
  leadTimeDays: number;
  _count: { bomLines: number; workOrders: number };
}

export function ProductListClient({ products }: { products: Product[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("product.code")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("product.name")}</SortableHeader>
      ),
    },
    {
      accessorKey: "category",
      header: t("product.category"),
      cell: ({ row }) =>
        row.getValue("category") ? (
          <Badge variant="outline">{row.getValue("category") as string}</Badge>
        ) : (
          "—"
        ),
    },
    {
      id: "features",
      header: t("product.features"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.requiresPainting && (
            <Badge variant="secondary" className="gap-1">
              <Paintbrush className="h-3 w-3" />
              {t("product.requiresPainting")}
            </Badge>
          )}
          {row.original.requiresLogoEngraving && (
            <Badge variant="secondary" className="gap-1">
              <Stamp className="h-3 w-3" />
              {t("product.requiresLogo")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "unitPrice",
      header: t("product.unitPrice"),
      cell: ({ row }) => {
        const price = row.getValue("unitPrice");
        return price
          ? Number(price).toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            })
          : "—";
      },
    },
    {
      id: "bom",
      header: t("product.bom"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original._count.bomLines} {t("product.items")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">{t("product.title")}</h1>
        <Link href="/production/products/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            {t("product.new")}
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
        onRowClick={(row) => router.push(`/production/products/${row.id}`)}
      />
    </div>
  );
}
