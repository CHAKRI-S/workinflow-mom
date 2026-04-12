"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Paintbrush,
  ScanLine,
  ShieldCheck,
  RotateCcw,
  Unlock,
} from "lucide-react";

interface WorkOrderLog {
  id: string;
  fromStatus: string;
  toStatus: string;
  qtyReported: string | number | null;
  scrapQty: string | number | null;
  note: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

interface WorkOrderDetail {
  id: string;
  woNumber: string;
  status: string;
  priority: string;
  plannedQty: string | number;
  completedQty: string | number;
  scrapQty: string | number;
  color: string | null;
  materialSize: string | null;
  fusionFileName: string | null;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  sentToPaintingDate: string | null;
  paintingExpectedDate: string | null;
  paintingReceivedDate: string | null;
  paintingVendor: string | null;
  assignedTo: string | null;
  workCenter: string | null;
  notes: string | null;
  product: {
    id: string;
    code: string;
    name: string;
    requiresPainting: boolean;
    requiresLogoEngraving: boolean;
  } | null;
  cncMachine: { id: string; code: string; name: string } | null;
  logs: WorkOrderLog[];
}

// Status actions config: which buttons to show for each status
const STATUS_ACTIONS: Record<
  string,
  { targetStatus: string; labelKey: string; icon: React.ElementType; variant?: "default" | "outline" | "destructive" | "ghost" | "secondary" }[]
> = {
  PENDING: [
    { targetStatus: "RELEASED", labelKey: "release", icon: Unlock, variant: "default" },
    { targetStatus: "CANCELLED", labelKey: "cancel", icon: XCircle, variant: "destructive" },
  ],
  RELEASED: [
    { targetStatus: "IN_PROGRESS", labelKey: "start", icon: Play, variant: "default" },
    { targetStatus: "ON_HOLD", labelKey: "hold", icon: PauseCircle, variant: "outline" },
    { targetStatus: "CANCELLED", labelKey: "cancel", icon: XCircle, variant: "destructive" },
  ],
  IN_PROGRESS: [
    { targetStatus: "QC_MACHINING", labelKey: "qcMachining", icon: ShieldCheck, variant: "outline" },
    { targetStatus: "SENT_TO_PAINTING", labelKey: "sendToPainting", icon: Paintbrush, variant: "outline" },
    { targetStatus: "ENGRAVING", labelKey: "startEngraving", icon: ScanLine, variant: "outline" },
    { targetStatus: "QC_FINAL", labelKey: "qcFinal", icon: ShieldCheck, variant: "outline" },
    { targetStatus: "COMPLETED", labelKey: "complete", icon: CheckCircle2, variant: "default" },
    { targetStatus: "ON_HOLD", labelKey: "hold", icon: PauseCircle, variant: "outline" },
    { targetStatus: "CANCELLED", labelKey: "cancel", icon: XCircle, variant: "destructive" },
  ],
  QC_MACHINING: [
    { targetStatus: "SENT_TO_PAINTING", labelKey: "sendToPainting", icon: Paintbrush, variant: "outline" },
    { targetStatus: "ENGRAVING", labelKey: "startEngraving", icon: ScanLine, variant: "outline" },
    { targetStatus: "QC_FINAL", labelKey: "qcFinal", icon: ShieldCheck, variant: "outline" },
    { targetStatus: "COMPLETED", labelKey: "complete", icon: CheckCircle2, variant: "default" },
    { targetStatus: "ON_HOLD", labelKey: "hold", icon: PauseCircle, variant: "outline" },
  ],
  SENT_TO_PAINTING: [
    { targetStatus: "PAINTING_DONE", labelKey: "paintingDone", icon: Paintbrush, variant: "default" },
    { targetStatus: "ON_HOLD", labelKey: "hold", icon: PauseCircle, variant: "outline" },
  ],
  PAINTING_DONE: [
    { targetStatus: "ENGRAVING", labelKey: "startEngraving", icon: ScanLine, variant: "outline" },
    { targetStatus: "QC_FINAL", labelKey: "qcFinal", icon: ShieldCheck, variant: "outline" },
    { targetStatus: "COMPLETED", labelKey: "complete", icon: CheckCircle2, variant: "default" },
  ],
  ENGRAVING: [
    { targetStatus: "QC_FINAL", labelKey: "qcFinal", icon: ShieldCheck, variant: "outline" },
    { targetStatus: "COMPLETED", labelKey: "complete", icon: CheckCircle2, variant: "default" },
    { targetStatus: "ON_HOLD", labelKey: "hold", icon: PauseCircle, variant: "outline" },
  ],
  QC_FINAL: [
    { targetStatus: "COMPLETED", labelKey: "complete", icon: CheckCircle2, variant: "default" },
    { targetStatus: "IN_PROGRESS", labelKey: "resume", icon: RotateCcw, variant: "outline" },
    { targetStatus: "ON_HOLD", labelKey: "hold", icon: PauseCircle, variant: "outline" },
  ],
  ON_HOLD: [
    { targetStatus: "RELEASED", labelKey: "release", icon: Unlock, variant: "default" },
    { targetStatus: "IN_PROGRESS", labelKey: "resume", icon: Play, variant: "default" },
    { targetStatus: "CANCELLED", labelKey: "cancel", icon: XCircle, variant: "destructive" },
  ],
};

interface WorkOrderDetailClientProps {
  workOrder: WorkOrderDetail;
}

export function WorkOrderDetailClient({
  workOrder: initialData,
}: WorkOrderDetailClientProps) {
  const t = useTranslations("workOrder");
  const tc = useTranslations("common");
  const router = useRouter();

  const [workOrder, setWorkOrder] = useState(initialData);
  const [isUpdating, setIsUpdating] = useState(false);

  const planned = Number(workOrder.plannedQty);
  const completed = Number(workOrder.completedQty);
  const scrap = Number(workOrder.scrapQty);
  const progressPct = planned > 0 ? Math.min((completed / planned) * 100, 100) : 0;

  const actions = STATUS_ACTIONS[workOrder.status] || [];

  async function handleStatusChange(targetStatus: string) {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/production/work-orders/${workOrder.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Failed to update status");
        return;
      }

      const updated = await res.json();
      setWorkOrder(updated);
    } catch {
      alert("Network error");
    } finally {
      setIsUpdating(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  }

  function formatDateTime(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/production/work-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-medium">{workOrder.woNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {workOrder.product?.name} ({workOrder.product?.code})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={workOrder.status}
            label={t(`status.${workOrder.status}` as any)}
          />
          <StatusBadge
            status={workOrder.priority}
            label={t(`priority_label.${workOrder.priority}` as any)}
          />
        </div>
      </div>

      {/* Action Buttons */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.targetStatus}
                variant={action.variant || "outline"}
                disabled={isUpdating}
                onClick={() => handleStatusChange(action.targetStatus)}
              >
                <Icon className="h-4 w-4" data-icon="inline-start" />
                {t(action.labelKey as any)}
              </Button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WO Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("woInfo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">{t("number")}</dt>
              <dd className="font-medium">{workOrder.woNumber}</dd>

              <dt className="text-muted-foreground">{t("product")}</dt>
              <dd className="font-medium">
                {workOrder.product?.name ?? "-"}
              </dd>

              <dt className="text-muted-foreground">{t("machine")}</dt>
              <dd>{workOrder.cncMachine?.name ?? "-"}</dd>

              <dt className="text-muted-foreground">{t("assignedTo")}</dt>
              <dd>{workOrder.assignedTo || "-"}</dd>

              <dt className="text-muted-foreground">{t("priority")}</dt>
              <dd>
                <StatusBadge
                  status={workOrder.priority}
                  label={t(`priority_label.${workOrder.priority}` as any)}
                />
              </dd>

              <dt className="text-muted-foreground">{t("color")}</dt>
              <dd>{workOrder.color || "-"}</dd>

              <dt className="text-muted-foreground">{t("materialSize")}</dt>
              <dd>{workOrder.materialSize || "-"}</dd>

              <dt className="text-muted-foreground">{t("plannedStart")}</dt>
              <dd>{formatDate(workOrder.plannedStart)}</dd>

              <dt className="text-muted-foreground">{t("plannedEnd")}</dt>
              <dd>{formatDate(workOrder.plannedEnd)}</dd>

              <dt className="text-muted-foreground">{t("actualStart")}</dt>
              <dd>{formatDateTime(workOrder.actualStart)}</dd>

              <dt className="text-muted-foreground">{t("actualEnd")}</dt>
              <dd>{formatDateTime(workOrder.actualEnd)}</dd>

              {workOrder.notes && (
                <>
                  <dt className="text-muted-foreground">{tc("notes")}</dt>
                  <dd className="col-span-1">{workOrder.notes}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Production Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("productionProgress")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">{t("plannedQty")}</dt>
              <dd className="font-medium tabular-nums">
                {planned.toLocaleString()}
              </dd>

              <dt className="text-muted-foreground">{t("completedQty")}</dt>
              <dd className="font-medium tabular-nums">
                {completed.toLocaleString()}
              </dd>

              <dt className="text-muted-foreground">{t("scrapQty")}</dt>
              <dd className="font-medium tabular-nums text-destructive">
                {scrap.toLocaleString()}
              </dd>
            </dl>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("progress")}</span>
                <span className="font-medium tabular-nums">
                  {progressPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Painting Info Card */}
        {workOrder.product?.requiresPainting && (
          <Card>
            <CardHeader>
              <CardTitle>{t("paintingInfo")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">
                  {t("painting.sentDate")}
                </dt>
                <dd>{formatDate(workOrder.sentToPaintingDate)}</dd>

                <dt className="text-muted-foreground">
                  {t("painting.expectedDate")}
                </dt>
                <dd>{formatDate(workOrder.paintingExpectedDate)}</dd>

                <dt className="text-muted-foreground">
                  {t("painting.receivedDate")}
                </dt>
                <dd>{formatDate(workOrder.paintingReceivedDate)}</dd>

                <dt className="text-muted-foreground">
                  {t("painting.vendor")}
                </dt>
                <dd>{workOrder.paintingVendor || "-"}</dd>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Status Log Card */}
        <Card className={workOrder.product?.requiresPainting ? "" : "lg:col-span-2"}>
          <CardHeader>
            <CardTitle>{t("statusLog")}</CardTitle>
          </CardHeader>
          <CardContent>
            {workOrder.logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noLogs")}</p>
            ) : (
              <div className="space-y-3">
                {workOrder.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={log.fromStatus}
                          label={t(`status.${log.fromStatus}` as any)}
                        />
                        <span className="text-muted-foreground">→</span>
                        <StatusBadge
                          status={log.toStatus}
                          label={t(`status.${log.toStatus}` as any)}
                        />
                      </div>
                      {log.qtyReported != null && (
                        <p className="text-muted-foreground">
                          {t("qtyReported")}: {Number(log.qtyReported).toLocaleString()}
                        </p>
                      )}
                      {log.scrapQty != null && Number(log.scrapQty) > 0 && (
                        <p className="text-muted-foreground">
                          {t("scrapQty")}: {Number(log.scrapQty).toLocaleString()}
                        </p>
                      )}
                      {log.note && (
                        <p className="text-muted-foreground">{log.note}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div>{log.createdBy?.name ?? "-"}</div>
                      <div>{formatDateTime(log.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
