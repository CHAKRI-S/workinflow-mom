"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  Building2,
  FileText,
  Globe,
  Save,
  Loader2,
  Users,
  Package,
  Boxes,
  Wrench,
  Database,
  Upload,
  Trash2,
  Image,
  Monitor,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  code: string;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  vatRate: string | number;
  defaultBillingNature?: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
  isActive: boolean;
}

interface DocSequence {
  id: string;
  prefix: string;
  year: number;
  lastSeq: number;
}

interface SystemCounts {
  users: number;
  customers: number;
  products: number;
  materials: number;
  machines: number;
  consumables: number;
}

interface CompanyFormData {
  name: string;
  code: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  vatRate: string;
  defaultBillingNature: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
}

/** Kept in sync with TENANT_CODE_MIN/MAX on the server. */
const TENANT_CODE_MIN = 2;
const TENANT_CODE_MAX = 8;

const DOC_LABELS: Record<string, { th: string; en: string }> = {
  QT: { th: "ใบเสนอราคา", en: "Quotation" },
  SO: { th: "ใบสั่งซื้อ", en: "Sales Order" },
  INV: { th: "ใบแจ้งหนี้ (VAT)", en: "Invoice (VAT)" },
  BIL: { th: "ใบเรียกเก็บเงิน", en: "Invoice (non-VAT)" },
  TI: { th: "ใบกำกับภาษี", en: "Tax Invoice" },
  RC: { th: "ใบเสร็จ (VAT)", en: "Receipt (VAT)" },
  RN: { th: "ใบเสร็จ (non-VAT)", en: "Receipt (non-VAT)" },
  CN: { th: "ใบลดหนี้ (VAT)", en: "Credit Note (VAT)" },
  CNB: { th: "ใบลดหนี้ (non-VAT)", en: "Credit Note (non-VAT)" },
  PAY: { th: "บันทึกชำระเงิน", en: "Payment" },
  PP: { th: "แผนการผลิต", en: "Production Plan" },
  WO: { th: "ใบสั่งผลิต", en: "Work Order" },
  PO: { th: "ใบสั่งซื้อวัสดุ", en: "Purchase Order" },
};

export function SettingsClient({
  tenant,
  sequences,
  systemCounts,
}: {
  tenant: Tenant | null;
  sequences: DocSequence[];
  systemCounts: SystemCounts;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant?.logo ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [copied, setCopied] = useState(false);

  const locale =
    typeof window !== "undefined"
      ? window.location.pathname.match(/^\/(th|en)/)?.[1] || "th"
      : "th";

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const factoryUrl = `${baseUrl}/${locale}/factory?token=workinflow-factory-2026`;

  const { register, handleSubmit, watch, setValue } = useForm<CompanyFormData>({
    defaultValues: {
      name: tenant?.name || "",
      code: tenant?.code || "",
      taxId: tenant?.taxId || "",
      phone: tenant?.phone || "",
      email: tenant?.email || "",
      address: tenant?.address || "",
      vatRate: String(tenant?.vatRate ?? 7),
      defaultBillingNature: tenant?.defaultBillingNature ?? "GOODS",
    },
  });

  // Watch code for live preview + auto-uppercase
  const codeValue = watch("code");
  const previewYear = new Date().getFullYear();
  const previewCode = (codeValue || "").trim();
  const previewInvoiceNumber = previewCode
    ? `${previewCode}-INV-${previewYear}-00001`
    : `INV-${previewYear}-00001`;
  const codeChanged = previewCode !== (tenant?.code || "");
  const codeValid =
    previewCode.length >= TENANT_CODE_MIN &&
    previewCode.length <= TENANT_CODE_MAX &&
    /^[A-Z0-9]+$/.test(previewCode);

  if (!tenant) {
    return <p className="text-muted-foreground">{t("common.noData")}</p>;
  }

  const onSubmit = async (data: CompanyFormData) => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError(null);
    try {
      // 1. Upload file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "logos");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }
      const { url } = await uploadRes.json();

      // 2. Save logo URL to tenant settings
      const patchRes = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: url }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json();
        throw new Error(err.error || "Failed to save logo");
      }

      setLogoUrl(url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setUploadingLogo(false);
      // Reset the input so the same file can be re-selected
      e.target.value = "";
    }
  };

  const handleLogoRemove = async () => {
    setUploadingLogo(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove logo");
      }
      setLogoUrl(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Group sequences by prefix, show latest year
  const currentYear = new Date().getFullYear();
  const seqByPrefix: Record<string, DocSequence> = {};
  for (const seq of sequences) {
    if (!seqByPrefix[seq.prefix] || seq.year >= seqByPrefix[seq.prefix].year) {
      seqByPrefix[seq.prefix] = seq;
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("settings.title")}
      </h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl p-3 text-sm">
          บันทึกสำเร็จ
        </div>
      )}

      {/* Company Info — EDITABLE */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t("settings.companyInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Upload Section */}
            <div className="space-y-2">
              <Label>{t("settings.logo")}</Label>
              <div className="flex items-start gap-4">
                {logoUrl ? (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-900">
                    <img
                      src={logoUrl}
                      alt="Company logo"
                      className="max-w-[200px] max-h-[100px] object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-6 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                    <Image className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={() =>
                      document.getElementById("logo-upload")?.click()
                    }
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    {t("settings.uploadLogo")}
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={uploadingLogo}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={handleLogoRemove}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t("settings.removeLogo")}
                    </Button>
                  )}
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.logoHint")}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("settings.companyName")} *</Label>
                <Input {...register("name", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t("settings.companyCode")}
                  {!codeValid && previewCode.length > 0 && (
                    <span className="text-destructive text-xs ms-2">
                      ต้องเป็น A-Z / 0-9, ยาว {TENANT_CODE_MIN}-{TENANT_CODE_MAX} ตัว
                    </span>
                  )}
                </Label>
                <Input
                  {...register("code", {
                    onChange: (e) => {
                      // Auto-uppercase + strip invalid chars so the preview
                      // below matches exactly what the server will accept.
                      const normalized = (e.target.value as string)
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, TENANT_CODE_MAX);
                      setValue("code", normalized, { shouldDirty: true });
                    },
                  })}
                  maxLength={TENANT_CODE_MAX}
                  placeholder="เช่น WF01, ACME"
                  className={
                    !codeValid && previewCode.length > 0
                      ? "border-destructive"
                      : ""
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  ใช้เป็นคำนำหน้าเลขเอกสารใหม่ — ตัวอย่าง:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {previewInvoiceNumber}
                  </span>
                </p>
                {codeChanged && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    ⚠️ เลขเอกสารที่ออกไปแล้วจะไม่เปลี่ยน — เฉพาะเอกสารใหม่เท่านั้นที่ใช้รหัสใหม่
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.taxId")}</Label>
                <Input {...register("taxId")} placeholder="0-0000-00000-00-0" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.vatRate")} (%)</Label>
                <Input
                  {...register("vatRate")}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.phone")}</Label>
                <Input {...register("phone")} placeholder="02-xxx-xxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.email")}</Label>
                <Input
                  {...register("email")}
                  type="email"
                  placeholder="info@company.com"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("settings.address")}</Label>
                <Textarea {...register("address")} rows={2} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>นโยบายภาษีเริ่มต้น</Label>
                <Select
                  value={watch("defaultBillingNature")}
                  onValueChange={(v) =>
                    setValue(
                      "defaultBillingNature",
                      v as CompanyFormData["defaultBillingNature"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOODS">
                      ขายสินค้า (OEM, ไม่หัก 3%)
                    </SelectItem>
                    <SelectItem value="MANUFACTURING_SERVICE">
                      รับจ้างผลิตตามแบบลูกค้า (หัก 3% ตาม ม.3 เตรส)
                    </SelectItem>
                    <SelectItem value="MIXED">ผสม (เลือกต่อเอกสาร)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  ใช้เป็นค่าเริ่มต้นของลูกค้าใหม่ (ลูกค้าเก่าจะไม่เปลี่ยน)
                </p>
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {t("common.save")}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Document Numbering — with current sequence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("settings.docNumbering")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings.docNumberingDesc")}
          </p>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Prefix
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    {locale === "th" ? "ประเภทเอกสาร" : "Document Type"}
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    {locale === "th" ? "เลขล่าสุด" : "Last Number"}
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    {locale === "th" ? "ถัดไป" : "Next"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {Object.entries(DOC_LABELS).map(([prefix, labels]) => {
                  const seq = seqByPrefix[prefix];
                  const lastSeq = seq?.lastSeq || 0;
                  const year = seq?.year || currentYear;
                  const nextNum = `${prefix}-${year}-${String(lastSeq + 1).padStart(5, "0")}`;
                  return (
                    <tr key={prefix} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {prefix}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {locale === "th" ? labels.th : labels.en}
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {lastSeq > 0 ? (
                          `${prefix}-${year}-${String(lastSeq).padStart(5, "0")}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-blue-600 dark:text-blue-400">
                        {nextNum}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {t("settings.docPattern")}
          </p>
        </CardContent>
      </Card>

      {/* Factory Dashboard Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            {locale === "th" ? "หน้าจอโรงงาน" : "Factory Dashboard"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {locale === "th"
              ? "ลิงก์สำหรับแสดงสถานะการผลิตบนจอ TV ในโรงงาน — ไม่ต้อง login, auto-refresh ทุก 30 วินาที"
              : "Link for displaying production status on factory TV — no login required, auto-refreshes every 30 seconds"}
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={factoryUrl}
              readOnly
              className="font-mono text-xs"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(factoryUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <a href={factoryUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Token: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">workinflow-factory-2026</code>
            {" — "}
            {locale === "th"
              ? "เปลี่ยนได้ที่ ENV: FACTORY_BOARD_TOKEN"
              : "Change via ENV: FACTORY_BOARD_TOKEN"}
          </p>
        </CardContent>
      </Card>

      {/* System Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("settings.system")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">
                  {locale === "th" ? "ผู้ใช้" : "Users"}
                </p>
                <p className="font-semibold text-lg">{systemCounts.users}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">
                  {locale === "th" ? "ลูกค้า" : "Customers"}
                </p>
                <p className="font-semibold text-lg">{systemCounts.customers}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">
                  {locale === "th" ? "สินค้า" : "Products"}
                </p>
                <p className="font-semibold text-lg">{systemCounts.products}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">
                  {locale === "th" ? "วัตถุดิบ" : "Materials"}
                </p>
                <p className="font-semibold text-lg">{systemCounts.materials}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">
                  {locale === "th" ? "เครื่อง CNC" : "CNC Machines"}
                </p>
                <p className="font-semibold text-lg">{systemCounts.machines}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">
                  {locale === "th" ? "วัสดุสิ้นเปลือง" : "Consumables"}
                </p>
                <p className="font-semibold text-lg">
                  {systemCounts.consumables}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <div>
                <Label className="text-muted-foreground">
                  {t("settings.version")}
                </Label>
                <p className="font-mono mt-0.5">v0.1.0</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {t("settings.tenantStatus")}
                </Label>
                <div className="mt-0.5">
                  <Badge
                    variant={tenant.isActive ? "default" : "destructive"}
                  >
                    {tenant.isActive
                      ? t("settings.active")
                      : t("settings.inactive")}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
