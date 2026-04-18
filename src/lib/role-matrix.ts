/**
 * Declarative role × page access matrix.
 *
 * Single source of truth for "which role can access which page".
 * Used to render the /admin/roles page so admins can see permissions
 * at a glance. Keep in sync with the actual `ROLES.*` guards on each page.
 */

import { Role } from "@/generated/prisma/client";
import { ROLES } from "@/lib/permissions";

export const ALL_ROLES: Role[] = [
  Role.ADMIN,
  Role.MANAGER,
  Role.PLANNER,
  Role.SALES,
  Role.OPERATOR,
  Role.QC,
  Role.ACCOUNTING,
];

export interface RoutePerm {
  /** Path shown in the matrix (locale-agnostic, no `/[locale]` prefix) */
  path: string;
  /** Short human label (Thai) */
  label: string;
  /** Roles allowed to access */
  roles: Role[];
  /** Optional note e.g. "read-only for some roles" */
  note?: string;
}

export interface RouteSection {
  /** Section heading */
  section: string;
  /** Section icon key (lucide name) */
  icon:
    | "LayoutDashboard"
    | "ShoppingCart"
    | "Factory"
    | "Receipt"
    | "FileSpreadsheet"
    | "BarChart3"
    | "Settings";
  routes: RoutePerm[];
}

export const ROLE_MATRIX: RouteSection[] = [
  {
    section: "Dashboard",
    icon: "LayoutDashboard",
    routes: [
      { path: "/dashboard", label: "ภาพรวม", roles: ROLES.ALL },
    ],
  },
  {
    section: "Sales",
    icon: "ShoppingCart",
    routes: [
      { path: "/sales/quotations", label: "ใบเสนอราคา", roles: ROLES.SALES_TEAM },
      { path: "/sales/orders", label: "ใบสั่งขาย", roles: ROLES.SALES_TEAM },
      { path: "/sales/customers", label: "ลูกค้า", roles: ROLES.SALES_TEAM },
    ],
  },
  {
    section: "Production",
    icon: "Factory",
    routes: [
      { path: "/production/products", label: "สินค้า", roles: ROLES.PRODUCTION, note: "อ่านได้ทุก role" },
      { path: "/production/materials", label: "วัตถุดิบ", roles: ROLES.PRODUCTION },
      { path: "/production/machines", label: "เครื่องจักร", roles: ROLES.PRODUCTION },
      { path: "/production/maintenance", label: "บำรุงรักษา", roles: ROLES.PRODUCTION },
      { path: "/production/plans", label: "แผนผลิต", roles: ROLES.PLANNING },
      { path: "/production/work-orders", label: "ใบสั่งผลิต", roles: ROLES.PRODUCTION },
    ],
  },
  {
    section: "Finance",
    icon: "Receipt",
    routes: [
      { path: "/finance/invoices", label: "ใบแจ้งหนี้", roles: ROLES.FINANCE },
      { path: "/finance/receipts", label: "ใบเสร็จรับเงิน", roles: ROLES.FINANCE },
      { path: "/finance/credit-notes", label: "ใบลดหนี้", roles: ROLES.FINANCE },
      { path: "/finance/tax-invoices", label: "ใบกำกับภาษี", roles: ROLES.FINANCE },
    ],
  },
  {
    section: "Procurement",
    icon: "FileSpreadsheet",
    routes: [
      { path: "/procurement/purchase-orders", label: "ใบสั่งซื้อ", roles: ROLES.PLANNING },
      { path: "/procurement/consumables", label: "วัสดุสิ้นเปลือง", roles: ROLES.PLANNING },
    ],
  },
  {
    section: "Reports",
    icon: "BarChart3",
    routes: [
      { path: "/reports", label: "รายงาน", roles: ROLES.MANAGEMENT },
    ],
  },
  {
    section: "Admin",
    icon: "Settings",
    routes: [
      { path: "/admin/users", label: "จัดการผู้ใช้", roles: ROLES.ADMIN_ONLY },
      { path: "/admin/roles", label: "สิทธิตาม Role", roles: ROLES.ADMIN_ONLY },
      { path: "/admin/billing", label: "การเรียกเก็บเงิน", roles: ROLES.ADMIN_ONLY },
      { path: "/admin/export", label: "Export ข้อมูล", roles: ROLES.MANAGEMENT },
      { path: "/admin/audit-log", label: "Audit Log", roles: ROLES.MANAGEMENT },
      { path: "/admin/settings", label: "ตั้งค่าองค์กร", roles: ROLES.ADMIN_ONLY },
    ],
  },
];

export const ROLE_DESCRIPTIONS: Record<Role, { label: string; desc: string; color: string }> = {
  [Role.ADMIN]: {
    label: "ผู้ดูแลระบบ",
    desc: "เข้าถึงได้ทุกหน้า รวมถึงจัดการผู้ใช้ การเงิน และตั้งค่าระบบ",
    color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  },
  [Role.MANAGER]: {
    label: "ผู้จัดการ",
    desc: "ดูแลการผลิต การขาย การเงิน และรายงาน (ไม่จัดการผู้ใช้/บิลลิ่ง)",
    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  },
  [Role.PLANNER]: {
    label: "ผู้วางแผน",
    desc: "จัดการแผนผลิต ใบสั่งผลิต สินค้า วัตถุดิบ เครื่องจักร และจัดซื้อ",
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  },
  [Role.SALES]: {
    label: "ฝ่ายขาย",
    desc: "ดูแลลูกค้า ใบเสนอราคา ใบสั่งขาย และเอกสารทางการเงิน",
    color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  },
  [Role.OPERATOR]: {
    label: "ผู้ปฏิบัติงาน",
    desc: "ดูและอัพเดทข้อมูลการผลิต สินค้า วัตถุดิบ เครื่องจักร และใบสั่งผลิต",
    color: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
  [Role.QC]: {
    label: "ควบคุมคุณภาพ",
    desc: "ดูภาพรวม (ยังไม่มีโมดูล QC เฉพาะ — กำลังพัฒนา)",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800",
  },
  [Role.ACCOUNTING]: {
    label: "บัญชี",
    desc: "เข้าถึงเอกสารทางการเงินทั้งหมด (ใบแจ้งหนี้ ใบเสร็จ ใบกำกับภาษี)",
    color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
  },
};

/** Count accessible routes for a given role */
export function countAccessibleRoutes(role: Role): number {
  let n = 0;
  for (const section of ROLE_MATRIX) {
    for (const route of section.routes) {
      if (route.roles.includes(role)) n++;
    }
  }
  return n;
}
