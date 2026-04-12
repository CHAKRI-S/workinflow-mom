"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState, useMemo } from "react";

interface Customer {
  id: string;
  code: string;
  name: string;
  customerType: string;
  contactName: string | null;
  phone: string | null;
  isVatRegistered: boolean;
  paymentTermDays: number;
  _count: { salesOrders: number; quotations: number };
}

export function CustomerListClient({ customers }: { customers: Customer[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.contactName?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("customer.code")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("customer.name")}</SortableHeader>
      ),
    },
    {
      accessorKey: "customerType",
      header: t("customer.type"),
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue("customerType")}</Badge>
      ),
    },
    {
      accessorKey: "contactName",
      header: t("customer.contactName"),
    },
    {
      accessorKey: "phone",
      header: t("customer.phone"),
    },
    {
      accessorKey: "isVatRegistered",
      header: "VAT",
      cell: ({ row }) => (
        <Badge variant={row.getValue("isVatRegistered") ? "default" : "outline"}>
          {row.getValue("isVatRegistered") ? "VAT" : "Non-VAT"}
        </Badge>
      ),
    },
    {
      id: "orders",
      header: t("customer.orders"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original._count.salesOrders} SO / {row.original._count.quotations} QT
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">{t("customer.title")}</h1>
        <Link href="/sales/customers/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            {t("customer.new")}
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
        onRowClick={(row) => router.push(`/sales/customers/${row.id}`)}
      />
    </div>
  );
}
