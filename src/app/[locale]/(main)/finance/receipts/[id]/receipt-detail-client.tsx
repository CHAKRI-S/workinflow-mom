"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  XCircle,
  CheckCircle,
  Upload,
  Download,
  FileText,
  AlertCircle,
} from "lucide-react";
import { maybeCompressImage } from "@/lib/image-compress";

type WhtCertStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "RECEIVED"
  | "VERIFIED"
  | "MISSING_OVERDUE";

interface ReceiptDetail {
  id: string;
  receiptNumber: string;
  status: string;
  issueDate: string;
  amount: string;
  grossAmount: string | null;
  billingNature: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
  whtRate: string;
  whtAmount: string;
  whtCertNumber: string | null;
  whtCertReceivedAt: string | null;
  whtCertFileUrl: string | null;
  whtCertStatus: WhtCertStatus;
  payerName: string;
  payerTaxId: string | null;
  payerAddress: string | null;
  notes: string | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: string;
    customer: {
      id: string;
      code: string;
      name: string;
    };
  };
  createdBy: { id: string; name: string };
  createdAt?: string;
}

const NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ["ISSUED"],
  ISSUED: ["CANCELLED"],
};

const CERT_STATUS_LABEL: Record<WhtCertStatus, string> = {
  NOT_APPLICABLE: "ไม่เข้าข่าย",
  PENDING: "รอรับ cert",
  RECEIVED: "รับ cert แล้ว",
  VERIFIED: "ตรวจสอบแล้ว",
  MISSING_OVERDUE: "เกินกำหนด",
};

const CERT_STATUS_VARIANT: Record<WhtCertStatus, string> = {
  NOT_APPLICABLE: "DRAFT",
  PENDING: "PENDING",
  RECEIVED: "ISSUED",
  VERIFIED: "PAID",
  MISSING_OVERDUE: "CANCELLED",
};

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

export function ReceiptDetailClient({
  receipt,
  storageEnabled,
}: {
  receipt: ReceiptDetail;
  storageEnabled: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // WHT cert local editing state
  const [certNumber, setCertNumber] = useState(receipt.whtCertNumber ?? "");
  const [certReceivedAt, setCertReceivedAt] = useState<string>(
    receipt.whtCertReceivedAt
      ? new Date(receipt.whtCertReceivedAt).toISOString().slice(0, 10)
      : ""
  );
  const [certStatus, setCertStatus] = useState<WhtCertStatus>(
    receipt.whtCertStatus
  );
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [savingCert, setSavingCert] = useState(false);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: string) =>
    Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "CANCELLED" && !confirm(t("common.confirm") + "?"))
      return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (newStatus === "CANCELLED") {
        const reason = prompt("เหตุผลที่ยกเลิก:");
        if (!reason) {
          setLoading(false);
          return;
        }
        body.cancelReason = reason;
      }
      const res = await fetch(`/api/finance/receipts/${receipt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to change status");
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to change status");
    } finally {
      setLoading(false);
    }
  };

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setCertError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) {
      setCertError("ไฟล์ต้องเป็น PDF / JPG / PNG");
      return;
    }
    if (f.size > MAX_BYTES) {
      setCertError("ไฟล์ใหญ่เกิน 5 MB");
      return;
    }
    const compressed = await maybeCompressImage(f);
    setCertFile(compressed);
  }

  async function downloadCert() {
    const res = await fetch(
      `/api/finance/wht/download-url?receiptId=${receipt.id}`
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? "Download failed");
      return;
    }
    const { downloadUrl } = (await res.json()) as { downloadUrl: string };
    window.open(downloadUrl, "_blank");
  }

  async function saveCert() {
    setCertError(null);
    setSavingCert(true);
    try {
      let uploadedKey: string | null = null;

      // 1) Upload new file if picked
      if (certFile) {
        if (!storageEnabled) {
          setCertError("ระบบเก็บไฟล์ (R2) ยังไม่ได้ตั้งค่า");
          setSavingCert(false);
          return;
        }
        setUploading(true);
        const urlRes = await fetch("/api/finance/wht/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptId: receipt.id,
            filename: certFile.name,
            contentType: certFile.type,
            sizeBytes: certFile.size,
          }),
        });
        if (!urlRes.ok) {
          const j = await urlRes.json().catch(() => ({}));
          setCertError(j?.error ?? "ขอ upload URL ไม่สำเร็จ");
          setUploading(false);
          setSavingCert(false);
          return;
        }
        const { uploadUrl, key } = (await urlRes.json()) as {
          uploadUrl: string;
          key: string;
        };
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": certFile.type },
          body: certFile,
        });
        if (!putRes.ok) {
          setCertError(`Upload failed (${putRes.status})`);
          setUploading(false);
          setSavingCert(false);
          return;
        }
        uploadedKey = key;
        setUploading(false);
      }

      // 2) PATCH receipt with cert fields
      const patchBody: Record<string, unknown> = {};
      if (certNumber.trim() !== (receipt.whtCertNumber ?? "")) {
        patchBody.whtCertNumber = certNumber.trim() || null;
      }
      if (uploadedKey) patchBody.whtCertFileUrl = uploadedKey;
      const existingDate = receipt.whtCertReceivedAt
        ? new Date(receipt.whtCertReceivedAt).toISOString().slice(0, 10)
        : "";
      if (certReceivedAt !== existingDate) {
        patchBody.whtCertReceivedAt = certReceivedAt || null;
      }
      if (certStatus !== receipt.whtCertStatus) {
        patchBody.whtCertStatus = certStatus;
      }

      if (Object.keys(patchBody).length === 0) {
        setCertError("ไม่มีการเปลี่ยนแปลง");
        setSavingCert(false);
        return;
      }

      const res = await fetch(`/api/finance/receipts/${receipt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setCertError(j?.error ?? "บันทึกไม่สำเร็จ");
        setSavingCert(false);
        return;
      }
      setCertFile(null);
      router.refresh();
    } catch (e) {
      console.error(e);
      setCertError("เกิดข้อผิดพลาด");
    } finally {
      setSavingCert(false);
    }
  }

  const isTerminal = receipt.status === "CANCELLED";
  const nextStatuses = NEXT_STATUSES[receipt.status] || [];
  const hasWht = Number(receipt.whtAmount) > 0;

  // Allowed cert status options based on current status
  const certStatusOptions: WhtCertStatus[] =
    receipt.whtCertStatus === "NOT_APPLICABLE"
      ? ["NOT_APPLICABLE"]
      : ["PENDING", "RECEIVED", "VERIFIED", "MISSING_OVERDUE"];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance/receipts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight font-mono">
              {receipt.receiptNumber}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={receipt.status}
                label={t(`receipt.status.${receipt.status}`)}
              />
              {hasWht && (
                <StatusBadge
                  status={CERT_STATUS_VARIANT[receipt.whtCertStatus]}
                  label={`WHT: ${CERT_STATUS_LABEL[receipt.whtCertStatus]}`}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/finance/receipts/${receipt.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              ดาวน์โหลด PDF
            </Button>
          </a>
          {!isTerminal &&
            nextStatuses.map((s) => (
              <Button
                key={s}
                variant={s === "CANCELLED" ? "destructive" : "default"}
                size="sm"
                onClick={() => handleStatusChange(s)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : s === "CANCELLED" ? (
                  <XCircle className="h-4 w-4 mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                {t(`receipt.status.${s}`)}
              </Button>
            ))}
        </div>
      </div>

      {/* Receipt Info + Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("receipt.title")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">{t("receipt.number")}</span>
            <span className="font-mono">{receipt.receiptNumber}</span>

            <span className="text-muted-foreground">
              {t("receipt.invoice")}
            </span>
            <Link
              href={`/finance/invoices/${receipt.invoice.id}`}
              className="font-mono text-sm hover:underline"
            >
              {receipt.invoice.invoiceNumber}
            </Link>

            <span className="text-muted-foreground">
              {t("invoice.customer")}
            </span>
            <Link
              href={`/sales/customers/${receipt.invoice.customer.id}`}
              className="font-medium hover:underline"
            >
              {receipt.invoice.customer.code} - {receipt.invoice.customer.name}
            </Link>

            <span className="text-muted-foreground">
              {t("receipt.issueDate")}
            </span>
            <span>{formatDate(receipt.issueDate)}</span>

            <span className="text-muted-foreground">Billing</span>
            <span>
              {receipt.billingNature === "GOODS"
                ? "ขายสินค้า"
                : receipt.billingNature === "MANUFACTURING_SERVICE"
                  ? "รับจ้างทำของ"
                  : "ผสม"}
            </span>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("receipt.payerName")}</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t("receipt.payerName")}
            </span>
            <span>{receipt.payerName}</span>

            {receipt.payerTaxId && (
              <>
                <span className="text-muted-foreground">Tax ID</span>
                <span className="font-mono">{receipt.payerTaxId}</span>
              </>
            )}

            {receipt.payerAddress && (
              <>
                <span className="text-muted-foreground">Address</span>
                <span className="text-sm">{receipt.payerAddress}</span>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            {receipt.grossAmount && hasWht && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>จำนวนเงิน (Gross)</span>
                  <span className="font-mono">
                    {formatCurrency(receipt.grossAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>หัก ณ ที่จ่าย ({receipt.whtRate}%)</span>
                  <span className="font-mono">
                    - {formatCurrency(receipt.whtAmount)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between font-semibold text-base">
              <span>รับจริง (Net)</span>
              <span className="font-mono">{formatCurrency(receipt.amount)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>ยอดรวม Invoice</span>
              <span className="font-mono">
                {formatCurrency(receipt.invoice.totalAmount)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* WHT Cert Section */}
      {hasWht && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)</h2>
            {receipt.whtCertFileUrl && (
              <Button variant="outline" size="sm" onClick={downloadCert}>
                <Download className="h-4 w-4 mr-1" />
                ดาวน์โหลด cert
              </Button>
            )}
          </div>

          {receipt.whtCertFileUrl && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              มีไฟล์แนบไว้ ({receipt.whtCertFileUrl.split("/").pop()})
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="mb-1.5 block">เลขที่ cert</Label>
              <Input
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                disabled={isTerminal}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">วันรับ cert</Label>
              <Input
                type="date"
                value={certReceivedAt}
                onChange={(e) => setCertReceivedAt(e.target.value)}
                disabled={isTerminal}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">สถานะ</Label>
              <Select
                value={certStatus}
                onValueChange={(v) => setCertStatus(v as WhtCertStatus)}
                disabled={isTerminal}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {certStatusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CERT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">
              {receipt.whtCertFileUrl ? "แทนที่ไฟล์" : "แนบไฟล์"} (PDF/JPG/PNG, ≤5MB)
            </Label>
            {!storageEnabled && (
              <div className="text-xs text-amber-600 flex items-center gap-1 mb-2">
                <AlertCircle className="h-3 w-3" />
                R2 ยังไม่ตั้งค่า — แนบไฟล์ไม่ได้
              </div>
            )}
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,application/pdf"
                onChange={onPickFile}
                disabled={isTerminal || !storageEnabled}
                className="text-sm"
              />
              {certFile && (
                <span className="text-xs text-muted-foreground">
                  {certFile.name} · {(certFile.size / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
          </div>

          {certError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {certError}
            </div>
          )}

          {!isTerminal && (
            <div className="flex justify-end">
              <Button onClick={saveCert} disabled={savingCert || uploading}>
                {uploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-1" /> กำลังอัพโหลด...
                  </>
                ) : savingCert ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> กำลังบันทึก...
                  </>
                ) : (
                  "บันทึก cert"
                )}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Notes */}
      {receipt.notes && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">{t("common.notes")}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {receipt.notes}
          </p>
        </Card>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        {t("common.create")}: {receipt.createdBy.name} |{" "}
        {formatDate(receipt.issueDate)}
      </div>
    </div>
  );
}
