"use client";

import { useEffect, useState, useCallback } from "react";
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
import { BillingNaturePicker } from "@/components/tax/billing-nature-picker";
import { DrawingSourceRow } from "@/components/tax/drawing-source-row";
import { suggestBillingNature } from "@/lib/validators/billing-nature";
import type {
  BillingNature,
  DrawingSource,
} from "@/lib/validators/billing-nature";

interface Customer {
  id: string;
  code: string;
  name: string;
  isVatRegistered: boolean;
  paymentTermDays?: number;
  defaultBillingNature?: BillingNature;
  brandingAssets?: {
    defaultMark?: string;
    logoUrl?: string;
    notes?: string;
  } | null;
}

interface Product {
  id: string;
  code: string;
  name: string;
  unitPrice?: string;
  unit?: string;
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
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
      billingNature: "GOODS",
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
          discountPercent: 0,
          notes: "",
          sortOrder: 0,
          drawingSource: "TENANT_OWNED",
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
  const watchBillingNature = (watch("billingNature") ?? "GOODS") as BillingNature;

  // Auto-suggest billing nature from line drawing sources
  const suggestedBillingNature = suggestBillingNature(
    (watchLines ?? []).map((l) => ({
      drawingSource: (l.drawingSource as DrawingSource) ?? "TENANT_OWNED",
    }))
  );

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

  const watchedCustomerId = watch("customerId");

  // Track selected customer for VAT display + pre-fill billing nature from customer default
  useEffect(() => {
    if (watchedCustomerId && customers.length > 0) {
      const found = customers.find((c) => c.id === watchedCustomerId);
      setSelectedCustomer(found ?? null);
      // Only pre-fill billingNature on create (not edit) and only if user hasn't manually picked yet
      if (mode === "create" && found?.defaultBillingNature) {
        setValue("billingNature", found.defaultBillingNature);
      }
    }
  }, [watchedCustomerId, customers, mode, setValue]);

  // Calculate line total
  const calcLineTotal = useCallback(
    (line: { quantity: number; unitPrice: number; discountPercent: number }) => {
      const sub = line.quantity * line.unitPrice;
      return sub - sub * (line.discountPercent / 100);
    },
    []
  );

  // Calculate summary
  const subtotal = (watchLines || []).reduce(
    (sum, line) => sum + calcLineTotal(line),
    0
  );
  const discountAmount = subtotal * ((watchDiscountPercent || 0) / 100);
  const afterDiscount = subtotal - discountAmount;
  const vatRate = selectedCustomer?.isVatRegistered ? 7 : 0;
  const vatAmount = afterDiscount * (vatRate / 100);
  const totalAmount = afterDiscount + vatAmount;

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
              {selectedCustomer && (
                <p className="text-xs text-muted-foreground">
                  {t("vatRate")}: {vatRate}%
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
          </div>
        </CardContent>
      </Card>

      {/* Billing Nature */}
      <BillingNaturePicker
        value={watchBillingNature}
        suggestion={suggestedBillingNature}
        onChange={(v) => setValue("billingNature", v)}
      />

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
                discountPercent: 0,
                notes: "",
                sortOrder: fields.length,
                drawingSource: "TENANT_OWNED",
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
                    const line = watchLines?.[index];
                    const lineTotal = line ? calcLineTotal(line) : 0;
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
                          {lineTotal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
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

          {/* Drawing source per line (collapsible) */}
          {fields.length > 0 && (
            <details className="mt-3">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                แบบงาน / Drawing source (ใช้ auto-classify billing nature)
              </summary>
              <div className="mt-3 space-y-3">
                {fields.map((field, index) => {
                  const line = watchLines?.[index];
                  return (
                    <div
                      key={field.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <p className="text-xs text-muted-foreground">
                        #{index + 1}
                      </p>
                      <DrawingSourceRow
                        value={
                          (line?.drawingSource as DrawingSource) ??
                          "TENANT_OWNED"
                        }
                        onChange={(v) =>
                          setValue(`lines.${index}.drawingSource`, v)
                        }
                        productCode={line?.productCode}
                        drawingRevision={line?.drawingRevision}
                        customerDrawingUrl={line?.customerDrawingUrl}
                        onProductCodeChange={(v) =>
                          setValue(`lines.${index}.productCode`, v)
                        }
                        onDrawingRevisionChange={(v) =>
                          setValue(`lines.${index}.drawingRevision`, v)
                        }
                        onCustomerDrawingUrlChange={(v) =>
                          setValue(`lines.${index}.customerDrawingUrl`, v)
                        }
                      />
                      {/* Phase 8.9 — Customer Mark (OEM branding) */}
                      <div className="space-y-1">
                        <Label className="text-xs">Customer Mark</Label>
                        <Input
                          value={line?.customerBranding?.mark ?? ""}
                          onChange={(e) =>
                            setValue(
                              `lines.${index}.customerBranding`,
                              e.target.value
                                ? { mark: e.target.value }
                                : undefined,
                            )
                          }
                          placeholder={
                            selectedCustomer?.brandingAssets?.defaultMark
                              ? `เช่น ${selectedCustomer.brandingAssets.defaultMark}`
                              : "เช่น ACME logo"
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
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
                  {subtotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {(watchDiscountPercent || 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {t("discount")} ({watchDiscountPercent}%)
                  </span>
                  <span>
                    -
                    {discountAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              {vatRate > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {t("vatAmount")} ({vatRate}%)
                  </span>
                  <span>
                    {vatAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <span>{t("totalAmount")}</span>
                <span>
                  {totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
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
