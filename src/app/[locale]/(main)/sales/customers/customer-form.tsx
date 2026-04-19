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
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  BusinessInfoSection,
  type BusinessInfoValue,
  type JuristicTypeValue,
} from "@/components/forms/business-info-section";

interface CustomerFormProps {
  defaultValues?: Partial<CustomerCreateInput> & { id?: string };
  isEdit?: boolean;
}

export function CustomerForm({ defaultValues, isEdit }: CustomerFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      ...defaultValues,
    },
  });

  const isVat = watch("isVatRegistered");

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
