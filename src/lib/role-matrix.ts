/**
 * Declarative role × page access matrix.
 *
 * Single source of truth for "which role can access which page".
 * Used to render the /admin/roles page so admins can see permissions
 * at a glance. Keep in sync with the actual `ROLES.*` guards on each page.
 *
 * NOTE: This file is imported by client components, so it cannot import
 * anything from `@/generated/prisma/client` (would pull `node:module`
 * into the client bundle). We use string literal union `RoleName` instead.
 */

export type RoleName =
  | "ADMIN"
  | "MANAGER"
  | "PLANNER"
  | "SALES"
  | "OPERATOR"
  | "QC"
  | "ACCOUNTING";

export const ALL_ROLES: RoleName[] = [
  "ADMIN",
  "MANAGER",
  "PLANNER",
  "SALES",
  "OPERATOR",
  "QC",
  "ACCOUNTING",
];

// Local mirror of the role groups in src/lib/permissions.ts.
// Kept in sync manually — if you change a group there, update it here too.
const GROUPS: Record<string, RoleName[]> = {
  ALL: ["ADMIN", "MANAGER", "PLANNER", "SALES", "OPERATOR", "QC", "ACCOUNTING"],
  MANAGEMENT: ["ADMIN", "MANAGER"],
  PLANNING: ["ADMIN", "MANAGER", "PLANNER"],
  SALES_TEAM: ["ADMIN", "MANAGER", "SALES"],
  FINANCE: ["ADMIN", "MANAGER", "ACCOUNTING", "SALES"],
  PRODUCTION: ["ADMIN", "MANAGER", "PLANNER", "OPERATOR"],
  QUALITY: ["ADMIN", "MANAGER", "QC"],
  ADMIN_ONLY: ["ADMIN"],
};

export interface RoutePerm {
  /** Path shown in the matrix (locale-agnostic, no `/[locale]` prefix) */
  path: string;
  /** Short human label (Thai) */
  label: string;
  /** Roles allowed to access */
  roles: RoleName[];
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
      { path: "/dashboard", label: "ภาพรวม", roles: GROUPS.ALL },
    ],
  },
  {
    section: "Sales",
    icon: "ShoppingCart",
    routes: [
      { path: "/sales/quotations", label: "ใบเสนอราคา", roles: GROUPS.SALES_TEAM },
      { path: "/sales/orders", label: "ใบสั่งขาย", roles: GROUPS.SALES_TEAM },
      { path: "/sales/customers", label: "ลูกค้า", roles: GROUPS.SALES_TEAM },
    ],
  },
  {
    section: "Production",
    icon: "Factory",
    routes: [
      { path: "/production/products", label: "สินค้า", roles: GROUPS.PRODUCTION, note: "อ่านได้ทุก role" },
      { path: "/production/materials", label: "วัตถุดิบ", roles: GROUPS.PRODUCTION },
      { path: "/production/machines", label: "เครื่องจักร", roles: GROUPS.PRODUCTION },
      { path: "/production/maintenance", label: "บำรุงรักษา", roles: GROUPS.PRODUCTION },
      { path: "/production/plans", label: "แผนผลิต", roles: GROUPS.PLANNING },
      { path: "/production/work-orders", label: "ใบสั่งผลิต", roles: GROUPS.PRODUCTION },
    ],
  },
  {
    section: "Finance",
    icon: "Receipt",
    routes: [
      { path: "/finance/invoices", label: "ใบแจ้งหนี้", roles: GROUPS.FINANCE },
      { path: "/finance/receipts", label: "ใบเสร็จรับเงิน", roles: GROUPS.FINANCE },
      { path: "/finance/credit-notes", label: "ใบลดหนี้", roles: GROUPS.FINANCE },
      { path: "/finance/tax-invoices", label: "ใบกำกับภาษี", roles: GROUPS.FINANCE },
    ],
  },
  {
    section: "Procurement",
    icon: "FileSpreadsheet",
    routes: [
      { path: "/procurement/purchase-orders", label: "ใบสั่งซื้อ", roles: GROUPS.PLANNING },
      { path: "/procurement/consumables", label: "วัสดุสิ้นเปลือง", roles: GROUPS.PLANNING },
    ],
  },
  {
    section: "Reports",
    icon: "BarChart3",
    routes: [
      { path: "/reports", label: "รายงาน", roles: GROUPS.MANAGEMENT },
    ],
  },
  {
    section: "Admin",
    icon: "Settings",
    routes: [
      { path: "/admin/users", label: "จัดการผู้ใช้", roles: GROUPS.ADMIN_ONLY },
      { path: "/admin/roles", label: "สิทธิตาม Role", roles: GROUPS.ADMIN_ONLY },
      { path: "/admin/billing", label: "การเรียกเก็บเงิน", roles: GROUPS.ADMIN_ONLY },
      { path: "/admin/export", label: "Export ข้อมูล", roles: GROUPS.MANAGEMENT },
      { path: "/admin/audit-log", label: "Audit Log", roles: GROUPS.MANAGEMENT },
      { path: "/admin/settings", label: "ตั้งค่าองค์กร", roles: GROUPS.ADMIN_ONLY },
    ],
  },
];

export const ROLE_DESCRIPTIONS: Record<RoleName, { label: string; desc: string; color: string }> = {
  ADMIN: {
    label: "ผู้ดูแลระบบ",
    desc: "เข้าถึงได้ทุกหน้า รวมถึงจัดการผู้ใช้ การเงิน และตั้งค่าระบบ",
    color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  },
  MANAGER: {
    label: "ผู้จัดการ",
    desc: "ดูแลการผลิต การขาย การเงิน และรายงาน (ไม่จัดการผู้ใช้/บิลลิ่ง)",
    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  },
  PLANNER: {
    label: "ผู้วางแผน",
    desc: "จัดการแผนผลิต ใบสั่งผลิต สินค้า วัตถุดิบ เครื่องจักร และจัดซื้อ",
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  },
  SALES: {
    label: "ฝ่ายขาย",
    desc: "ดูแลลูกค้า ใบเสนอราคา ใบสั่งขาย และเอกสารทางการเงิน",
    color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  },
  OPERATOR: {
    label: "ผู้ปฏิบัติงาน",
    desc: "ดูและอัพเดทข้อมูลการผลิต สินค้า วัตถุดิบ เครื่องจักร และใบสั่งผลิต",
    color: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
  QC: {
    label: "ควบคุมคุณภาพ",
    desc: "ดูภาพรวม (ยังไม่มีโมดูล QC เฉพาะ — กำลังพัฒนา)",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800",
  },
  ACCOUNTING: {
    label: "บัญชี",
    desc: "เข้าถึงเอกสารทางการเงินทั้งหมด (ใบแจ้งหนี้ ใบเสร็จ ใบกำกับภาษี)",
    color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
  },
};

/** Count accessible routes for a given role */
export function countAccessibleRoutes(role: RoleName): number {
  let n = 0;
  for (const section of ROLE_MATRIX) {
    for (const route of section.routes) {
      if (route.roles.includes(role)) n++;
    }
  }
  return n;
}
