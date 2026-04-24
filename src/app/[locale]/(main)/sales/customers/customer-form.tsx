"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerCreateSchema, CustomerCreateInput } from "@/lib/validators/customer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { ArrowLeft, Save, Loader2, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  BusinessInfoSection,
  type BusinessInfoValue,
  type JuristicTypeValue,
} from "@/components/forms/business-info-section";

interface CustomerFormProps {
  defaultValues?: Partial<CustomerCreateInput> & { id?: string };
  isEdit?: boolean;
  /** Tenant-level default. Falls back to "GOODS" (OEM factor profile).
   *  Used for NEW customers only — existing customers keep their value. */
  tenantDefaultBillingNature?: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
}

export function CustomerForm({
  defaultValues,
  isEdit,
  tenantDefaultBillingNature,
}: CustomerFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tax policy section is collapsed by default — base case (GOODS + no WHT)
  // ไม่ต้องแตะเลย. Expand only for exception customers (contract manufacturing clients).
  const [taxPolicyOpen, setTaxPolicyOpen] = useState(false);
  // OEM branding section also collapsed by default — only relevant if customer
  // requires logo/mark on our products (e.g. ACME logo engraved on all units).
  const [brandingOpen, setBrandingOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerCreateInput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: {
      customerType: "OTHER",
      isVatRegistered: true,
      paymentTermDays: 30,
      // Tax policy defaults — inherit from Tenant.defaultBillingNature (set at
      // signup). OEM goods manufacturer tenants stay at GOODS (no WHT);
      // pure contract-mfg tenants default to MANUFACTURING_SERVICE.
      withholdsTax: false,
      defaultBillingNature: tenantDefaultBillingNature ?? "GOODS",
      ...defaultValues,
    },
  });

  const isVat = watch("isVatRegistered");
  const withholdsTax = watch("withholdsTax") ?? false;
  const defaultBillingNature = watch("defaultBillingNature") ?? "GOODS";
  const brandingAssets = watch("brandingAssets") ?? null;
  const hasBranding = !!(
    brandingAssets?.defaultMark ||
    brandingAssets?.logoUrl ||
    brandingAssets?.notes
  );

  // แสดง warning ถ้า config หลุดจาก base case (ขายสินค้า + ไม่หัก)
  const isNonDefaultTaxPolicy =
    withholdsTax || defaultBillingNature !== "GOODS";

  // Business info section state (bound to form via setValue)
  const watched = watch();
  const businessInfo: BusinessInfoValue = {
    juristicType: (watched.juristicType as JuristicTypeValue | "") || "",
    taxId: watched.taxId || "",
    branchNo: watched.branchNo || "00000",
    name: watched.name || "",
    address: watched.billingAddress || "",
    country: watched.country || "TH",
  };

  const patchBusinessInfo = (patch: Partial<BusinessInfoValue>) => {
    if (patch.juristicType !== undefined) {
      setValue(
        "juristicType",
        patch.juristicType === ""
          ? undefined
          : (patch.juristicType as CustomerCreateInput["juristicType"]),
      );
    }
    if (patch.taxId !== undefined) setValue("taxId", patch.taxId);
    if (patch.branchNo !== undefined) setValue("branchNo", patch.branchNo);
    if (patch.name !== undefined) setValue("name", patch.name);
    if (patch.address !== undefined)
      setValue("billingAddress", patch.address);
    if (patch.country !== undefined) setValue("country", patch.country);
  };

  const onSubmit = async (data: CustomerCreateInput) => {
    setLoading(true);
    setError(null);

    try {
      // Clean optional empty strings
      const cleaned = {
        ...data,
        email: data.email || undefined,
        contactName: data.contactName || undefined,
        phone: data.phone || undefined,
        lineId: data.lineId || undefined,
        taxId: data.taxId || undefined,
        billingAddress: data.billingAddress || undefined,
        shippingAddress: data.shippingAddress || undefined,
        juristicType: data.juristicType || undefined,
        branchNo: data.branchNo || undefined,
        country: data.country || "TH",
        creditLimit: data.creditLimit && !isNaN(data.creditLimit) ? data.creditLimit : undefined,
      };

      const url = isEdit
        ? `/api/sales/customers/${defaultValues?.id}`
        : "/api/sales/customers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      router.push("/sales/customers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/sales/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {isEdit ? t("customer.edit") : t("customer.new")}
        </h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit, (formErrors) => { console.error("Form validation errors:", formErrors); })} className="space-y-6">
        {/* Business Info / Juristic */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">ข้อมูลนิติบุคคล / ผู้เสียภาษี</h2>
          <BusinessInfoSection
            value={businessInfo}
            onChange={patchBusinessInfo}
            onAutoFill={patchBusinessInfo}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </Card>

        {/* Basic Info */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">{t("customer.basicInfo")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("customer.code")}</Label>
              <Input
                {...register("code")}
                disabled={isEdit}
                placeholder={isEdit ? "" : "เว้นว่าง = ระบบสร้างให้ (C-0001)"}
              />
              {!isEdit && (
                <p className="text-xs text-muted-foreground">
                  เว้นว่างได้ — ระบบจะสร้างรหัสให้อัตโนมัติ เช่น C-0001, C-0002 ...
                </p>
              )}
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("customer.type")}</Label>
              <Select
                defaultValue={defaultValues?.customerType || "OTHER"}
                onValueChange={(v) =>
                  setValue("customerType", (v ?? "OTHER") as CustomerCreateInput["customerType"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OEM">OEM</SelectItem>
                  <SelectItem value="DEALER">Dealer</SelectItem>
                  <SelectItem value="END_USER">End User</SelectItem>
                  <SelectItem value="OTHER">{t("common.other") || "Other"}</SelectItem>
                </SelectContent>
              </Select>
              {errors.customerType && (
                <p className="text-xs text-destructive">{errors.customerType.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("customer.contactName")}</Label>
              <Input {...register("contactName")} />
            </div>

            <div className="space-y-1.5">
              <Label>{t("customer.phone")}</Label>
              <Input {...register("phone")} type="tel" />
            </div>

            <div className="space-y-1.5">
              <Label>{t("customer.email")}</Label>
              <Input {...register("email")} type="email" />
            </div>

            <div className="space-y-1.5">
              <Label>LINE ID</Label>
              <Input {...register("lineId")} />
            </div>
          </div>
        </Card>

        {/* Tax & Finance */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">{t("customer.taxFinance")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isVat}
                  onChange={(e) => setValue("isVatRegistered", e.target.checked)}
                  className="rounded"
                />
                {t("customer.isVatRegistered")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {isVat ? t("customer.vatHint") : t("customer.nonVatHint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("customer.paymentTermDays")}</Label>
              <Input
                {...register("paymentTermDays", { valueAsNumber: true })}
                type="number"
                min={0}
              />
              {errors.paymentTermDays && (
                <p className="text-xs text-destructive">{errors.paymentTermDays.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("customer.creditLimit")}</Label>
              <Input
                {...register("creditLimit", { valueAsNumber: true })}
                type="number"
                min={0}
                step="0.01"
              />
            </div>
          </div>
        </Card>

        {/* Tax Policy (Phase 8A) — Billing Nature + WHT toggle
            Default: collapsed + base case (GOODS, no WHT). Expand only for exceptions. */}
        <Card className="p-4 space-y-3">
          <button
            type="button"
            onClick={() => setTaxPolicyOpen((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">นโยบายภาษี</h2>
              {isNonDefaultTaxPolicy && (
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                  พิเศษ
                </span>
              )}
              {!isNonDefaultTaxPolicy && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                  ขายสินค้า (default)
                </span>
              )}
            </div>
            {taxPolicyOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {!taxPolicyOpen && (
            <p className="text-xs text-muted-foreground">
              ปกติไม่ต้องแตะ — ลูกค้าส่วนใหญ่คือ &ldquo;ขายสินค้า ไม่หัก ณ ที่จ่าย&rdquo;
              กดเปิดเฉพาะลูกค้าที่ต้องการออกเป็น &ldquo;รับจ้างทำของ&rdquo; หรือยืนยันจะหัก 3%
            </p>
          )}

          {taxPolicyOpen && (
            <div className="space-y-4 pt-2">
              {/* Billing nature default */}
              <div className="space-y-2">
                <Label>ประเภทเอกสารเริ่มต้น</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    {
                      value: "GOODS" as const,
                      label: "ขายสินค้า",
                      desc: "สินค้า catalog + OEM branding",
                    },
                    {
                      value: "MANUFACTURING_SERVICE" as const,
                      label: "รับจ้างทำของ",
                      desc: "ลูกค้าเอาแบบมา + โดนหัก 3%",
                    },
                    {
                      value: "MIXED" as const,
                      label: "ผสม",
                      desc: "สินค้า + บริการ ในบิลเดียว",
                    },
                  ].map((opt) => {
                    const selected = defaultBillingNature === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setValue("defaultBillingNature", opt.value, {
                            shouldDirty: true,
                          })
                        }
                        className={`rounded-lg border p-3 text-left transition ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full border-2 ${
                              selected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/40"
                            }`}
                          />
                          <span className="text-sm font-medium">
                            {opt.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WHT toggle */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={withholdsTax}
                    onChange={(e) =>
                      setValue("withholdsTax", e.target.checked, {
                        shouldDirty: true,
                      })
                    }
                    className="rounded"
                  />
                  ลูกค้ารายนี้หัก ณ ที่จ่าย 3% (WHT)
                </Label>
                <p className="pl-6 text-xs text-muted-foreground">
                  เปิดเฉพาะลูกค้าที่ยืนยันจะหัก —
                  ปกติขายสินค้าไม่ต้องหัก (ไม่ต้องออก ภ.ง.ด.53)
                </p>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-900">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p>
                    <strong>Tip:</strong> ระบบ default เป็น &ldquo;ขายสินค้า&rdquo;
                    เพราะ OEM manufacturer ที่มี design + วัสดุ + IP เป็นของตัวเอง
                    ตามกฎหมายถือเป็นการขายสินค้า (แม้มีโลโก้ลูกค้ากัดก็ตาม)
                  </p>
                  <p>
                    การเปลี่ยนเป็น &ldquo;รับจ้างทำของ&rdquo; มีผลต่อการออก PDF
                    และต้องตาม WHT Cert ทุกครั้ง — ปรึกษา CPA ก่อนเปลี่ยนนโยบาย
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* OEM Branding (Phase 8.9) — optional, collapsed by default.
            Open only if customer requires us to engrave/print their mark. */}
        <Card className="p-4 space-y-3">
          <button
            type="button"
            onClick={() => setBrandingOpen((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">
                OEM Branding (ถ้าลูกค้าติดโลโก้บนสินค้า)
              </h2>
              {hasBranding ? (
                <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                  มี brand
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                  ไม่มี
                </span>
              )}
            </div>
            {brandingOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {!brandingOpen && (
            <p className="text-xs text-muted-foreground">
              เปิดเฉพาะลูกค้าที่ต้องการให้เรา&ldquo;ติดโลโก้/Mark&rdquo;
              บนสินค้า (เช่น ลูกค้า OEM ที่ติดแบรนด์ตัวเองบนของเรา) —
              ใช้เป็นค่า default ในแต่ละบรรทัดใบเสนอราคา/SO/Invoice
            </p>
          )}

          {brandingOpen && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>ชื่อโลโก้ / Mark เริ่มต้น</Label>
                <Input
                  {...register("brandingAssets.defaultMark")}
                  placeholder="เช่น ACME logo, XYZ Brand"
                />
                <p className="text-xs text-muted-foreground">
                  แสดงใน PDF เป็นบรรทัดย่อย &ldquo;Customer Mark: ...&rdquo;
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>URL โลโก้ (ถ้ามี)</Label>
                <Input
                  {...register("brandingAssets.logoUrl")}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              <div className="space-y-1.5">
                <Label>หมายเหตุ brand</Label>
                <Textarea
                  {...register("brandingAssets.notes")}
                  rows={2}
                  placeholder="รายละเอียดเพิ่มเติม เช่น สี/ตำแหน่งติดโลโก้"
                />
              </div>

              <div className="flex items-start gap-2 rounded-md bg-indigo-50 p-3 text-xs text-indigo-900">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  การติดโลโก้ลูกค้าบนสินค้าที่เราผลิตเองถือเป็น
                  &ldquo;ขายสินค้าพร้อม spec&rdquo; ไม่ใช่ &ldquo;รับจ้างทำของ&rdquo;
                  — ดูอ้างอิงคำพิพากษาและแนวปฏิบัติที่
                  {" "}
                  <a href="/kb/oem-goods" target="_blank" className="underline">
                    /kb/oem-goods
                  </a>
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Shipping Address (billing is in Business Info above) */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">{t("customer.shippingAddress")}</h2>
          <p className="text-xs text-muted-foreground">
            ที่อยู่สำหรับจัดส่งสินค้า (ถ้าต่างจากที่อยู่ออกบิล)
          </p>
          <div className="space-y-1.5">
            <Textarea {...register("shippingAddress")} rows={2} />
          </div>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {t("common.save")}
          </Button>
          <Link href="/sales/customers">
            <Button type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
