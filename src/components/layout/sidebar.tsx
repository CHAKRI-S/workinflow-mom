"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";
import {
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronDown,
  Factory,
  FileSpreadsheet,
  Receipt,
  Menu,
  X,
} from "lucide-react";

interface NavChild {
  label: string;
  href: string;
  /** Only show when this feature is enabled (omit = always visible) */
  requiresFeature?:
    | "production"
    | "finance"
    | "maintenance"
    | "factoryDashboard"
    | "auditLog"
    | "purchaseOrders"
    | "advancedReports";
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavChild[];
  requiresFeature?: NavChild["requiresFeature"];
}

/** Brand block — shows tenant logo + name, with product byline underneath.
 *  Falls back to initial-badge when logo not uploaded, or the product mark
 *  while the tenant fetch is still in flight. */
function TenantBrand({
  name,
  logo,
  loading,
}: {
  name: string | null;
  logo: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <>
        <div className="h-9 w-9 rounded-lg bg-muted animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
        </div>
      </>
    );
  }

  const displayName = name ?? "WorkinFlow MOM";
  const initial = name?.trim().charAt(0).toUpperCase() || "W";

  return (
    <>
      {logo ? (
        // Use plain <img> — logo is served from R2 (external origin not
        // registered in next.config remotePatterns).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={displayName}
          className="h-9 w-9 rounded-lg object-contain bg-white border shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-sm font-semibold truncate" title={displayName}>
          {displayName}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          powered by WorkinFlow <span className="text-primary">MOM</span>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { hasFeature, tenant, loading } = usePlan();
  const [openMenus, setOpenMenus] = useState<string[]>(["sales", "production"]);
  const [mobileOpen, setMobileOpen] = useState(false);

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
      requiresFeature: "production",
      children: [
        { label: t("products"), href: "/production/products" },
        { label: t("materials"), href: "/production/materials" },
        { label: t("machines"), href: "/production/machines" },
        {
          label: t("maintenance"),
          href: "/production/maintenance",
          requiresFeature: "maintenance",
        },
        { label: t("plans"), href: "/production/plans" },
        { label: t("workOrders"), href: "/production/work-orders" },
      ],
    },
    {
      label: t("finance"),
      icon: <Receipt className="h-4 w-4" />,
      requiresFeature: "finance",
      children: [
        { label: t("invoices"), href: "/finance/invoices" },
        { label: t("receipts"), href: "/finance/receipts" },
        { label: t("creditNotes"), href: "/finance/credit-notes" },
        { label: t("taxInvoices"), href: "/finance/tax-invoices" },
        { label: t("whtTracking"), href: "/finance/wht-tracking" },
        { label: t("financeReports"), href: "/finance/reports" },
      ],
    },
    {
      label: t("procurement"),
      icon: <FileSpreadsheet className="h-4 w-4" />,
      requiresFeature: "purchaseOrders",
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
        { label: t("roles"), href: "/admin/roles" },
        { label: t("billing"), href: "/admin/billing" },
        { label: t("export"), href: "/admin/export" },
        {
          label: t("auditLog"),
          href: "/admin/audit-log",
          requiresFeature: "auditLog",
        },
        { label: t("settings"), href: "/admin/settings" },
      ],
    },
  ];

  const isActive = (href: string) => pathname === href;

  // Filter by feature flags
  const visibleNav = navItems
    .filter((item) => !item.requiresFeature || hasFeature(item.requiresFeature))
    .map((item) => ({
      ...item,
      children: item.children?.filter(
        (c) => !c.requiresFeature || hasFeature(c.requiresFeature)
      ),
    }));

  const navContent = (
    <>
      {/* Tenant brand */}
      <div className="p-4 border-b shrink-0 flex items-center gap-3">
        <TenantBrand
          name={tenant?.name ?? null}
          logo={tenant?.logo ?? null}
          loading={loading}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visibleNav.map((item) => {
          if (item.href) {
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
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
                      onClick={() => setMobileOpen(false)}
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
    </>
  );

  return (
    <>
      {/* Mobile top bar — only visible below md */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {loading ? (
            <div className="h-7 w-7 rounded-md bg-muted animate-pulse shrink-0" />
          ) : tenant?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo}
              alt={tenant.name}
              className="h-7 w-7 rounded-md object-contain bg-white border shrink-0"
            />
          ) : (
            <div className="h-7 w-7 rounded-md bg-blue-600 text-white flex items-center justify-center font-semibold text-xs shrink-0">
              {tenant?.name?.trim().charAt(0).toUpperCase() || "W"}
            </div>
          )}
          <span className="text-sm font-semibold tracking-tight truncate">
            {tenant?.name ?? "WorkinFlow MOM"}
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Dark backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          // Mobile: fixed overlay panel, slides in from left
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200",
          // Desktop: static, always visible
          "md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
