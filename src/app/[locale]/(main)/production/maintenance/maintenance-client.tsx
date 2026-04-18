"use client";

import { useState, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wrench,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Machine {
  id: string;
  code: string;
  name: string;
}

interface MaintenanceLog {
  id: string;
  cncMachineId: string;
  type: string;
  status: string;
  description: string;
  performedBy: string | null;
  cost: string | null;
  scheduledDate: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  cncMachine: Machine;
}

interface Props {
  logs: MaintenanceLog[];
  machines: Machine[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: "ทั้งหมด", value: "" },
  { label: "กำหนดการ", value: "SCHEDULED" },
  { label: "เกินกำหนด", value: "OVERDUE" },
  { label: "กำลังดำเนินการ", value: "IN_PROGRESS" },
  { label: "เสร็จสิ้น", value: "COMPLETED" },
] as const;

const MAINTENANCE_TYPES = [
  { value: "PREVENTIVE", label: "ป้องกัน" },
  { value: "CORRECTIVE", label: "แก้ไข" },
  { value: "INSPECTION", label: "ตรวจสอบ" },
  { value: "CALIBRATION", label: "สอบเทียบ" },
] as const;

// ─── Badge helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    SCHEDULED: {
      label: "กำหนดการ",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    },
    OVERDUE: {
      label: "เกินกำหนด",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
    IN_PROGRESS: {
      label: "กำลังดำเนินการ",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    COMPLETED: {
      label: "เสร็จสิ้น",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
  };
  const cfg = map[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PREVENTIVE: {
      label: "ป้องกัน",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
    CORRECTIVE: {
      label: "แก้ไข",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
    INSPECTION: {
      label: "ตรวจสอบ",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    },
    CALIBRATION: {
      label: "สอบเทียบ",
      className:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    },
  };
  const cfg = map[type] ?? {
    label: type,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCost(cost: string | null): string {
  if (cost === null || cost === undefined) return "—";
  const n = Number(cost);
  if (isNaN(n)) return "—";
  return (
    "฿" +
    n.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function isOverdue(log: MaintenanceLog): boolean {
  if (log.status === "COMPLETED" || log.status === "IN_PROGRESS") return false;
  return new Date(log.scheduledDate) < new Date();
}

function resolvedStatus(log: MaintenanceLog): string {
  if (log.status === "SCHEDULED" && isOverdue(log)) return "OVERDUE";
  return log.status;
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateFormState {
  machineId: string;
  type: string;
  description: string;
  scheduledDate: string;
  performedBy: string;
  cost: string;
  notes: string;
}

const EMPTY_FORM: CreateFormState = {
  machineId: "",
  type: "PREVENTIVE",
  description: "",
  scheduledDate: "",
  performedBy: "",
  cost: "",
  notes: "",
};

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  machines: Machine[];
  onCreated: () => void;
}

function CreateModal({ open, onClose, machines, onCreated }: CreateModalProps) {
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof CreateFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.machineId || !form.type || !form.description || !form.scheduledDate) {
      setError("กรุณากรอกข้อมูลที่จำเป็น");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/production/machines/${form.machineId}/maintenance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: form.type,
            description: form.description,
            scheduledDate: form.scheduledDate,
            performedBy: form.performedBy || null,
            cost: form.cost || null,
            notes: form.notes || null,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to create");
      }
      onCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            สร้างรายการซ่อมบำรุง
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* Machine */}
          <div className="space-y-1.5">
            <Label>
              เครื่อง <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.machineId}
              onValueChange={(v) => { if (v) set("machineId", v); }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกเครื่อง" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>
              ประเภท <span className="text-red-500">*</span>
            </Label>
            <Select value={form.type} onValueChange={(v) => { if (v) set("type", v); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>
              รายละเอียด <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="เปลี่ยนน้ำมันหล่อ, ตรวจสอบ spindle..."
              rows={2}
              required
            />
          </div>

          {/* Scheduled Date */}
          <div className="space-y-1.5">
            <Label>
              วันที่กำหนด <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => set("scheduledDate", e.target.value)}
              required
            />
          </div>

          {/* Performed By + Cost (2 col) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ผู้ดำเนินการ</Label>
              <Input
                value={form.performedBy}
                onChange={(e) => set("performedBy", e.target.value)}
                placeholder="ช่างซ่อม / บริษัท"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ค่าใช้จ่าย (บาท)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(e) => set("cost", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="หมายเหตุเพิ่มเติม..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              สร้างรายการ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MaintenanceClient({ logs, machines }: Props) {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Apply filters
  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const effective = resolvedStatus(log);

      if (statusFilter) {
        if (effective !== statusFilter) return false;
      }
      if (machineFilter && log.cncMachineId !== machineFilter) return false;
      if (typeFilter && log.type !== typeFilter) return false;
      return true;
    });
  }, [logs, statusFilter, machineFilter, typeFilter]);

  const handleStatusUpdate = async (log: MaintenanceLog, newStatus: string) => {
    setActionLoading(`${log.id}-${newStatus}`);
    try {
      await fetch(
        `/api/production/machines/${log.cncMachineId}/maintenance/${log.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (log: MaintenanceLog) => {
    if (!confirm("ต้องการลบรายการซ่อมบำรุงนี้?")) return;
    setActionLoading(`${log.id}-delete`);
    try {
      await fetch(
        `/api/production/machines/${log.cncMachineId}/maintenance/${log.id}`,
        { method: "DELETE" }
      );
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-blue-500" />
            ซ่อมบำรุง
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ตารางซ่อมบำรุงเครื่อง CNC
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          สร้างรายการ
        </Button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === f.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Machine select */}
        <select
          value={machineFilter}
          onChange={(e) => setMachineFilter(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">เครื่องทั้งหมด</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </select>

        {/* Type select */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ประเภททั้งหมด</option>
          {MAINTENANCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 mb-3">
            <Wrench className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            ยังไม่มีรายการซ่อมบำรุง
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            คลิก "สร้างรายการ" เพื่อเพิ่มรายการซ่อมบำรุง
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">เครื่อง</TableHead>
                <TableHead className="text-xs">ประเภท</TableHead>
                <TableHead className="text-xs">รายละเอียด</TableHead>
                <TableHead className="text-xs">สถานะ</TableHead>
                <TableHead className="text-xs">วันที่กำหนด</TableHead>
                <TableHead className="text-xs">ผู้ดำเนินการ</TableHead>
                <TableHead className="text-xs">ค่าใช้จ่าย</TableHead>
                <TableHead className="text-xs text-right">การดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const effective = resolvedStatus(log);
                const isRowOverdue = effective === "OVERDUE";
                return (
                  <TableRow
                    key={log.id}
                    className={
                      isRowOverdue
                        ? "bg-red-50/40 dark:bg-red-900/10"
                        : undefined
                    }
                  >
                    {/* Machine */}
                    <TableCell className="text-sm font-medium whitespace-nowrap">
                      <span className="font-mono text-xs text-muted-foreground mr-1">
                        {log.cncMachine.code}
                      </span>
                      {log.cncMachine.name}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <TypeBadge type={log.type} />
                    </TableCell>

                    {/* Description */}
                    <TableCell className="text-sm text-gray-700 dark:text-gray-300 max-w-[180px]">
                      <span title={log.description}>
                        {log.description.length > 40
                          ? log.description.slice(0, 40) + "…"
                          : log.description}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <StatusBadge status={effective} />
                    </TableCell>

                    {/* Scheduled Date */}
                    <TableCell className="text-sm whitespace-nowrap">
                      <span
                        className={
                          isRowOverdue
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : ""
                        }
                      >
                        {formatDate(log.scheduledDate)}
                      </span>
                    </TableCell>

                    {/* Performed By */}
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {log.performedBy ?? "—"}
                    </TableCell>

                    {/* Cost */}
                    <TableCell className="text-sm font-mono whitespace-nowrap">
                      {formatCost(log.cost)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        {/* Start button — SCHEDULED → IN_PROGRESS */}
                        {(log.status === "SCHEDULED" || effective === "OVERDUE") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            disabled={actionLoading === `${log.id}-IN_PROGRESS`}
                            onClick={() => handleStatusUpdate(log, "IN_PROGRESS")}
                            title="เริ่มดำเนินการ"
                          >
                            {actionLoading === `${log.id}-IN_PROGRESS` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 mr-0.5" />
                                เริ่ม
                              </>
                            )}
                          </Button>
                        )}

                        {/* Complete button — IN_PROGRESS → COMPLETED */}
                        {log.status === "IN_PROGRESS" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                            disabled={actionLoading === `${log.id}-COMPLETED`}
                            onClick={() => handleStatusUpdate(log, "COMPLETED")}
                            title="ทำเสร็จ"
                          >
                            {actionLoading === `${log.id}-COMPLETED` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-0.5" />
                                เสร็จ
                              </>
                            )}
                          </Button>
                        )}

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20"
                          disabled={actionLoading === `${log.id}-delete`}
                          onClick={() => handleDelete(log)}
                          title="ลบ"
                        >
                          {actionLoading === `${log.id}-delete` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create Modal ── */}
      <CreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        machines={machines}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
