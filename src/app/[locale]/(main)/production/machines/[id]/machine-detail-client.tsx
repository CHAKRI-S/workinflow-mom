"use client";

import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardHeader, CardTitle, CardAction,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useState, useMemo } from "react";
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, X, Wrench,
  CalendarClock, History, Play, CheckCircle2, AlertTriangle,
} from "lucide-react";

const MACHINE_TYPES = ["CNC_MILLING", "CNC_LATHE", "CNC_ROUTER", "CNC_ENGRAVING", "OTHER"] as const;
const MACHINE_STATUSES = ["AVAILABLE", "IN_USE", "MAINTENANCE", "OFFLINE"] as const;
const MAINTENANCE_TYPES = ["PREVENTIVE", "CORRECTIVE", "INSPECTION", "CALIBRATION"] as const;

const machineTypeLabel: Record<string, string> = {
  CNC_MILLING: "Milling", CNC_LATHE: "Lathe", CNC_ROUTER: "Router",
  CNC_ENGRAVING: "Engraving", OTHER: "Other",
};

interface MaintenanceLog {
  id: string;
  type: string;
  status: string;
  description: string;
  performedBy: string | null;
  cost: string | number | null;
  scheduledDate: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
}

interface Machine {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  maintenanceLogs: MaintenanceLog[];
  _count: { workOrders: number };
}

export function MachineDetailClient({ machine }: { machine: Machine }) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Split logs into upcoming vs history
  const { upcoming, history } = useMemo(() => {
    const up: MaintenanceLog[] = [];
    const hist: MaintenanceLog[] = [];
    for (const log of machine.maintenanceLogs) {
      if (log.status === "COMPLETED") {
        hist.push(log);
      } else {
        up.push(log);
      }
    }
    // Sort upcoming by scheduledDate ascending (nearest first)
    up.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    // Sort history by endDate/scheduledDate descending (newest first)
    hist.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
    return { upcoming: up, history: hist };
  }, [machine.maintenanceLogs]);

  // Machine edit form
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      code: machine.code,
      name: machine.name,
      type: machine.type,
      description: machine.description || "",
      status: machine.status,
    },
  });

  const currentType = watch("type");
  const currentStatus = watch("status");

  // Maintenance add form
  const {
    register: registerMaint,
    handleSubmit: handleSubmitMaint,
    setValue: setValueMaint,
    reset: resetMaint,
  } = useForm({
    defaultValues: {
      type: "PREVENTIVE",
      description: "",
      performedBy: "",
      cost: "",
      scheduledDate: "",
      notes: "",
    },
  });

  const onSubmitMachine = async (data: Record<string, string>) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/production/machines/${machine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitMaintenance = async (data: Record<string, string>) => {
    setMaintenanceLoading(true);
    try {
      const res = await fetch(`/api/production/machines/${machine.id}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          cost: data.cost || null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      resetMaint();
      setShowAddForm(false);
      router.refresh();
    } catch {
      alert("Failed to add maintenance");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleStatusChange = async (logId: string, newStatus: string) => {
    await fetch(`/api/production/machines/${machine.id}/maintenance/${logId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm(t("machine.confirmDeleteLog"))) return;
    await fetch(`/api/production/machines/${machine.id}/maintenance/${logId}`, {
      method: "DELETE",
    });
    router.refresh();
  };

  const formatCost = (cost: string | number | null) => {
    if (cost === null || cost === undefined) return "-";
    return Number(cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString();
  };

  const isOverdue = (log: MaintenanceLog) => {
    if (log.status === "COMPLETED") return false;
    return new Date(log.scheduledDate) < new Date();
  };

  const daysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/production/machines">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {machine.code} — {machine.name}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl p-3 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl p-3 text-sm">Updated successfully</div>
      )}

      {/* Machine Info */}
      <form onSubmit={handleSubmit(onSubmitMachine)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              {t("machine.edit")}
            </CardTitle>
            <CardAction>
              <div className="flex items-center gap-2">
                <StatusBadge status={currentStatus} label={t(`machine.status.${currentStatus}`)} />
                <Badge variant="outline">{machine._count.workOrders} WO</Badge>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("machine.code")}</Label>
                <Input {...register("code")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("machine.name")}</Label>
                <Input {...register("name")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("machine.type")}</Label>
                <Select value={currentType} onValueChange={(v) => setValue("type", v ?? machine.type)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MACHINE_TYPES.map((mt) => (
                      <SelectItem key={mt} value={mt}>{machineTypeLabel[mt]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.status")}</Label>
                <Select value={currentStatus} onValueChange={(v) => { if (v) { setValue("status", v); } }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MACHINE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(`machine.status.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("machine.description")}</Label>
                <Textarea {...register("description")} rows={2} />
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {t("common.save")}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Upcoming Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            {t("machine.upcoming")}
          </CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? (
                <><X className="h-3.5 w-3.5 mr-1" />{t("common.cancel")}</>
              ) : (
                <><Plus className="h-3.5 w-3.5 mr-1" />{t("machine.newMaintenance")}</>
              )}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Form */}
          {showAddForm && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 bg-gray-50/50 dark:bg-gray-800/50">
              <form onSubmit={handleSubmitMaint(onSubmitMaintenance)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("machine.type")}</Label>
                    <Select defaultValue="PREVENTIVE" onValueChange={(v) => setValueMaint("type", v ?? "PREVENTIVE")}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_TYPES.map((mt) => (
                          <SelectItem key={mt} value={mt}>{t(`machine.maintenanceType.${mt}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("machine.scheduledDate")} *</Label>
                    <Input {...registerMaint("scheduledDate", { required: true })} type="date" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>{t("machine.description")} *</Label>
                    <Input {...registerMaint("description", { required: true })} placeholder="เปลี่ยนน้ำมันหล่อ, ตรวจสอบ spindle..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("machine.performedBy")}</Label>
                    <Input {...registerMaint("performedBy")} placeholder="ช่างซ่อม / ชื่อบริษัท" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("machine.cost")}</Label>
                    <Input {...registerMaint("cost")} type="number" step="0.01" placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>{t("common.notes")}</Label>
                    <Input {...registerMaint("notes")} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={maintenanceLoading}>
                    {maintenanceLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    {t("common.save")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setShowAddForm(false); resetMaint(); }}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Upcoming Table */}
          {upcoming.length > 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("machine.scheduledDate")}</TableHead>
                    <TableHead>{t("machine.type")}</TableHead>
                    <TableHead>{t("machine.description")}</TableHead>
                    <TableHead>{t("machine.performedBy")}</TableHead>
                    <TableHead>{t("machine.cost")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.map((log) => {
                    const overdue = isOverdue(log);
                    const days = daysUntil(log.scheduledDate);
                    return (
                      <TableRow key={log.id} className={overdue ? "bg-red-50/50 dark:bg-red-900/10" : ""}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className={overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                              {formatDate(log.scheduledDate)}
                            </span>
                            {overdue && (
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {t("machine.overdue")} {Math.abs(days)} {t("product.days")}
                              </span>
                            )}
                            {!overdue && days <= 7 && days >= 0 && (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                {days === 0 ? "วันนี้" : `อีก ${days} วัน`}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={log.type} label={t(`machine.maintenanceType.${log.type}`)} />
                        </TableCell>
                        <TableCell className="max-w-[200px]">{log.description}</TableCell>
                        <TableCell>{log.performedBy || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{formatCost(log.cost)}</TableCell>
                        <TableCell>
                          <StatusBadge
                            status={overdue && log.status === "SCHEDULED" ? "OVERDUE" : log.status}
                            label={t(`machine.maintenanceStatus.${overdue && log.status === "SCHEDULED" ? "OVERDUE" : log.status}`)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {log.status === "SCHEDULED" && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                title={t("machine.markInProgress")}
                                onClick={() => handleStatusChange(log.id, "IN_PROGRESS")}
                              >
                                <Play className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                            )}
                            {(log.status === "SCHEDULED" || log.status === "IN_PROGRESS") && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                title={t("machine.markDone")}
                                onClick={() => handleStatusChange(log.id, "COMPLETED")}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleDeleteLog(log.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">{t("machine.noUpcoming")}</p>
          )}
        </CardContent>
      </Card>

      {/* Maintenance History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t("machine.history")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("machine.scheduledDate")}</TableHead>
                    <TableHead>{t("machine.type")}</TableHead>
                    <TableHead>{t("machine.description")}</TableHead>
                    <TableHead>{t("machine.performedBy")}</TableHead>
                    <TableHead>{t("machine.cost")}</TableHead>
                    <TableHead>{t("machine.startDate")}</TableHead>
                    <TableHead>{t("machine.endDate")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.scheduledDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={log.type} label={t(`machine.maintenanceType.${log.type}`)} />
                      </TableCell>
                      <TableCell className="max-w-[200px]">{log.description}</TableCell>
                      <TableCell>{log.performedBy || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCost(log.cost)}</TableCell>
                      <TableCell>{formatDate(log.startDate)}</TableCell>
                      <TableCell>{formatDate(log.endDate)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleDeleteLog(log.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">{t("machine.noHistory")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
