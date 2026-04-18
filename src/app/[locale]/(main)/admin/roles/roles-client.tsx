"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ALL_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_MATRIX,
  countAccessibleRoutes,
  type RouteSection,
} from "@/lib/role-matrix";
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  Settings,
  Check,
  X,
  ArrowLeft,
  Info,
} from "lucide-react";
import type { Role } from "@/generated/prisma/client";

const ICON_MAP = {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  Settings,
};

type ViewMode = "matrix" | "by-role";

export function RolesClient() {
  const [view, setView] = useState<ViewMode>("matrix");
  const [selectedRole, setSelectedRole] = useState<Role>(ALL_ROLES[0]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-medium tracking-tight">สิทธิตาม Role</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            สิทธิการเข้าถึงหน้างานของแต่ละบทบาทในระบบ
          </p>
        </div>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {ALL_ROLES.map((role) => {
          const info = ROLE_DESCRIPTIONS[role];
          const count = countAccessibleRoutes(role);
          return (
            <button
              key={role}
              onClick={() => {
                setSelectedRole(role);
                setView("by-role");
              }}
              className="rounded-xl border bg-card p-4 text-left hover:border-primary hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className={`text-xs font-medium ${info.color}`}>
                  {role}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {count} หน้า
                </span>
              </div>
              <div className="font-semibold text-sm mb-1">{info.label}</div>
              <p className="text-xs text-muted-foreground line-clamp-2">{info.desc}</p>
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          <button
            onClick={() => setView("matrix")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              view === "matrix"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ตารางสรุป
          </button>
          <button
            onClick={() => setView("by-role")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              view === "by-role"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ดูตาม Role
          </button>
        </div>
      </div>

      {view === "matrix" ? <MatrixView /> : <ByRoleView role={selectedRole} onChangeRole={setSelectedRole} />}

      {/* Legal note */}
      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div>
          สิทธิ์เหล่านี้กำหนดไว้ในระดับ API + Page guard จึงไม่สามารถข้ามผ่านการเข้ารหัสในเบราว์เซอร์ได้
          บาง API endpoint อาจอนุญาตให้ร่วม role มากกว่าที่ระบุในตารางสำหรับการ{" "}
          <em>อ่าน</em> ข้อมูลเท่านั้น — ดูโค้ดใน <code className="bg-card px-1 rounded">src/lib/role-matrix.ts</code> เป็นข้อมูลอ้างอิงหลัก
        </div>
      </div>
    </div>
  );
}

function MatrixView() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left font-medium px-4 py-2.5 sticky left-0 bg-muted/40 z-10 min-w-[200px]">
                หน้างาน
              </th>
              {ALL_ROLES.map((role) => (
                <th key={role} className="text-center font-medium px-3 py-2.5 min-w-[80px]">
                  <Badge variant="outline" className={`text-[10px] ${ROLE_DESCRIPTIONS[role].color}`}>
                    {role}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_MATRIX.map((section) => (
              <SectionRows key={section.section} section={section} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({ section }: { section: RouteSection }) {
  const Icon = ICON_MAP[section.icon];
  return (
    <>
      <tr className="bg-muted/20 border-b border-t">
        <td colSpan={ALL_ROLES.length + 1} className="px-4 py-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Icon className="h-3.5 w-3.5" />
            {section.section}
          </div>
        </td>
      </tr>
      {section.routes.map((route) => (
        <tr key={route.path} className="border-b last:border-0 hover:bg-muted/20">
          <td className="px-4 py-2 sticky left-0 bg-card hover:bg-muted/20 z-10">
            <div className="font-medium">{route.label}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{route.path}</div>
            {route.note && (
              <div className="text-[11px] text-muted-foreground italic mt-0.5">{route.note}</div>
            )}
          </td>
          {ALL_ROLES.map((role) => {
            const allowed = route.roles.includes(role);
            return (
              <td key={role} className="text-center px-3 py-2">
                {allowed ? (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 inline-block" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/30 inline-block" />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function ByRoleView({
  role,
  onChangeRole,
}: {
  role: Role;
  onChangeRole: (r: Role) => void;
}) {
  const info = ROLE_DESCRIPTIONS[role];
  const accessibleCount = countAccessibleRoutes(role);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">เลือก Role:</span>
        {ALL_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => onChangeRole(r)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
              r === role
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:border-primary/50"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-xs font-medium ${info.color}`}>
                {role}
              </Badge>
              <span className="font-semibold">{info.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">{info.desc}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold">{accessibleCount}</div>
            <div className="text-xs text-muted-foreground">หน้าที่เข้าได้</div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          {ROLE_MATRIX.map((section) => {
            const accessible = section.routes.filter((r) => r.roles.includes(role));
            const denied = section.routes.filter((r) => !r.roles.includes(role));
            const Icon = ICON_MAP[section.icon];

            return (
              <div key={section.section}>
                <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {section.section}
                </div>
                <div className="grid md:grid-cols-2 gap-2 pl-6">
                  {accessible.map((r) => (
                    <div
                      key={r.path}
                      className="flex items-center gap-2 text-sm py-1"
                    >
                      <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                      <span>{r.label}</span>
                      <span className="text-[11px] text-muted-foreground font-mono ml-auto">
                        {r.path}
                      </span>
                    </div>
                  ))}
                  {denied.map((r) => (
                    <div
                      key={r.path}
                      className="flex items-center gap-2 text-sm py-1 text-muted-foreground/50"
                    >
                      <X className="h-3.5 w-3.5 shrink-0" />
                      <span className="line-through">{r.label}</span>
                      <span className="text-[11px] font-mono ml-auto">{r.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
