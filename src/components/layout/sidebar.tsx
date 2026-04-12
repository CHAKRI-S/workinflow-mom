"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Users,
  Package,
  Boxes,
  ClipboardList,
  Wrench,
  Cog,
  BarChart3,
  UserCog,
  Settings,
  ChevronDown,
  Factory,
  FileSpreadsheet,
  Receipt,
  CreditCard,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(["sales", "production"]);

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const navItems: NavItem[] = [
    {
      label: t("dashboard"),
      href: "/dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: t("sales"),
      icon: <ShoppingCart className="h-4 w-4" />,
      children: [
        { label: t("quotations"), href: "/sales/quotations" },
        { label: t("salesOrders"), href: "/sales/orders" },
        { label: t("customers"), href: "/sales/customers" },
      ],
    },
    {
      label: t("production"),
      icon: <Factory className="h-4 w-4" />,
      children: [
        { label: t("products"), href: "/production/products" },
        { label: t("materials"), href: "/production/materials" },
        { label: t("machines"), href: "/production/machines" },
        { label: t("plans"), href: "/production/plans" },
        { label: t("workOrders"), href: "/production/work-orders" },
      ],
    },
    {
      label: t("finance"),
      icon: <Receipt className="h-4 w-4" />,
      children: [
        { label: t("invoices"), href: "/finance/invoices" },
        { label: t("receipts"), href: "/finance/receipts" },
        { label: t("creditNotes"), href: "/finance/credit-notes" },
        { label: t("taxInvoices"), href: "/finance/tax-invoices" },
      ],
    },
    {
      label: t("procurement"),
      icon: <FileSpreadsheet className="h-4 w-4" />,
      children: [
        { label: t("purchaseOrders"), href: "/procurement/purchase-orders" },
        { label: t("consumables"), href: "/procurement/consumables" },
      ],
    },
    {
      label: t("reports"),
      href: "/reports",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: t("admin"),
      icon: <Settings className="h-4 w-4" />,
      children: [
        { label: t("users"), href: "/admin/users" },
        { label: t("settings"), href: "/admin/settings" },
      ],
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b">
        <h1 className="text-lg font-medium tracking-tight">
          WorkinFlow <span className="text-primary">MOM</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          Manufacturing Operations
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          if (item.href) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          }

          const menuKey = item.label;
          const isOpen = openMenus.includes(menuKey);
          const hasActiveChild = item.children?.some((c) => isActive(c.href));

          return (
            <div key={menuKey}>
              <button
                onClick={() => toggleMenu(menuKey)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium w-full transition-colors",
                  hasActiveChild
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="ml-7 mt-1 space-y-1">
                  {item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "block rounded-xl px-3 py-1.5 text-sm transition-colors",
                        isActive(child.href)
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
