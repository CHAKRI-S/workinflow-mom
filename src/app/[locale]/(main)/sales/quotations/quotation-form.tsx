"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { quotationCreateSchema } from "@/lib/validators/quotation";
import type { QuotationCreateInput } from "@/lib/validators/quotation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { calculateVatTotals } from "@/lib/vat";
import { CURRENCY_OPTIONS, formatMoney } from "@/lib/currency";
import {
  TAX_TYPE_OPTIONS,
  resolveTaxCalculation,
  type DocumentTaxType,
} from "@/lib/tax-type";
import type { VatModePolicy, VatPriceMode } from "@/lib/vat";

interface Customer {
  id: string;
  code: string;
  name: string;
  isVatRegistered: boolean;
  paymentTermDays?: number;
}

interface Product {
  id: string;
  code: string;
  name: string;
  unitPrice?: string;
  unit?: string;
  defaultVatPriceMode?: VatPriceMode;
}

interface QuotationFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<QuotationCreateInput>;
  quotationId?: string;
}

export function QuotationForm({
  mode,
  defaultValues,
  quotationId,
}: QuotationFormProps) {
  const t = useTranslations("quotation");
  const tc = useTranslations("common");
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<QuotationCreateInput>({
    resolver: zodResolver(quotationCreateSchema),
    defaultValues: {
      customerId: "",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      paymentTerms: "",
      deliveryTerms: "",
      leadTimeDays: undefined,
      discountPercent: 0,
      taxType: "VAT_EXCLUSIVE",
      currencyCode: "THB",
      vatModePolicy: "FORCE_EXCLUSIVE",
      notes: "",
      internalNotes: "",
      lines: [
        {
          productId: "",
          description: "",
          quantity: 1,
          color: "",
          surfaceFinish: "",
          materialSpec: "",
          unitPrice: 0,
          vatPriceMode: "EXCLUSIVE",
          discountPercent: 0,
          notes: "",
          sortOrder: 0,
        },
      ],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  const watchLines = watch("lines");
  const watchDiscountPercent = watch("discountPercent");
  const watchTaxType = (watch("taxType") ?? "VAT_EXCLUSIVE") as DocumentTaxType;
  const watchCurrencyCode = watch("currencyCode") ?? "THB";
  const taxCalculation = resolveTaxCalculation(watchTaxType);
  const vatRate = taxCalculation.vatRate;
  const watchVatModePolicy = taxCalculation.vatModePolicy as VatModePolicy;
  const totals = calculateVatTotals(watchLines || [], {
    vatRate,
    vatModePolicy: watchVatModePolicy,
    discountPercent: watchDiscountPercent || 0,
  });

  // Fetch customers and products
  useEffect(() => {
    fetch("/api/sales/customers")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setCustomers)
      .catch(() => {});
    fetch("/api/production/products")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setProducts)
      .catch(() => {});
  }, []);


  // Calculate summary
  const subtotal = totals.subtotal;
  const discountAmount = totals.discountAmount;
  const vatAmount = totals.vatAmount;
  const totalAmount = totals.totalAmount;

  const onSubmit = async (data: QuotationCreateInput) => {
    setSubmitting(true);
    try {
      const url =
        mode === "create"
          ? "/api/sales/quotations"
          : `/api/sales/quotations/${quotationId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      const result = await res.json();
      router.push(`/sales/quotations/${result.id}`);
    } catch (error) {
      console.error("Save error:", error);
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    setValue(`lines.${index}.productId`, productId);
    const product = products.find((p) => p.id === productId);
    if (product?.unitPrice) {
      setValue(`lines.${index}.unitPrice`, Number(product.unitPrice));
    }
    setValue(
      `lines.${index}.vatPriceMode`,
      product?.defaultVatPriceMode ?? "EXCLUSIVE",
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header info */}
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "create" ? t("new") : tc("edit")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Customer */}
            <div className="space-y-2">
              <Label>{t("customer")}</Label>
              <Select
                value={watch("customerId")}
                onValueChange={(val) => setValue("customerId", val ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCustomer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customerId && (
                <p className="text-xs text-destructive">
                  {errors.customerId.message}
                </p>
              )}
            </div>

            {/* Valid Until */}
            <div className="space-y-2">
              <Label>{t("validUntil")}</Label>
              <Input
                type="date"
                {...register("validUntil")}
                defaultValue={
                  defaultValues?.validUntil
                    ? new Date(defaultValues.validUntil)
                        .toISOString()
                        .split("T")[0]
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split("T")[0]
                }
              />
              {errors.validUntil && (
                <p className="text-xs text-destructive">
                  {errors.validUntil.message}
                </p>
              )}
            </div>

            {/* Payment Terms */}
            <div className="space-y-2">
              <Label>{t("paymentTerms")}</Label>
              <Input {...register("paymentTerms")} />
            </div>

            {/* Delivery Terms */}
            <div className="space-y-2">
              <Label>{t("deliveryTerms")}</Label>
              <Input {...register("deliveryTerms")} />
            </div>

            {/* Lead Time */}
            <div className="space-y-2">
              <Label>
                {t("leadTime")} ({t("days")})
              </Label>
              <Input
                type="number"
                {...register("leadTimeDays", { valueAsNumber: true })}
              />
            </div>

            {/* Overall Discount */}
            <div className="space-y-2">
              <Label>{t("discountPercent")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("discountPercent", { valueAsNumber: true })}
              />
            </div>

            {/* Tax Type */}
            <div className="space-y-2">
              <Label>ประเภทภาษี</Label>
              <Select
                value={watchTaxType}
                onValueChange={(value) => {
                  const taxType = value as DocumentTaxType;
                  const nextCalculation = resolveTaxCalculation(taxType);
                  setValue("taxType", taxType, { shouldDirty: true });
                  setValue("vatModePolicy", nextCalculation.vatModePolicy, {
                    shouldDirty: true,
                  });
                }}
              >
                <SelectTrigger aria-label="ประเภทภาษี: รวม VAT / แยก VAT / ไม่มี VAT">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.labelTh}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.descriptionTh}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.taxType && (
                <p className="text-xs text-destructive">
                  {errors.taxType.message}
                </p>
              )}
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label>สกุลเงิน</Label>
              <Select
                value={watchCurrencyCode}
                onValueChange={(value) =>
                  setValue("currencyCode", value as QuotationCreateInput["currencyCode"], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.code} — {option.label} ({option.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currencyCode && (
                <p className="text-xs text-destructive">
                  {errors.currencyCode.message}
                </p>
              )}
              <p className="text-xs text-amber-700 dark:text-amber-400">
                การเปลี่ยนสกุลเงินไม่แปลงราคาอัตโนมัติ กรุณาตรวจราคาต่อหน่วยอีกครั้ง
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>สรุปภาษีของใบเสนอราคา</Label>
            <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {TAX_TYPE_OPTIONS.find((option) => option.value === watchTaxType)?.labelTh}
              {" — "}
              VAT {vatRate}%
            </p>
          </div>
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>สกุลเงินเอกสาร</span>
              <span>{watchCurrencyCode}</span>
            </div>
            <div className="flex justify-between">
              <span>ตัวอย่างยอดรวม</span>
              <span>{formatMoney(totalAmount, watchCurrencyCode)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("product")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                productId: "",
                description: "",
                quantity: 1,
                color: "",
                surfaceFinish: "",
                materialSpec: "",
                unitPrice: 0,
                vatPriceMode: "EXCLUSIVE",
                discountPercent: 0,
                notes: "",
                sortOrder: fields.length,
                    })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("addLine")}
          </Button>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("noLines")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead className="min-w-[180px]">
                      {t("product")}
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      {t("description")}
                    </TableHead>
                    <TableHead className="w-[100px]">
                      {t("quantity")}
                    </TableHead>
                    <TableHead className="w-[100px]">{t("color")}</TableHead>
                    <TableHead className="w-[120px]">
                      {t("surfaceFinish")}
                    </TableHead>
                    <TableHead className="w-[120px]">
                      {t("unitPrice")}
                    </TableHead>
                    <TableHead className="w-[80px]">
                      {t("discountPercent")}
                    </TableHead>
                    <TableHead className="w-[120px] text-right">
                      {t("lineTotal")}
                    </TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const calculatedLine = totals.lines[index];
                    const lineTotal = calculatedLine?.lineTotal ?? 0;
                    return (
                      <TableRow key={field.id}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={watchLines?.[index]?.productId || ""}
                            onValueChange={(val) =>
                              handleProductChange(index, val ?? "")
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t("selectProduct")}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.code} — {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.lines?.[index]?.productId && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.lines[index].productId?.message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            {...register(`lines.${index}.description`)}
                            className="min-w-[100px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            {...register(`lines.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                            className="w-[90px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            {...register(`lines.${index}.color`)}
                            className="w-[90px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            {...register(`lines.${index}.surfaceFinish`)}
                            className="w-[100px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lines.${index}.unitPrice`, {
                              valueAsNumber: true,
                            })}
                            className="w-[100px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            {...register(`lines.${index}.discountPercent`, {
                              valueAsNumber: true,
                            })}
                            className="w-[70px]"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(lineTotal, watchCurrencyCode)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                        {/* hidden sortOrder */}
                        <TableCell className="hidden">
                          <input
                            type="hidden"
                            {...register(`lines.${index}.sortOrder`, {
                              valueAsNumber: true,
                            })}
                            value={index}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {errors.lines?.root && (
            <p className="text-xs text-destructive mt-2">
              {errors.lines.root.message}
            </p>
          )}

        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span className="font-medium">
{formatMoney(subtotal, watchCurrencyCode)}
                </span>
              </div>
              {(watchDiscountPercent || 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {t("discount")} ({watchDiscountPercent}%)
                  </span>
                  <span>
                    -
{formatMoney(discountAmount, watchCurrencyCode)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {t("vatAmount")} ({vatRate}%)
                </span>
                <span>{formatMoney(vatAmount, watchCurrencyCode)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <span>{t("totalAmount")}</span>
<span>{formatMoney(totalAmount, watchCurrencyCode)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tc("notes")}</Label>
              <Textarea
                {...register("notes")}
                rows={3}
                placeholder={tc("notes")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("internalNotes")}</Label>
              <Textarea
                {...register("internalNotes")}
                rows={3}
                placeholder={t("internalNotes")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/sales/quotations")}
        >
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}
