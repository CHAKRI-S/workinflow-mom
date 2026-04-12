"use client";

import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";

interface Machine {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  _count: { workOrders: number; maintenanceLogs: number };
}

const machineTypeLabel: Record<string, string> = {
  CNC_MILLING: "Milling",
  CNC_LATHE: "Lathe",
  CNC_ROUTER: "Router",
  CNC_ENGRAVING: "Engraving",
  OTHER: "Other",
};

export function MachineListClient({ machines }: { machines: Machine[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return machines;
    const q = search.toLowerCase();
    return machines.filter(
      (m) =>
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q)
    );
  }, [machines, search]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("machine.confirmDelete"))) return;

    const res = await fetch(`/api/production/machines/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.refresh();
    }
  };

  const columns: ColumnDef<Machine>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("machine.code")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("machine.name")}</SortableHeader>
      ),
    },
    {
      accessorKey: "type",
      header: t("machine.type"),
      cell: ({ row }) => (
        <Badge variant="outline">
          {machineTypeLabel[row.getValue("type") as string] || row.getValue("type")}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => (
        <StatusBadge
          status={row.getValue("status")}
          label={t(`machine.status.${row.getValue("status")}`)}
        />
      ),
    },
    {
      id: "workOrders",
      header: t("machine.workOrders"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original._count.workOrders}
        </span>
      ),
    },
    {
      id: "maintenance",
      header: t("machine.maintenance"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original._count.maintenanceLogs}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Link href={`/production/machines/${row.original.id}`}>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Link>
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
          {t("machine.title")}
        </h1>
        <Link href="/production/machines/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            {t("machine.new")}
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
        onRowClick={(row) => router.push(`/production/machines/${row.id}`)}
      />
    </div>
  );
}
