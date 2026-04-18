"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  CalendarIcon,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────

interface Product {
  id: string;
  code: string;
  name: string;
  cycleTimeMinutes: string | number | null;
  category: string | null;
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
  sortOrder: number;
}

interface SOLine {
  id: string;
  salesOrderId: string;
  productId: string;
  product: { id: string; code: string; name: string };
  quantity: string | number;
  color: string | null;
  surfaceFinish: string | null;
  materialSpec: string | null;
  deliveredQty: string | number;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  status: string;
  customer: { id: string; name: string; code: string };
  lines: SOLine[];
}

type ViewMode = "week" | "month";

// ─── Date helpers ───────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getFirstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
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

function formatDateShort(date: Date): string {
  return `${date.getDate()}`;
}

function formatDayName(date: Date, locale: string): string {
  const names =
    locale === "th"
      ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[date.getDay()];
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

function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocale(): string {
  if (typeof window === "undefined") return "th";
  const path = window.location.pathname;
  const match = path.match(/^\/(th|en)/);
  return match ? match[1] : "th";
}

// ─── WO status colors ───────────────────────────────

function getStatusColor(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    case "RELEASED":
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "QC_MACHINING":
    case "QC_FINAL":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300";
    case "SENT_TO_PAINTING":
    case "PAINTING_DONE":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "ENGRAVING":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
    case "COMPLETED":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "ON_HOLD":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    case "CANCELLED":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  }
}

// ─── Component ──────────────────────────────────────

export function PlanScheduler() {
  const t = useTranslations();
  const router = useRouter();
  const locale = parseLocale();

  // Data state
  const [machines, setMachines] = useState<Machine[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [availableSOs, setAvailableSOs] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [viewDate, setViewDate] = useState(() => getMondayOfWeek(new Date()));

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMachineId, setDialogMachineId] = useState<string>("");
  const [dialogDate, setDialogDate] = useState<string>("");

  // Form state
  const [selectedSOId, setSelectedSOId] = useState<string>("");
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [formMachineId, setFormMachineId] = useState<string>("");
  const [formStart, setFormStart] = useState<string>("");
  const [formEnd, setFormEnd] = useState<string>("");
  const [formQty, setFormQty] = useState<string>("");
  const [formMaterialStatus, setFormMaterialStatus] = useState<string>("NOT_ORDERED");
  const [submitting, setSubmitting] = useState(false);

  // Drag & drop state
  const [dragWoId, setDragWoId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ machineId: string | null; dateStr: string } | null>(null);
  const [dragUpdating, setDragUpdating] = useState(false);

  // ─── Fetch data ─────────────────────────────────

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/production/plans/schedule");
      if (!res.ok) return;
      const data = await res.json();
      setMachines(data.machines);
      setWorkOrders(data.workOrders);
    } catch {
      console.error("Failed to fetch schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableSOs = useCallback(async () => {
    try {
      const res = await fetch("/api/production/plans/available-so");
      if (!res.ok) return;
      const data = await res.json();
      setAvailableSOs(data);
    } catch {
      console.error("Failed to fetch available SOs");
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
    fetchAvailableSOs();
  }, [fetchSchedule, fetchAvailableSOs]);

  // ─── Date range ─────────────────────────────────

  const days = useMemo(() => {
    const result: Date[] = [];
    if (viewMode === "week") {
      for (let i = 0; i < 7; i++) {
        result.push(addDays(viewDate, i));
      }
    } else {
      const first = getFirstOfMonth(viewDate);
      const count = getDaysInMonth(viewDate);
      for (let i = 0; i < count; i++) {
        result.push(addDays(first, i));
      }
    }
    return result;
  }, [viewMode, viewDate]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // ─── Navigate ───────────────────────────────────

  function goToday() {
    if (viewMode === "week") {
      setViewDate(getMondayOfWeek(new Date()));
    } else {
      setViewDate(getFirstOfMonth(new Date()));
    }
  }

  function goPrev() {
    if (viewMode === "week") {
      setViewDate(addDays(viewDate, -7));
    } else {
      const d = new Date(viewDate);
      d.setMonth(d.getMonth() - 1);
      setViewDate(getFirstOfMonth(d));
    }
  }

  function goNext() {
    if (viewMode === "week") {
      setViewDate(addDays(viewDate, 7));
    } else {
      const d = new Date(viewDate);
      d.setMonth(d.getMonth() + 1);
      setViewDate(getFirstOfMonth(d));
    }
  }

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    if (mode === "week") {
      setViewDate(getMondayOfWeek(viewDate));
    } else {
      setViewDate(getFirstOfMonth(viewDate));
    }
  }

  // ─── WO placement ──────────────────────────────

  function getWOsForCell(machineId: string | null, day: Date): WorkOrder[] {
    return workOrders.filter((wo) => {
      const matchMachine =
        machineId === null ? wo.cncMachineId === null : wo.cncMachineId === machineId;
      if (!matchMachine) return false;
      const start = new Date(wo.plannedStart);
      const end = new Date(wo.plannedEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return day >= start && day <= end;
    });
  }

  // ─── Drag & drop handlers ───────────────────────

  function handleDragStart(e: React.DragEvent, wo: WorkOrder) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", wo.id);
    setDragWoId(wo.id);
  }

  function handleDragEnd() {
    setDragWoId(null);
    setDropTarget(null);
  }

  function handleCellDragOver(e: React.DragEvent, machineId: string | null, day: Date) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ machineId, dateStr: formatISO(day) });
  }

  function handleCellDragLeave() {
    setDropTarget(null);
  }

  async function handleCellDrop(
    e: React.DragEvent,
    targetMachineId: string | null,
    targetDay: Date
  ) {
    e.preventDefault();
    const woId = e.dataTransfer.getData("text/plain");
    if (!woId) return;

    const wo = workOrders.find((w) => w.id === woId);
    if (!wo) return;

    // Calculate duration and shift dates
    const originalStart = new Date(wo.plannedStart);
    const originalEnd = new Date(wo.plannedEnd);
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    // Align new start to midnight
    const newStart = new Date(targetDay);
    newStart.setHours(0, 0, 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Skip if nothing actually changed
    const machineChanged = targetMachineId !== wo.cncMachineId;
    const dateChanged = formatISO(newStart) !== formatISO(originalStart);
    if (!machineChanged && !dateChanged) {
      setDragWoId(null);
      setDropTarget(null);
      return;
    }

    setDragUpdating(true);
    try {
      const res = await fetch(`/api/production/work-orders/${woId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cncMachineId: targetMachineId,
          plannedStart: formatISO(newStart),
          plannedEnd: formatISO(newEnd),
        }),
      });
      if (res.ok) {
        await fetchSchedule();
      }
    } catch {
      console.error("drag-drop update failed");
    } finally {
      setDragWoId(null);
      setDropTarget(null);
      setDragUpdating(false);
    }
  }

  // ─── Dialog ─────────────────────────────────────

  function openAddDialog(machineId: string, date: Date) {
    const dateStr = formatISO(date);
    setDialogMachineId(machineId);
    setDialogDate(dateStr);
    setFormMachineId(machineId);
    setFormStart(dateStr);
    setFormEnd(dateStr);
    setFormQty("");
    setSelectedSOId("");
    setSelectedLineId("");
    setDialogOpen(true);
  }

  function openAddDialogGeneral() {
    const dateStr = formatISO(today);
    setDialogMachineId("");
    setDialogDate(dateStr);
    setFormMachineId(machines.length > 0 ? machines[0].id : "");
    setFormStart(dateStr);
    setFormEnd(dateStr);
    setFormQty("");
    setSelectedSOId("");
    setSelectedLineId("");
    setDialogOpen(true);
  }

  const selectedSO = availableSOs.find((so) => so.id === selectedSOId);
  const selectedLine = selectedSO?.lines.find((l) => l.id === selectedLineId);

  async function handleSubmit() {
    if (!selectedLineId || !formMachineId || !formStart || !formEnd || !formQty) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/production/plans/schedule/add-wo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderLineId: selectedLineId,
          cncMachineId: formMachineId,
          plannedStart: formStart,
          plannedEnd: formEnd,
          plannedQty: Number(formQty),
          color: selectedLine?.color || undefined,
          materialStatus: formMaterialStatus,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        await fetchSchedule();
      }
    } catch {
      console.error("Failed to create work order");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const headerLabel =
    viewMode === "week"
      ? `${formatMonthYear(viewDate, locale)}`
      : `${formatMonthYear(viewDate, locale)}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">
          {t("plan.title")}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => switchView("week")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "week"
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {t("plan.weekView")}
            </button>
            <button
              onClick={() => switchView("month")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "month"
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {t("plan.monthView")}
            </button>
          </div>

          {/* Navigation */}
          <div className="inline-flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={goPrev}>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              <CalendarIcon className="size-3.5 mr-1" />
              {t("plan.today")}
            </Button>
            <Button variant="outline" size="icon-sm" onClick={goNext}>
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[100px] text-center">
            {headerLabel}
          </span>

          {/* Add Work */}
          <Button size="sm" onClick={openAddDialogGeneral}>
            <PlusIcon className="size-4 mr-1" />
            {t("plan.addWork")}
          </Button>
        </div>
      </div>

      {/* Summary badge + drag hint */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs">
          {workOrders.length} WO / {machines.length} {t("workOrder.machine")}
        </Badge>
        {dragUpdating && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> อัปเดต...
          </span>
        )}
        <p className="text-xs text-muted-foreground hidden md:block">
          💡 ลาก Work Order เพื่อเปลี่ยนวันหรือเครื่อง
        </p>
      </div>

      {/* Schedule Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {/* Machine column header */}
                <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-40 min-w-[10rem]">
                  {t("workOrder.machine")}
                </th>
                {/* Day headers */}
                {days.map((day) => {
                  const isToday = isSameDay(day, today);
                  const weekend = isWeekend(day);
                  return (
                    <th
                      key={day.toISOString()}
                      className={`border-b border-gray-200 dark:border-gray-700 px-1 py-2 text-center text-xs font-semibold min-w-[5rem] ${
                        isToday
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          : weekend
                          ? "bg-gray-50/80 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      <div className="leading-tight">
                        <div className="uppercase">
                          {formatDayName(day, locale)}
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            isToday ? "text-blue-600 dark:text-blue-400" : ""
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
                <tr key={machine.id} className="group">
                  {/* Machine name cell */}
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-2 w-40 min-w-[10rem]">
                    <div className="font-medium text-sm truncate">
                      {machine.code}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {machine.name}
                    </div>
                  </td>
                  {/* Day cells */}
                  {days.map((day) => {
                    const cellWOs = getWOsForCell(machine.id, day);
                    const isToday = isSameDay(day, today);
                    const weekend = isWeekend(day);
                    const isDropTarget =
                      dropTarget?.machineId === machine.id &&
                      dropTarget?.dateStr === formatISO(day);
                    return (
                      <td
                        key={day.toISOString()}
                        onClick={() => openAddDialog(machine.id, day)}
                        onDragOver={(e) => handleCellDragOver(e, machine.id, day)}
                        onDragLeave={handleCellDragLeave}
                        onDrop={(e) => handleCellDrop(e, machine.id, day)}
                        className={`border-b border-gray-200 dark:border-gray-700 px-1 py-1 align-top cursor-pointer transition-colors min-w-[5rem] ${
                          isDropTarget
                            ? "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-400"
                            : isToday
                            ? "bg-blue-50/50 dark:bg-blue-900/10"
                            : weekend
                            ? "bg-gray-50/50 dark:bg-gray-800/50"
                            : "bg-white dark:bg-gray-900"
                        } hover:bg-blue-50 dark:hover:bg-blue-900/20`}
                      >
                        <div className="space-y-0.5 min-h-[2.5rem]">
                          {cellWOs.map((wo) => (
                            <div
                              key={wo.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                handleDragStart(e, wo);
                              }}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/production/work-orders/${wo.id}`
                                );
                              }}
                              className={`rounded-lg px-1.5 py-1 text-xs font-medium truncate cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity ${getStatusColor(
                                wo.status
                              )} ${dragWoId === wo.id ? "opacity-50 ring-2 ring-blue-400" : ""}`}
                              title={`${wo.woNumber} - ${wo.product.name} (${wo.plannedQty} ${t("plan.pieces")})`}
                            >
                              <div className="truncate">
                                {wo.product.code}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] opacity-75 truncate">
                                <span>{Number(wo.plannedQty)} {t("plan.pieces")}</span>
                                {wo.materialStatus && wo.materialStatus !== "READY" && (
                                  <span className={`inline-block px-1 rounded text-[9px] font-medium ${
                                    wo.materialStatus === "NOT_ORDERED" ? "bg-red-200 text-red-800 dark:bg-red-800/40 dark:text-red-300" :
                                    wo.materialStatus === "ORDERED" ? "bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-300" :
                                    wo.materialStatus === "PARTIAL" ? "bg-orange-200 text-orange-800 dark:bg-orange-800/40 dark:text-orange-300" :
                                    ""
                                  }`}>
                                    {wo.materialStatus === "NOT_ORDERED" ? "!" : wo.materialStatus === "ORDERED" ? "O" : "P"}
                                  </span>
                                )}
                                {wo.materialStatus === "READY" && (
                                  <span className="inline-block px-1 rounded text-[9px] font-medium bg-green-200 text-green-800 dark:bg-green-800/40 dark:text-green-300">
                                    ✓
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Unassigned row */}
              {(() => {
                const unassignedExists = workOrders.some(
                  (wo) => !wo.cncMachineId
                );
                if (!unassignedExists) return null;
                return (
                  <tr className="group">
                    <td className="sticky left-0 z-10 bg-orange-50 dark:bg-orange-900/10 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-2 w-40 min-w-[10rem]">
                      <div className="font-medium text-sm text-orange-600 dark:text-orange-400 truncate">
                        {t("plan.unassigned")}
                      </div>
                    </td>
                    {days.map((day) => {
                      const cellWOs = getWOsForCell(null, day);
                      const isToday = isSameDay(day, today);
                      const weekend = isWeekend(day);
                      const isDropTarget =
                        dropTarget?.machineId === null &&
                        dropTarget?.dateStr === formatISO(day);
                      return (
                        <td
                          key={day.toISOString()}
                          onDragOver={(e) => handleCellDragOver(e, null, day)}
                          onDragLeave={handleCellDragLeave}
                          onDrop={(e) => handleCellDrop(e, null, day)}
                          className={`border-b border-gray-200 dark:border-gray-700 px-1 py-1 align-top min-w-[5rem] ${
                            isDropTarget
                              ? "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-400"
                              : isToday
                              ? "bg-blue-50/50 dark:bg-blue-900/10"
                              : weekend
                              ? "bg-gray-50/50 dark:bg-gray-800/50"
                              : "bg-white dark:bg-gray-900"
                          }`}
                        >
                          <div className="space-y-0.5 min-h-[2.5rem]">
                            {cellWOs.map((wo) => (
                              <div
                                key={wo.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, wo);
                                }}
                                onDragEnd={handleDragEnd}
                                onClick={() =>
                                  router.push(
                                    `/production/work-orders/${wo.id}`
                                  )
                                }
                                className={`rounded-lg px-1.5 py-1 text-xs font-medium truncate cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity ${getStatusColor(
                                  wo.status
                                )} ${dragWoId === wo.id ? "opacity-50 ring-2 ring-blue-400" : ""}`}
                                title={`${wo.woNumber} - ${wo.product.name}`}
                              >
                                <div className="truncate">
                                  {wo.product.code}
                                </div>
                                <div className="text-[10px] opacity-75 truncate">
                                  {Number(wo.plannedQty)} {t("plan.pieces")}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty state */}
      {workOrders.length === 0 && machines.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{t("plan.emptyTrack")}</p>
        </div>
      )}

      {/* ─── Add Work Order Dialog ─────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("plan.addWork")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Step 1: Select SO */}
            <div className="space-y-1.5">
              <Label>{t("plan.selectSO")}</Label>
              {availableSOs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("plan.noApprovedSO")}
                </p>
              ) : (
                <Select
                  value={selectedSOId || undefined}
                  onValueChange={(val: string | null) => {
                    setSelectedSOId(val || "");
                    setSelectedLineId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("plan.selectSO")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSOs.map((so) => (
                      <SelectItem key={so.id} value={so.id}>
                        {so.orderNumber} - {so.customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Step 2: Select SO Line */}
            {selectedSO && (
              <div className="space-y-1.5">
                <Label>{t("plan.selectSOLine")}</Label>
                <Select
                  value={selectedLineId || undefined}
                  onValueChange={(val: string | null) => {
                    setSelectedLineId(val || "");
                    const line = selectedSO.lines.find(
                      (l) => l.id === val
                    );
                    if (line) {
                      setFormQty(
                        String(
                          Math.max(
                            0,
                            Number(line.quantity) -
                              Number(line.deliveredQty)
                          )
                        )
                      );
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("plan.selectSOLine")} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSO.lines.map((line) => {
                      const remaining =
                        Number(line.quantity) - Number(line.deliveredQty);
                      return (
                        <SelectItem key={line.id} value={line.id}>
                          {line.product.code} - {line.product.name} (
                          {remaining} {t("plan.pieces")})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Step 3: Machine + dates + qty */}
            {selectedLineId && (
              <>
                {/* Machine */}
                <div className="space-y-1.5">
                  <Label>{t("plan.selectMachine")}</Label>
                  <Select
                    value={formMachineId || undefined}
                    onValueChange={(val: string | null) =>
                      setFormMachineId(val || "")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("plan.selectMachine")} />
                    </SelectTrigger>
                    <SelectContent>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.code} - {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("plan.plannedStart")}</Label>
                    <Input
                      type="date"
                      value={formStart}
                      onChange={(e) => setFormStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("plan.plannedEnd")}</Label>
                    <Input
                      type="date"
                      value={formEnd}
                      onChange={(e) => setFormEnd(e.target.value)}
                    />
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label>{t("plan.plannedQty")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    placeholder={t("plan.plannedQty")}
                  />
                </div>

                {/* Material Status */}
                <div className="space-y-1.5">
                  <Label>{t("workOrder.materialStatus")}</Label>
                  <Select
                    value={formMaterialStatus}
                    onValueChange={(v) => setFormMaterialStatus(v ?? "NOT_ORDERED")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="READY">{t("workOrder.materialReadiness.READY")}</SelectItem>
                      <SelectItem value="ORDERED">{t("workOrder.materialReadiness.ORDERED")}</SelectItem>
                      <SelectItem value="NOT_ORDERED">{t("workOrder.materialReadiness.NOT_ORDERED")}</SelectItem>
                      <SelectItem value="PARTIAL">{t("workOrder.materialReadiness.PARTIAL")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected product info */}
                {selectedLine && (
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("plan.product")}
                      </span>
                      <span className="font-medium">
                        {selectedLine.product.code} -{" "}
                        {selectedLine.product.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("plan.customer")}
                      </span>
                      <span className="font-medium">
                        {selectedSO?.customer.name}
                      </span>
                    </div>
                    {selectedLine.color && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("workOrder.color")}
                        </span>
                        <span className="font-medium">
                          {selectedLine.color}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !selectedLineId ||
                !formMachineId ||
                !formStart ||
                !formEnd ||
                !formQty ||
                submitting
              }
            >
              {submitting ? t("common.loading") : t("plan.addWork")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
