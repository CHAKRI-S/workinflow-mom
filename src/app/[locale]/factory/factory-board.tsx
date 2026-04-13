"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";

// ─── Types ──────────────────────────────────────────

interface ProductImage {
  id: string;
  url: string;
  caption: string | null;
}

interface BomMaterial {
  id: string;
  code: string;
  name: string;
  type: string | null;
  specification: string | null;
  dimensions: string | null;
  unit: string;
}

interface BomLine {
  id: string;
  qtyPerUnit: string | number;
  materialSize: string | null;
  materialType: string | null;
  piecesPerStock: number | null;
  notes: string | null;
  material: BomMaterial;
}

interface Product {
  id: string;
  code: string;
  name: string;
  cycleTimeMinutes: string | number | null;
  category: string | null;
  defaultColor: string | null;
  defaultSurfaceFinish: string | null;
  drawingNotes: string | null;
  requiresPainting: boolean;
  images: ProductImage[];
  bomLines: BomLine[];
}

interface Machine {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
}

interface WorkOrder {
  id: string;
  woNumber: string;
  productId: string;
  product: Product;
  cncMachineId: string | null;
  cncMachine: { id: string; code: string; name: string } | null;
  status: string;
  priority: string;
  plannedQty: string | number;
  completedQty: string | number;
  plannedStart: string;
  plannedEnd: string;
  color: string | null;
  materialStatus: string;
  materialSize: string | null;
  sortOrder: number;
  notes: string | null;
}

interface PendingSO {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  requestedDate: string;
  totalAmount: string | number;
  customer: { id: string; code: string; name: string };
  lines: Array<{
    id: string;
    productId: string;
    product: { id: string; code: string; name: string };
    quantity: string | number;
    color: string | null;
    surfaceFinish: string | null;
  }>;
}

// ─── Constants ──────────────────────────────────────

const REFRESH_INTERVAL = 30;

// ─── Date helpers ───────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatDayName(date: Date, locale: string): string {
  const names =
    locale === "th"
      ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[date.getDay()];
}

function formatDateShort(date: Date): string {
  return `${date.getDate()}`;
}

function formatMonthYear(date: Date, locale: string): string {
  if (locale === "th") {
    const months = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ];
    return `${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  }
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function parseLocale(): string {
  if (typeof window === "undefined") return "th";
  const path = window.location.pathname;
  const match = path.match(/^\/(th|en)/);
  return match ? match[1] : "th";
}

// ─── Status helpers ─────────────────────────────────

function getStatusBg(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-gray-200/80 border-gray-300 dark:bg-gray-700/80 dark:border-gray-600";
    case "RELEASED":
      return "bg-blue-100/60 border-blue-300 dark:bg-blue-900/60 dark:border-blue-700";
    case "IN_PROGRESS":
      return "bg-blue-100/70 border-blue-400 shadow-blue-500/10 shadow-lg dark:bg-blue-800/70 dark:border-blue-500 dark:shadow-blue-500/20";
    case "QC_MACHINING":
    case "QC_FINAL":
      return "bg-cyan-100/60 border-cyan-400 dark:bg-cyan-900/60 dark:border-cyan-600";
    case "SENT_TO_PAINTING":
    case "PAINTING_DONE":
      return "bg-purple-100/60 border-purple-400 dark:bg-purple-900/60 dark:border-purple-600";
    case "ENGRAVING":
      return "bg-indigo-100/60 border-indigo-400 dark:bg-indigo-900/60 dark:border-indigo-600";
    case "COMPLETED":
      return "bg-green-100/60 border-green-400 dark:bg-green-900/60 dark:border-green-600";
    case "ON_HOLD":
      return "bg-orange-100/60 border-orange-400 dark:bg-orange-900/60 dark:border-orange-500";
    default:
      return "bg-gray-200/80 border-gray-300 dark:bg-gray-700/80 dark:border-gray-600";
  }
}

function getStatusDot(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-gray-400";
    case "RELEASED":
      return "bg-blue-400";
    case "IN_PROGRESS":
      return "bg-blue-400 animate-pulse";
    case "QC_MACHINING":
    case "QC_FINAL":
      return "bg-cyan-400";
    case "SENT_TO_PAINTING":
    case "PAINTING_DONE":
      return "bg-purple-400";
    case "ENGRAVING":
      return "bg-indigo-400";
    case "COMPLETED":
      return "bg-green-400";
    case "ON_HOLD":
      return "bg-orange-400";
    default:
      return "bg-gray-400";
  }
}

function getStatusLabel(status: string, t: ReturnType<typeof useTranslations>): string {
  const key = `workOrder.status.${status}`;
  try {
    return t(key);
  } catch {
    return status;
  }
}

function getMaterialTag(
  materialStatus: string
): { label: string; className: string } {
  switch (materialStatus) {
    case "READY":
      return {
        label: "\u2713",
        className:
          "bg-green-500/30 text-green-300 border border-green-500/50",
      };
    case "ORDERED":
      return {
        label: "O",
        className:
          "bg-amber-500/30 text-amber-300 border border-amber-500/50",
      };
    case "NOT_ORDERED":
      return {
        label: "!",
        className:
          "bg-red-500/30 text-red-300 border border-red-500/50",
      };
    case "PARTIAL":
      return {
        label: "P",
        className:
          "bg-orange-500/30 text-orange-300 border border-orange-500/50",
      };
    default:
      return { label: "?", className: "bg-gray-500/30 text-gray-300" };
  }
}

// ─── Component ──────────────────────────────────────

export function FactoryBoard() {
  const t = useTranslations();
  const locale = parseLocale();

  // Data
  const [machines, setMachines] = useState<Machine[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [pendingSOs, setPendingSOs] = useState<PendingSO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clock, setClock] = useState(new Date());

  // Theme
  const [darkMode, setDarkMode] = useState(true);

  // Detail overlay
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  // Token from URL
  const tokenRef = useRef<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      tokenRef.current = params.get("token") || "";
    }
  }, []);

  // Theme: read from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("factory-theme");
    if (saved === "light") {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("factory-theme", newDark ? "dark" : "light");
  };

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(
        `/api/public/factory-board?token=${encodeURIComponent(tokenRef.current)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setMachines(data.machines);
      setWorkOrders(data.workOrders);
      setPendingSOs(data.pendingSOs || []);
      setLastUpdated(new Date());
    } catch {
      console.error("Failed to fetch factory board data");
    } finally {
      setLoading(false);
      if (isRefresh) {
        setTimeout(() => setRefreshing(false), 800);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(true);
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Week dates (current week, Mon-Sun)
  const days = useMemo(() => {
    const monday = getMondayOfWeek(new Date());
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      result.push(addDays(monday, i));
    }
    return result;
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Get WOs for a cell
  function getWOsForCell(machineId: string | null, day: Date): WorkOrder[] {
    return workOrders.filter((wo) => {
      const matchMachine =
        machineId === null
          ? wo.cncMachineId === null
          : wo.cncMachineId === machineId;
      if (!matchMachine) return false;
      const start = new Date(wo.plannedStart);
      const end = new Date(wo.plannedEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return day >= start && day <= end;
    });
  }

  // Format clock
  function formatClock(d: Date): string {
    return d.toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function formatDate(d: Date): string {
    return d.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // ─── Loading State ────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* ── Header Bar ──────────────────────────────── */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              W
            </div>
            <span className="text-gray-600 dark:text-gray-300 font-semibold text-lg hidden sm:inline">
              WorkinFlow MOM
            </span>
          </div>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
          <h1 className="text-gray-900 dark:text-white text-xl font-semibold">
            {t("factory.title")}
          </h1>
        </div>

        {/* Right: Live badge + Theme + Clock + Refresh */}
        <div className="flex items-center gap-6">
          {/* Refresh status */}
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            {refreshing ? (
              <span className="text-blue-500 dark:text-blue-400 animate-pulse">
                {t("factory.updating")}
              </span>
            ) : (
              <>
                <span className="hidden lg:inline">
                  {t("factory.autoRefresh")}:
                </span>
                <span className="font-mono text-gray-600 dark:text-gray-300 tabular-nums w-6 text-right">
                  {countdown}
                </span>
                <span className="hidden lg:inline">{t("factory.seconds")}</span>
              </>
            )}
          </div>

          {/* LIVE badge */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
              {t("factory.live")}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full px-3 py-1.5 text-sm transition-colors"
            title={darkMode ? t("factory.lightMode") : t("factory.darkMode")}
          >
            {darkMode ? (
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
            <span className="text-gray-600 dark:text-gray-300 hidden sm:inline">
              {darkMode ? t("factory.lightMode") : t("factory.darkMode")}
            </span>
          </button>

          {/* Clock */}
          <div className="text-right hidden md:block">
            <div className="font-mono text-xl text-gray-900 dark:text-white tabular-nums tracking-wider">
              {formatClock(clock)}
            </div>
            <div className="text-xs text-gray-500">
              {formatDate(clock)}
            </div>
          </div>
        </div>
      </header>

      {/* ── Week header ─────────────────────────────── */}
      <div className="px-4 py-2 bg-gray-100/40 dark:bg-gray-900/40 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between shrink-0">
        <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
          {formatMonthYear(days[0], locale)}
        </span>
        {lastUpdated && (
          <span className="text-gray-400 dark:text-gray-600 text-xs">
            {t("factory.lastUpdated")}: {formatClock(lastUpdated)}
          </span>
        )}
      </div>

      {/* ── Schedule Grid ───────────────────────────── */}
      <div className="flex-1 overflow-auto p-2">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr>
              {/* Machine column */}
              <th className="sticky left-0 z-20 bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-800 px-3 py-2 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase w-36 min-w-[9rem]">
                {t("workOrder.machine")}
              </th>
              {/* Day headers */}
              {days.map((day) => {
                const isToday = isSameDay(day, today);
                const weekend = isWeekend(day);
                return (
                  <th
                    key={day.toISOString()}
                    className={`border-b border-gray-200 dark:border-gray-800 px-1 py-2 text-center text-sm font-semibold ${
                      isToday
                        ? "bg-blue-50/30 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                        : weekend
                        ? "bg-gray-100/80 dark:bg-gray-900/80 text-gray-400 dark:text-gray-600"
                        : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div className="leading-tight">
                      <div className="uppercase text-xs">
                        {formatDayName(day, locale)}
                      </div>
                      <div
                        className={`text-lg font-bold ${
                          isToday ? "text-blue-500 dark:text-blue-400" : ""
                        }`}
                      >
                        {formatDateShort(day)}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Machine rows */}
            {machines.map((machine) => (
              <tr key={machine.id}>
                {/* Machine name */}
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-800 px-3 py-2 w-36 min-w-[9rem]">
                  <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {machine.code}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {machine.name}
                  </div>
                </td>
                {/* Day cells */}
                {days.map((day) => {
                  const cellWOs = getWOsForCell(machine.id, day);
                  const isToday = isSameDay(day, today);
                  const weekend = isWeekend(day);
                  return (
                    <td
                      key={day.toISOString()}
                      className={`border-b border-gray-200/50 dark:border-gray-800/50 px-1 py-1 align-top ${
                        isToday
                          ? "bg-blue-50/20 dark:bg-blue-950/20"
                          : weekend
                          ? "bg-gray-100/40 dark:bg-gray-900/40"
                          : "bg-gray-50 dark:bg-gray-950"
                      }`}
                    >
                      <div className="space-y-1 min-h-[3.5rem]">
                        {cellWOs.length === 0 && (
                          <div className="text-gray-300 dark:text-gray-800 text-xs text-center py-3">
                            -
                          </div>
                        )}
                        {cellWOs.map((wo) => {
                          const materialTag = getMaterialTag(wo.materialStatus);
                          return (
                            <button
                              key={wo.id}
                              onClick={() => {
                                setSelectedWO(wo);
                                setSelectedImageIdx(0);
                              }}
                              className={`w-full rounded-lg px-2 py-1.5 text-left border transition-all hover:scale-[1.02] hover:brightness-110 cursor-pointer ${getStatusBg(
                                wo.status
                              )}`}
                              title={t("factory.clickForDetails")}
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(
                                    wo.status
                                  )}`}
                                />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {wo.product.code}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-gray-600 dark:text-gray-300">
                                  {Number(wo.plannedQty)} {t("plan.pieces")}
                                </span>
                                <span
                                  className={`inline-flex items-center justify-center text-[10px] font-bold rounded px-1 py-0 leading-tight ${materialTag.className}`}
                                >
                                  {materialTag.label}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Unassigned row */}
            {workOrders.some((wo) => !wo.cncMachineId) && (
              <tr>
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-800 px-3 py-2 w-36 min-w-[9rem]">
                  <div className="font-semibold text-sm text-orange-500 dark:text-orange-400 truncate">
                    {t("plan.unassigned")}
                  </div>
                </td>
                {days.map((day) => {
                  const cellWOs = getWOsForCell(null, day);
                  const isToday = isSameDay(day, today);
                  const weekend = isWeekend(day);
                  return (
                    <td
                      key={day.toISOString()}
                      className={`border-b border-gray-200/50 dark:border-gray-800/50 px-1 py-1 align-top ${
                        isToday
                          ? "bg-blue-50/20 dark:bg-blue-950/20"
                          : weekend
                          ? "bg-gray-100/40 dark:bg-gray-900/40"
                          : "bg-gray-50 dark:bg-gray-950"
                      }`}
                    >
                      <div className="space-y-1 min-h-[3.5rem]">
                        {cellWOs.map((wo) => {
                          const materialTag = getMaterialTag(wo.materialStatus);
                          return (
                            <button
                              key={wo.id}
                              onClick={() => {
                                setSelectedWO(wo);
                                setSelectedImageIdx(0);
                              }}
                              className={`w-full rounded-lg px-2 py-1.5 text-left border transition-all hover:scale-[1.02] hover:brightness-110 cursor-pointer ${getStatusBg(
                                wo.status
                              )}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(
                                    wo.status
                                  )}`}
                                />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {wo.product.code}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-gray-600 dark:text-gray-300">
                                  {Number(wo.plannedQty)} {t("plan.pieces")}
                                </span>
                                <span
                                  className={`inline-flex items-center justify-center text-[10px] font-bold rounded px-1 py-0 leading-tight ${materialTag.className}`}
                                >
                                  {materialTag.label}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>

        {/* Empty state */}
        {workOrders.length === 0 && machines.length === 0 && (
          <div className="text-center py-24">
            <p className="text-gray-400 dark:text-gray-600 text-xl">{t("factory.noWork")}</p>
          </div>
        )}
      </div>

      {/* ── Pending SO Queue ─────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-gray-800 dark:text-gray-200 font-semibold text-sm">
            {t("factory.pendingQueue")}
          </span>
          <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full px-2 py-0.5">
            {pendingSOs.length}
          </span>
        </div>

        {pendingSOs.length === 0 ? (
          <div className="text-gray-400 dark:text-gray-600 text-sm text-center py-4">
            {t("factory.noPending")}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {pendingSOs.map((so) => (
              <div
                key={so.id}
                className="rounded-xl border bg-white border-gray-200 shadow-sm dark:bg-gray-800/60 dark:border-gray-700 p-3 min-w-[220px] max-w-[260px] shrink-0 space-y-2"
              >
                {/* SO number */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                    {so.orderNumber}
                  </span>
                  <span
                    className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                      so.status === "CONFIRMED"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300"
                    }`}
                  >
                    {so.status === "CONFIRMED" ? "CONFIRMED" : "DEPOSIT PENDING"}
                  </span>
                </div>

                {/* Customer */}
                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {so.customer.name}
                </div>

                {/* Requested date */}
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {t("factory.requestedDate")}:{" "}
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {new Date(so.requestedDate).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" })}
                  </span>
                </div>

                {/* Product lines */}
                <div className="space-y-1 border-t border-gray-100 dark:border-gray-700 pt-2">
                  {so.lines.map((line) => (
                    <div key={line.id} className="text-xs">
                      <span className="font-mono text-gray-800 dark:text-gray-200">
                        {line.product.code}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {" "}{"\u00d7"}{Number(line.quantity)}
                      </span>
                      {line.color && (
                        <span className="text-gray-400 dark:text-gray-500 ml-1">
                          ({line.color})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status Legend ────────────────────────────── */}
      <footer className="bg-white/60 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 px-6 py-2 flex items-center gap-4 flex-wrap shrink-0">
        {[
          { status: "PENDING", color: "bg-gray-400" },
          { status: "IN_PROGRESS", color: "bg-blue-400" },
          { status: "QC_MACHINING", color: "bg-cyan-400" },
          { status: "SENT_TO_PAINTING", color: "bg-purple-400" },
          { status: "COMPLETED", color: "bg-green-400" },
          { status: "ON_HOLD", color: "bg-orange-400" },
        ].map(({ status, color }) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              {getStatusLabel(status, t)}
            </span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3 text-gray-500 dark:text-gray-600 text-xs">
          <span className="bg-green-500/30 text-green-600 dark:text-green-300 border border-green-500/50 rounded px-1 text-[10px] font-bold">
            {"\u2713"}
          </span>
          <span>{t("workOrder.materialReadiness.READY")}</span>
          <span className="bg-red-500/30 text-red-600 dark:text-red-300 border border-red-500/50 rounded px-1 text-[10px] font-bold">
            !
          </span>
          <span>{t("workOrder.materialReadiness.NOT_ORDERED")}</span>
        </div>
      </footer>

      {/* ── Detail Overlay ───────────────────────────── */}
      {selectedWO && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedWO(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedWO.woNumber}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  {selectedWO.product.code} - {selectedWO.product.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedWO(null)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xl"
              >
                {"\u2715"}
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Top section: Status + Product Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Product Images */}
                <div className="space-y-3">
                  {selectedWO.product.images.length > 0 ? (
                    <>
                      {/* Main image */}
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <Image
                          src={selectedWO.product.images[selectedImageIdx]?.url || ""}
                          alt={selectedWO.product.images[selectedImageIdx]?.caption || selectedWO.product.name}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </div>
                      {/* Thumbnails */}
                      {selectedWO.product.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {selectedWO.product.images.map((img, idx) => (
                            <button
                              key={img.id}
                              onClick={() => setSelectedImageIdx(idx)}
                              className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                                idx === selectedImageIdx
                                  ? "border-blue-500 ring-2 ring-blue-500/30"
                                  : "border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                              }`}
                            >
                              <Image
                                src={img.url}
                                alt={img.caption || ""}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="aspect-[4/3] rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                      <span className="text-gray-400 dark:text-gray-600 text-lg">
                        No Image
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Info */}
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-3 h-3 rounded-full ${getStatusDot(
                        selectedWO.status
                      )}`}
                    />
                    <span
                      className={`text-lg font-semibold px-3 py-1 rounded-lg border ${getStatusBg(
                        selectedWO.status
                      )}`}
                    >
                      {getStatusLabel(selectedWO.status, t)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{t("workOrder.progress")}</span>
                      <span className="text-gray-900 dark:text-white font-mono">
                        {Number(selectedWO.completedQty)} / {Number(selectedWO.plannedQty)} {t("plan.pieces")}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Number(selectedWO.plannedQty) > 0
                              ? (Number(selectedWO.completedQty) /
                                  Number(selectedWO.plannedQty)) *
                                100
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
                    <h3 className="text-gray-900 dark:text-white font-semibold text-base">
                      {t("factory.productInfo")}
                    </h3>
                    <InfoRow
                      label={t("product.code")}
                      value={selectedWO.product.code}
                    />
                    <InfoRow
                      label={t("product.name")}
                      value={selectedWO.product.name}
                    />
                    {selectedWO.product.category && (
                      <InfoRow
                        label={t("product.category")}
                        value={selectedWO.product.category}
                      />
                    )}
                    {(selectedWO.color || selectedWO.product.defaultColor) && (
                      <InfoRow
                        label={t("workOrder.color")}
                        value={
                          selectedWO.color ||
                          selectedWO.product.defaultColor ||
                          ""
                        }
                      />
                    )}
                    {selectedWO.product.defaultSurfaceFinish && (
                      <InfoRow
                        label={t("quotation.surfaceFinish")}
                        value={selectedWO.product.defaultSurfaceFinish}
                      />
                    )}
                    {selectedWO.materialSize && (
                      <InfoRow
                        label={t("workOrder.materialSize")}
                        value={selectedWO.materialSize}
                      />
                    )}
                    {selectedWO.cncMachine && (
                      <InfoRow
                        label={t("workOrder.machine")}
                        value={`${selectedWO.cncMachine.code} - ${selectedWO.cncMachine.name}`}
                      />
                    )}
                    {selectedWO.product.cycleTimeMinutes && (
                      <InfoRow
                        label={t("product.cycleTime")}
                        value={`${Number(selectedWO.product.cycleTimeMinutes)} ${t("product.minutesShort")}`}
                      />
                    )}
                    <InfoRow
                      label={t("workOrder.materialStatus")}
                      value={
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                            getMaterialTag(selectedWO.materialStatus).className
                          }`}
                        >
                          {getMaterialTag(selectedWO.materialStatus).label}{" "}
                          {t(
                            `workOrder.materialReadiness.${selectedWO.materialStatus}`
                          )}
                        </span>
                      }
                    />
                  </div>

                  {/* Drawing Notes */}
                  {selectedWO.product.drawingNotes && (
                    <div className="bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 rounded-xl p-4 space-y-2">
                      <h3 className="text-amber-700 dark:text-amber-300 font-semibold text-sm">
                        {t("factory.drawingNotes")}
                      </h3>
                      <p className="text-amber-800/80 dark:text-amber-100/80 text-sm whitespace-pre-wrap">
                        {selectedWO.product.drawingNotes}
                      </p>
                    </div>
                  )}

                  {/* WO Notes */}
                  {selectedWO.notes && (
                    <div className="bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
                      <h3 className="text-gray-600 dark:text-gray-300 font-semibold text-sm">
                        {t("common.notes")}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm whitespace-pre-wrap">
                        {selectedWO.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* BOM Materials */}
              {selectedWO.product.bomLines.length > 0 && (
                <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
                  <h3 className="text-gray-900 dark:text-white font-semibold text-base">
                    {t("factory.materialList")}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                          <th className="text-left py-2 px-2 font-medium">
                            {t("material.code")}
                          </th>
                          <th className="text-left py-2 px-2 font-medium">
                            {t("material.name")}
                          </th>
                          <th className="text-left py-2 px-2 font-medium">
                            {t("material.type")}
                          </th>
                          <th className="text-left py-2 px-2 font-medium">
                            {t("product.materialSize")}
                          </th>
                          <th className="text-right py-2 px-2 font-medium">
                            {t("product.qtyPerUnit")}
                          </th>
                          <th className="text-right py-2 px-2 font-medium">
                            {t("product.piecesPerStock")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWO.product.bomLines.map((bom) => (
                          <tr
                            key={bom.id}
                            className="border-b border-gray-200/50 dark:border-gray-800/50 text-gray-700 dark:text-gray-300"
                          >
                            <td className="py-2 px-2 font-mono text-xs">
                              {bom.material.code}
                            </td>
                            <td className="py-2 px-2">
                              {bom.material.name}
                            </td>
                            <td className="py-2 px-2 text-gray-500 dark:text-gray-400">
                              {bom.materialType || bom.material.type || "-"}
                            </td>
                            <td className="py-2 px-2 text-gray-500 dark:text-gray-400">
                              {bom.materialSize ||
                                bom.material.dimensions ||
                                "-"}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              {Number(bom.qtyPerUnit)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              {bom.piecesPerStock || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Utility Components ─────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500 dark:text-gray-500 text-sm shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-white text-sm text-right font-medium">
        {value}
      </span>
    </div>
  );
}
