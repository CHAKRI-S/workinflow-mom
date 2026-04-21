"use client";

import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { ArrowLeft, Loader2, Save, Upload, AlertCircle } from "lucide-react";
import { maybeCompressImage } from "@/lib/image-compress";

type BillingNature = "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  paidAmount: string;
  billingNature: BillingNature;
  snapshotCustomerName: string | null;
  snapshotCustomerAddress: string | null;
  snapshotCustomerTaxId: string | null;
  customer: {
    id: string;
    code: string;
    name: string;
    billingAddress: string | null;
    taxId: string | null;
    withholdsTax: boolean;
  };
}

interface Props {
  invoices: InvoiceOption[];
  preselectedInvoiceId: string | null;
  storageEnabled: boolean;
}

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

export function ReceiptFormClient({
  invoices,
  preselectedInvoiceId,
  storageEnabled,
}: Props) {
  const router = useRouter();

  // Initial defaults derived from preselected invoice (if any)
  const initial = useMemo(() => {
    const inv = preselectedInvoiceId
      ? invoices.find((i) => i.id === preselectedInvoiceId)
      : null;
    if (!inv) {
      return {
        invoiceId: "",
        gross: "",
        payerName: "",
        payerTaxId: "",
        payerAddress: "",
        applyWht: false,
      };
    }
    const outstanding = Math.max(
      0,
      Number(inv.totalAmount) - Number(inv.paidAmount)
    );
    return {
      invoiceId: inv.id,
      gross: outstanding.toFixed(2),
      payerName: inv.snapshotCustomerName ?? inv.customer.name ?? "",
      payerTaxId: inv.snapshotCustomerTaxId ?? inv.customer.taxId ?? "",
      payerAddress:
        inv.snapshotCustomerAddress ?? inv.customer.billingAddress ?? "",
      applyWht:
        inv.customer.withholdsTax &&
        (inv.billingNature === "MANUFACTURING_SERVICE" ||
          inv.billingNature === "MIXED"),
    };
  }, [invoices, preselectedInvoiceId]);

  const [invoiceId, setInvoiceId] = useState<string>(initial.invoiceId);
  const selected = useMemo(
    () => invoices.find((i) => i.id === invoiceId) ?? null,
    [invoices, invoiceId]
  );

  const [grossAmount, setGrossAmount] = useState<string>(initial.gross);
  const [payerName, setPayerName] = useState(initial.payerName);
  const [payerTaxId, setPayerTaxId] = useState(initial.payerTaxId);
  const [payerAddress, setPayerAddress] = useState(initial.payerAddress);
  const [notes, setNotes] = useState("");

  // WHT controls
  const [applyWht, setApplyWht] = useState(initial.applyWht);
  const [whtRate, setWhtRate] = useState<string>("3");
  const [whtCertNumber, setWhtCertNumber] = useState("");
  const [whtCertReceivedAt, setWhtCertReceivedAt] = useState<string>("");

  // File upload
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Auto-fill payer fields when user picks an invoice (event handler, not effect)
  function onPickInvoice(newId: string) {
    setInvoiceId(newId);
    const inv = invoices.find((i) => i.id === newId);
    if (!inv) return;
    setPayerName(inv.snapshotCustomerName ?? inv.customer.name ?? "");
    setPayerTaxId(inv.snapshotCustomerTaxId ?? inv.customer.taxId ?? "");
    setPayerAddress(
      inv.snapshotCustomerAddress ?? inv.customer.billingAddress ?? ""
    );
    const outstanding = Math.max(
      0,
      Number(inv.totalAmount) - Number(inv.paidAmount)
    );
    setGrossAmount(outstanding.toFixed(2));
    setApplyWht(
      inv.customer.withholdsTax &&
        (inv.billingNature === "MANUFACTURING_SERVICE" ||
          inv.billingNature === "MIXED")
    );
  }

  const gross = Number(grossAmount) || 0;
  const rate = applyWht ? Number(whtRate) || 0 : 0;
  const whtAmount = Math.round(((gross * rate) / 100) * 100) / 100;
  const netAmount = Math.round((gross - whtAmount) * 100) / 100;

  function formatCurrency(n: number) {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) {
      setUploadError("ไฟล์ต้องเป็น PDF / JPG / PNG เท่านั้น");
      return;
    }
    if (f.size > MAX_BYTES) {
      setUploadError("ไฟล์ใหญ่เกิน 5 MB");
      return;
    }
    const compressed = await maybeCompressImage(f);
    setCertFile(compressed);
    setUploadedKey(null);
  }

  async function uploadNow(receiptIdHint: string | null) {
    if (!certFile) return null;
    if (!storageEnabled) {
      setUploadError("ระบบเก็บไฟล์ยังไม่ได้ตั้งค่า (S3/R2)");
      return null;
    }

    // We upload AFTER we have a receipt id (to include it in object key).
    // But we also support uploading up-front if user wants — use "pending-<timestamp>" as hint
    const res = await fetch("/api/finance/wht/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId: receiptIdHint ?? "pending",
        filename: certFile.name,
        contentType: certFile.type,
        sizeBytes: certFile.size,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setUploadError(j?.error ?? "Upload URL failed");
      return null;
    }
    const { uploadUrl, key } = (await res.json()) as {
      uploadUrl: string;
      key: string;
    };

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": certFile.type },
      body: certFile,
    });
    if (!putRes.ok) {
      setUploadError(`Upload failed (${putRes.status})`);
      return null;
    }
    setUploadedKey(key);
    return key;
  }

  async function onSubmit() {
    setFormError(null);
    if (!selected) {
      setFormError("กรุณาเลือก invoice");
      return;
    }
    if (gross <= 0) {
      setFormError("จำนวนเงินต้องมากกว่า 0");
      return;
    }
    if (!payerName.trim()) {
      setFormError("กรุณากรอกชื่อผู้จ่าย");
      return;
    }
    if (applyWht) {
      if (rate <= 0) {
        setFormError("WHT rate ต้องมากกว่า 0");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Step 1: upload cert file first (if provided) — uses pending key
      let uploadedCertKey: string | null = uploadedKey;
      if (certFile && !uploadedKey) {
        setUploading(true);
        uploadedCertKey = await uploadNow(null);
        setUploading(false);
        if (!uploadedCertKey && certFile) {
          setSubmitting(false);
          return; // upload error already set
        }
      }

      // Step 2: create receipt
      const payload: Record<string, unknown> = {
        invoiceId: selected.id,
        grossAmount: gross,
        payerName: payerName.trim(),
        payerTaxId: payerTaxId.trim() || null,
        payerAddress: payerAddress.trim() || null,
        notes: notes.trim() || undefined,
      };
      if (applyWht) {
        payload.whtRateOverride = rate;
        if (whtCertNumber.trim())
          payload.whtCertNumber = whtCertNumber.trim();
        if (uploadedCertKey) payload.whtCertFileUrl = uploadedCertKey;
        if (whtCertReceivedAt)
          payload.whtCertReceivedAt = whtCertReceivedAt;
      } else {
        // Force rate=0 if user disabled even though customer has withholdsTax
        payload.whtRateOverride = 0;
      }

      const res = await fetch("/api/finance/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFormError(j?.error ?? "สร้าง receipt ไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      const created = (await res.json()) as { id: string };
      router.push(`/finance/receipts/${created.id}`);
    } catch (e) {
      console.error(e);
      setFormError("เกิดข้อผิดพลาด");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/finance/receipts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            กลับ
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">สร้างใบเสร็จรับเงิน</h1>
      </div>

      {/* Invoice selection */}
      <Card className="p-5 space-y-4">
        <div>
          <Label className="mb-2 block">เลือก Invoice</Label>
          <Select
            value={invoiceId}
            onValueChange={(v) => onPickInvoice(String(v ?? ""))}
          >
            <SelectTrigger>
              <SelectValue placeholder="เลือก invoice..." />
            </SelectTrigger>
            <SelectContent>
              {invoices.map((inv) => {
                const outstanding =
                  Number(inv.totalAmount) - Number(inv.paidAmount);
                return (
                  <SelectItem key={inv.id} value={inv.id}>
                    <span className="font-mono mr-2">{inv.invoiceNumber}</span>
                    <span className="text-muted-foreground">
                      {inv.customer.name} ·{" "}
                      {formatCurrency(outstanding)} คงเหลือ
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selected && (
          <div className="text-sm grid grid-cols-2 gap-3 bg-muted/30 rounded-md p-3">
            <div>
              <span className="text-muted-foreground">ยอดรวม invoice:</span>{" "}
              <span className="font-mono">
                {formatCurrency(Number(selected.totalAmount))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">ชำระแล้ว:</span>{" "}
              <span className="font-mono">
                {formatCurrency(Number(selected.paidAmount))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Billing:</span>{" "}
              <span className="font-medium">
                {selected.billingNature === "GOODS"
                  ? "ขายสินค้า"
                  : selected.billingNature === "MANUFACTURING_SERVICE"
                    ? "รับจ้างทำของ"
                    : "ผสม"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">ลูกค้าหัก WHT:</span>{" "}
              <span className="font-medium">
                {selected.customer.withholdsTax ? "ใช่" : "ไม่"}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Payer info */}
      <Card className="p-5 space-y-4">
        <div className="font-medium">ข้อมูลผู้จ่าย</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block">ชื่อผู้จ่าย *</Label>
            <Input
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">เลขประจำตัวผู้เสียภาษี</Label>
            <Input
              value={payerTaxId}
              onChange={(e) => setPayerTaxId(e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label className="mb-1.5 block">ที่อยู่</Label>
            <Textarea
              rows={2}
              value={payerAddress}
              onChange={(e) => setPayerAddress(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Amount + WHT */}
      <Card className="p-5 space-y-4">
        <div className="font-medium">ยอดเงิน + ภาษีหัก ณ ที่จ่าย</div>
        <div>
          <Label className="mb-1.5 block">จำนวนเงิน (ก่อนหัก WHT) *</Label>
          <Input
            type="number"
            step="0.01"
            value={grossAmount}
            onChange={(e) => setGrossAmount(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            id="apply-wht"
            type="checkbox"
            checked={applyWht}
            onChange={(e) => setApplyWht(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="apply-wht" className="text-sm cursor-pointer">
            ลูกค้าหักภาษี ณ ที่จ่าย
          </label>
          {selected &&
            selected.customer.withholdsTax &&
            (selected.billingNature === "MANUFACTURING_SERVICE" ||
              selected.billingNature === "MIXED") && (
              <span className="text-xs text-blue-600 ml-2">
                (แนะนำ: ลูกค้ารายนี้ตั้งค่าหัก WHT)
              </span>
            )}
        </div>

        {applyWht && (
          <div className="space-y-4 pt-2 border-l-2 border-blue-200 pl-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="mb-1.5 block">อัตรา WHT (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={whtRate}
                  onChange={(e) => setWhtRate(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">เลขหนังสือ 50 ทวิ (ถ้ารับแล้ว)</Label>
                <Input
                  value={whtCertNumber}
                  onChange={(e) => setWhtCertNumber(e.target.value)}
                  placeholder="ตามหลังได้"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">วันรับ cert</Label>
                <Input
                  type="date"
                  value={whtCertReceivedAt}
                  onChange={(e) => setWhtCertReceivedAt(e.target.value)}
                />
              </div>
            </div>

            {/* File upload */}
            <div>
              <Label className="mb-1.5 block">
                แนบไฟล์ scan cert (PDF/JPG/PNG, ≤5MB)
              </Label>
              {!storageEnabled && (
                <div className="text-xs text-amber-600 flex items-center gap-1 mb-2">
                  <AlertCircle className="h-3 w-3" />
                  ระบบเก็บไฟล์ (R2) ยังไม่ได้ตั้งค่า — กรอก cert เลขได้ แต่แนบไฟล์ไม่ได้
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,application/pdf"
                  onChange={onPickFile}
                  disabled={!storageEnabled}
                  className="text-sm"
                />
                {certFile && (
                  <span className="text-xs text-muted-foreground">
                    {certFile.name} ·{" "}
                    {(certFile.size / 1024).toFixed(0)} KB
                  </span>
                )}
              </div>
              {uploadError && (
                <div className="text-xs text-red-600 mt-1">{uploadError}</div>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* Summary */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">จำนวนเงิน (Gross):</span>
            <span className="font-mono">{formatCurrency(gross)}</span>
          </div>
          {applyWht && (
            <div className="flex justify-between text-red-600">
              <span>หัก ณ ที่จ่าย {rate}%:</span>
              <span className="font-mono">- {formatCurrency(whtAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold text-base pt-1">
            <span>ยอดรับจริง (Net):</span>
            <span className="font-mono">{formatCurrency(netAmount)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <Label className="mb-1.5 block">หมายเหตุ</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>

      {formError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {formError}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link href="/finance/receipts">
          <Button variant="outline">ยกเลิก</Button>
        </Link>
        <Button onClick={onSubmit} disabled={submitting || !selected}>
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : uploading ? (
            <Upload className="h-4 w-4 mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {uploading ? "กำลังอัพโหลด..." : "บันทึก"}
        </Button>
      </div>
    </div>
  );
}
