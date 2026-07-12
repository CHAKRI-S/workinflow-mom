"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
} from "lucide-react";
import { StatusBadge } from "@/components/superadmin/status-badge";

// ── Types (mirror /api/sa/subscriptions/[id]) ──────────────────────────
interface Detail {
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    periodStart: string;
    periodEnd: string;
    amountSatang: number;
    discountSatang: number;
    vatSatang: number;
    totalSatang: number;
    paymentGateway: string | null;
    slipUrl: string | null;
    slipSubmittedAt: string | null;
    slipVerifiedAt: string | null;
    confirmedAt: string | null;
    manualNote: string | null;
    gatewayRef: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    createdAt: string;
    tenant: {
      id: string;
      name: string;
      code: string;
      slug: string | null;
      status: string;
      email: string | null;
      taxId: string | null;
      address: string | null;
    };
    plan: { id: string; name: string; tier: string };
    invoices: {
      id: string;
      invoiceNumber: string;
      issueDate: string;
      paidAt: string | null;
      totalSatang: number;
    }[];
  };
  slipDownloadUrl: string | null;
  confirmedByName: string | null;
}

function baht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SubscriptionDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<"confirm" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sa/subscriptions/${id}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "confirm" | "reject") {
    setActing(action);
    setActionMsg("");
    try {
      const res = await fetch(`/api/sa/subscriptions/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMsg(d.error || "ดำเนินการไม่สำเร็จ");
        return;
      }
      setActionMsg(
        action === "confirm" ? "✅ ยืนยันการชำระเงินแล้ว" : "ปฏิเสธรายการแล้ว"
      );
      setNote("");
      await load();
    } catch {
      setActionMsg("Network error");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 mx-auto animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {error || "ไม่พบข้อมูล"}
      </div>
    );
  }

  const s = data.subscription;
  const isImage = s.slipUrl ? /\.(jpg|jpeg|png)$/i.test(s.slipUrl) : false;
  const canAct = s.status === "PENDING";
  const awaitingReview = canAct && Boolean(s.slipSubmittedAt);

  return (
    <>
      <Link
        href="/subscriptions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> กลับไปรายการ subscription
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{s.plan.name}</h1>
        <StatusBadge status={s.status} />
        {s.paymentGateway && (
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {s.paymentGateway}
          </span>
        )}
        {awaitingReview && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
            รอยืนยันการโอน
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="ข้อมูลลูกค้า (Tenant)">
            <Row label="บริษัท">
              <Link href={`/tenants/${s.tenant.id}`} className="text-primary hover:underline">
                {s.tenant.name}
              </Link>
            </Row>
            <Row label="รหัส">{s.tenant.code}</Row>
            <Row label="อีเมล">{s.tenant.email || "—"}</Row>
            <Row label="เลขผู้เสียภาษี">{s.tenant.taxId || "—"}</Row>
          </Card>

          <Card title="รายละเอียดการชำระเงิน">
            <Row label="รอบบิล">{s.billingCycle === "YEARLY" ? "รายปี" : "รายเดือน"}</Row>
            <Row label="ยอดก่อน VAT">{baht(s.amountSatang)}</Row>
            {s.discountSatang > 0 && <Row label="ส่วนลด">-{baht(s.discountSatang)}</Row>}
            <Row label="VAT 7%">{baht(s.vatSatang)}</Row>
            <Row label="ยอดรวม">
              <span className="font-semibold">{baht(s.totalSatang)}</span>
            </Row>
            <Row label="อัปสลิปเมื่อ">{fmt(s.slipSubmittedAt)}</Row>
            <Row label="ยืนยันเมื่อ">{fmt(s.confirmedAt)}</Row>
            {data.confirmedByName && <Row label="ยืนยันโดย">{data.confirmedByName}</Row>}
            {s.manualNote && <Row label="หมายเหตุ">{s.manualNote}</Row>}
            {s.cancelReason && <Row label="เหตุผลยกเลิก">{s.cancelReason}</Row>}
          </Card>

          {s.invoices.length > 0 && (
            <Card title="ใบกำกับภาษี / ใบเสร็จ">
              <div className="space-y-2">
                {s.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-muted-foreground">
                      {baht(inv.totalSatang)} · {inv.paidAt ? "ชำระแล้ว" : "ยังไม่ชำระ"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: slip + actions */}
        <div className="space-y-6">
          <Card title="หลักฐานการโอน">
            {s.slipUrl ? (
              data.slipDownloadUrl ? (
                isImage ? (
                  <a href={data.slipDownloadUrl} target="_blank" rel="noreferrer">
                    <Image
                      src={data.slipDownloadUrl}
                      alt="สลิปการโอน"
                      width={480}
                      height={640}
                      unoptimized
                      className="w-full rounded-lg border object-contain"
                    />
                  </a>
                ) : (
                  <a
                    href={data.slipDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <ExternalLink className="h-4 w-4" /> เปิดสลิป (PDF)
                  </a>
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  มีสลิปแต่สร้างลิงก์ดูไม่ได้ (R2 ไม่ได้ตั้งค่า)
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">ยังไม่มีสลิปที่อัปโหลด</p>
            )}
          </Card>

          {canAct && (
            <Card title="ดำเนินการ">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุ (ไม่บังคับ)"
                rows={2}
                className="mb-3 w-full rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => act("confirm")}
                  disabled={acting !== null}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {acting === "confirm" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  ยืนยันการชำระ
                </button>
                <button
                  type="button"
                  onClick={() => act("reject")}
                  disabled={acting !== null}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {acting === "reject" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  ปฏิเสธ
                </button>
              </div>
              {actionMsg && <p className="mt-3 text-sm">{actionMsg}</p>}
            </Card>
          )}
          {!canAct && actionMsg && <p className="text-sm text-green-600">{actionMsg}</p>}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
