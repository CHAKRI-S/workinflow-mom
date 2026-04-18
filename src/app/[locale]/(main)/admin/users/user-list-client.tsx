"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Send, AlertTriangle, ShieldCheck, Users as UsersIcon } from "lucide-react";
import { useState, useMemo } from "react";

const ROLES_LIST = [
  "ADMIN",
  "MANAGER",
  "PLANNER",
  "SALES",
  "OPERATOR",
  "QC",
  "ACCOUNTING",
] as const;

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  PLANNER: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  SALES: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  OPERATOR: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  QC: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800",
  ACCOUNTING: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
};

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export function UserListClient({
  users,
  activeCount,
  maxUsers,
  planName,
}: {
  users: User[];
  activeCount: number;
  maxUsers: number; // 0 = unlimited
  planName: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const unlimited = maxUsers === 0;
  const atCap = !unlimited && activeCount >= maxUsers;
  const usageLabel = unlimited
    ? `${activeCount} / ไม่จำกัด`
    : `${activeCount} / ${maxUsers}`;

  const filtered = useMemo(() => {
    let result = users;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    if (roleFilter !== "ALL") {
      result = result.filter((u) => u.role === roleFilter);
    }

    return result;
  }, [users, search, roleFilter]);

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("user.name")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("user.email")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("email")}</span>
      ),
    },
    {
      accessorKey: "role",
      header: t("user.role"),
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        return (
          <Badge
            variant="outline"
            className={`text-xs font-medium ${ROLE_COLORS[role] || ""}`}
          >
            {t(`user.roleLabel.${role}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: t("user.isActive"),
      cell: ({ row }) => {
        const isActive = row.getValue("isActive") as boolean;
        return (
          <Badge
            variant="outline"
            className={
              isActive
                ? "bg-[#27a644]/15 text-[#4ade80] border-[#27a644]/25"
                : "bg-[#e5484d]/12 text-[#f87171] border-[#e5484d]/20"
            }
          >
            {isActive ? t("user.active") : t("user.inactive")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("common.date")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.getValue("createdAt")).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            {t("user.title")}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <UsersIcon className="h-3.5 w-3.5" />
            <span>ใช้งานอยู่ {usageLabel}</span>
            {planName && (
              <span className="text-xs">• Plan: {planName}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/roles">
            <Button variant="outline">
              <ShieldCheck className="h-4 w-4 mr-1" />
              ดูสิทธิของ Role
            </Button>
          </Link>
          {atCap ? (
            <>
              <Button variant="outline" disabled title="ต้องอัพเกรด Plan ก่อน">
                <Send className="h-4 w-4 mr-1" />
                เชิญผ่านอีเมล
              </Button>
              <Button disabled title="ต้องอัพเกรด Plan ก่อน">
                <Plus className="h-4 w-4 mr-1" />
                {t("user.new")}
              </Button>
            </>
          ) : (
            <>
              <Link href="/admin/users/invite">
                <Button variant="outline">
                  <Send className="h-4 w-4 mr-1" />
                  เชิญผ่านอีเมล
                </Button>
              </Link>
              <Link href="/admin/users/new">
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("user.new")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {atCap && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-900 dark:text-amber-200">
                ใช้โควตา user เต็มแล้ว ({activeCount}/{maxUsers})
              </div>
              <p className="text-sm text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                เพิ่ม user ใหม่ หรือ เปิดใช้งาน user ที่ปิดอยู่ไม่ได้จนกว่าจะอัพเกรด Plan
              </p>
            </div>
            <Link href="/admin/billing/upgrade">
              <Button size="sm" className="shrink-0">
                อัพเกรด Plan
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
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
          defaultValue="ALL"
          onValueChange={(v) => setRoleFilter(v ?? "ALL")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("user.role")} - All</SelectItem>
            {ROLES_LIST.map((role) => (
              <SelectItem key={role} value={role}>
                {t(`user.roleLabel.${role}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
      />
    </div>
  );
}
