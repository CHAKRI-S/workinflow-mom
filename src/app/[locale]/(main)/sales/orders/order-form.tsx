"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  salesOrderCreateSchema,
  SalesOrderCreateInput,
} from "@/lib/validators/sales-order";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { detectServiceWording } from "@/lib/po-wording-check";
import { calculateDocumentTotals } from "@/lib/document-tax-propagation";
import { CURRENCY_OPTIONS, formatMoney } from "@/lib/currency";
import {
  TAX_TYPE_OPTIONS,
  resolveTaxCalculation,
  type DocumentTaxType,
} from "@/lib/tax-type";
import type { VatPriceMode } from "@/lib/vat";

interface Customer {
  id: string;
  code: string;
  name: string;
  isVatRegistered: boolean;
  shippingAddress?: string | null;
  paymentTermDays?: number;
}

interface Product {
  id: string;
  code: string;
  name: string;
  unitPrice?: string | number;
  defaultVatPriceMode?: VatPriceMode;
  defaultColor?: string | null;
  defaultSurfaceFinish?: string | null;
}

interface OrderFormProps {
  defaultValues?: Partial<SalesOrderCreateInput> & { id?: string };
  isEdit?: boolean;
}

export function OrderForm({ defaultValues, isEdit }: OrderFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SalesOrderCreateInput>({
    resolver: zodResolver(salesOrderCreateSchema),
    defaultValues: {
      customerId: "",
      depositPercent: 0,
      requestedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      taxType: "VAT_EXCLUSIVE",
      currencyCode: "THB",
      vatModePolicy: "FORCE_EXCLUSIVE",
      lines: [
        {
          productId: "",
          quantity: 1,
          unitPrice: 0,
          vatPriceMode: "EXCLUSIVE",
          discountPercent: 0,
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
  const watchCustomerId = watch("customerId");
  const watchDepositPercent = watch("depositPercent");
  const watchTaxType = (watch("taxType") ?? "VAT_EXCLUSIVE") as DocumentTaxType;
  const watchCurrencyCode = watch("currencyCode") ?? "THB";
  const taxCalculation = resolveTaxCalculation(watchTaxType);
  const vatRate = taxCalculation.vatRate;
  const watchCustomerPoNumber = watch("customerPoNumber");
  const poWordingCheck = detectServiceWording(watchCustomerPoNumber);


  // Fetch customers and products
  useEffect(() => {
    fetch("/api/sales/customers")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then((data) => setCustomers(data))
      .catch(() => {});

    fetch("/api/production/products")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then((data) => setProducts(data))
      .catch(() => {});
  }, []);

  // Calculate financial summary from document taxType, not customer VAT registration.
  const selectedCustomer = customers.find((c) => c.id === watchCustomerId);
  const vatTotals = calculateDocumentTotals({
    taxType: watchTaxType,
    currencyCode: watchCurrencyCode,
    lines: watchLines || [],
  });
  const totals = {
    subtotal: vatTotals.subtotal,
    vatAmount: vatTotals.vatAmount,
    total: vatTotals.totalAmount,
    depositAmount:
      vatTotals.totalAmount * ((Number(watchDepositPercent) || 0) / 100),
  };

  const formatCurrency = (amount: number) => formatMoney(amount, watchCurrencyCode);

  // Auto-fill shipping address when customer changes
  useEffect(() => {
    if (!isEdit) {
      if (selectedCustomer?.shippingAddress) {
        setValue("shippingAddress", selectedCustomer.shippingAddress);
      }
    }
  }, [selectedCustomer, setValue, isEdit]);

  const onSubmit = async (data: SalesOrderCreateInput) => {
    setLoading(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/sales/orders/${defaultValues?.id}`
        : "/api/sales/orders";
      const method = isEdit ? "PATCH" : "POST";

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
      if (isEdit) {
        router.push(`/sales/orders/${defaultValues?.id}`);
      } else {
        router.push(`/sales/orders/${result.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    setValue(`lines.${index}.productId`, productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`lines.${index}.unitPrice`, Number(product.unitPrice) || 0);
      setValue(
        `lines.${index}.vatPriceMode`,
        product.defaultVatPriceMode ?? "EXCLUSIVE",
      );
      if (product.defaultColor) {
        setValue(`lines.${index}.color`, product.defaultColor);
      }
      if (product.defaultSurfaceFinish) {
        setValue(`lines.${index}.surfaceFinish`, product.defaultSurfaceFinish);
      }
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/sales/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {isEdit ? t("salesOrder.edit") : t("salesOrder.new")}
        </h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Order Info */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">{t("salesOrder.orderInfo")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("salesOrder.customer")} *</Label>
              <Select
                defaultValue={defaultValues?.customerId || ""}
                onValueChange={(v) => setValue("customerId", v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("salesOrder.selectCustomer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} - {c.name}
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

            <div className="space-y-1.5">
              <Label>{t("salesOrder.customerPoNumber")}</Label>
              <Input {...register("customerPoNumber")} />
              {poWordingCheck.flagged && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-1">
                  <strong>⚠ ระวัง:</strong> PO มีคำว่า{" "}
                  <code className="font-mono">
                    {poWordingCheck.matches.join(", ")}
                  </code>{" "}
                  ซึ่งตีความเป็น &quot;รับจ้างทำของ&quot; — แนะนำให้ขอลูกค้าแก้เป็น &quot;สั่งซื้อสินค้า&quot;
                  เพื่อไม่ให้โดนหัก WHT 3%
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("salesOrder.requestedDate")} *</Label>
              <Input
                {...register("requestedDate", { valueAsDate: true })}
                type="date"
              />
              {errors.requestedDate && (
                <p className="text-xs text-destructive">
                  {errors.requestedDate.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("salesOrder.promisedDate")}</Label>
              <Input
                {...register("promisedDate", { valueAsDate: true })}
                type="date"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("salesOrder.depositPercent")}</Label>
              <Input
                {...register("depositPercent", { valueAsNumber: true })}
                type="number"
                min={0}
                max={100}
                step="0.01"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("salesOrder.paymentTerms")}</Label>
              <Input {...register("paymentTerms")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("salesOrder.shippingAddress")}</Label>
            <Textarea {...register("shippingAddress")} rows={2} />
          </div>
        </Card>


        <Card className="p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
              <Label>สกุลเงิน</Label>
              <Select
                value={watchCurrencyCode}
                onValueChange={(value) =>
                  setValue(
                    "currencyCode",
                    value as SalesOrderCreateInput["currencyCode"],
                    { shouldDirty: true },
                  )
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

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {TAX_TYPE_OPTIONS.find((option) => option.value === watchTaxType)?.labelTh}
              {" — "}
              VAT {vatRate}%
            </p>
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>สกุลเงินเอกสาร</span>
                <span>{watchCurrencyCode}</span>
              </div>
              <div className="flex justify-between">
                <span>ตัวอย่างยอดรวม</span>
                <span>{formatMoney(totals.total, watchCurrencyCode)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Line Items */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("salesOrder.lines")}</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  productId: "",
                  quantity: 1,
                  unitPrice: 0,
                  vatPriceMode: "EXCLUSIVE",
                  discountPercent: 0,
                  sortOrder: fields.length,
                        })
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("salesOrder.addLine")}
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("salesOrder.noLines")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="min-w-[180px]">
                      {t("salesOrder.product")}
                    </TableHead>
                    <TableHead>{t("salesOrder.description")}</TableHead>
                    <TableHead className="w-24">
                      {t("salesOrder.quantity")}
                    </TableHead>
                    <TableHead className="w-28">
                      {t("salesOrder.unitPrice")}
                    </TableHead>
                    <TableHead className="w-32">VAT</TableHead>
                    <TableHead className="w-20">
                      {t("salesOrder.discountPercent")}
                    </TableHead>
                    <TableHead className="w-32">
                      {t("salesOrder.lineTotal")}
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const line = watchLines?.[index];
                    const calculatedLine = vatTotals.lines[index];
                    const lineTotal = calculatedLine?.lineTotal ?? 0;
                    const effectiveMode =
                      calculatedLine?.vatPriceMode ??
                      line?.vatPriceMode ??
                      "EXCLUSIVE";

                    return (
                      <TableRow key={field.id}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <Select
                            defaultValue={
                              defaultValues?.lines?.[index]?.productId || ""
                            }
                            onValueChange={(v) =>
                              handleProductChange(index, v ?? "")
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t("salesOrder.selectProduct")}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.code} - {p.name}
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
                            placeholder={t("salesOrder.description")}
                            className="min-w-[120px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            {...register(`lines.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                            type="number"
                            min={0.0001}
                            step="any"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            {...register(`lines.${index}.unitPrice`, {
                              valueAsNumber: true,
                            })}
                            type="number"
                            min={0}
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={effectiveMode}
                            onValueChange={(v) =>
                              setValue(
                                `lines.${index}.vatPriceMode`,
                                v as VatPriceMode,
                              )
                            }
                            disabled
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EXCLUSIVE">VAT นอก</SelectItem>
                              <SelectItem value="INCLUSIVE">VAT ใน</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            ใช้ {effectiveMode === "INCLUSIVE" ? "VAT ใน" : "VAT นอก"} ตามประเภทภาษี
                          </p>
                        </TableCell>
                        <TableCell>
                          <Input
                            {...register(`lines.${index}.discountPercent`, {
                              valueAsNumber: true,
                            })}
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {formatCurrency(lineTotal)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {errors.lines && typeof errors.lines.message === "string" && (
            <p className="text-xs text-destructive">{errors.lines.message}</p>
          )}

          {/* Optional line details (color, surface finish, etc) */}
          {fields.length > 0 && (
            <details className="mt-2">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                {t("salesOrder.color")} / {t("salesOrder.surfaceFinish")} / {t("salesOrder.materialSpec")}
              </summary>
              <div className="mt-3 space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b pb-3"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs">
                        #{index + 1} {t("salesOrder.color")}
                      </Label>
                      <Input
                        {...register(`lines.${index}.color`)}
                        placeholder={t("salesOrder.color")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {t("salesOrder.surfaceFinish")}
                      </Label>
                      <Input
                        {...register(`lines.${index}.surfaceFinish`)}
                        placeholder={t("salesOrder.surfaceFinish")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {t("salesOrder.materialSpec")}
                      </Label>
                      <Input
                        {...register(`lines.${index}.materialSpec`)}
                        placeholder={t("salesOrder.materialSpec")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

        </Card>

        {/* Financial Summary */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("salesOrder.financialSummary")}</h2>

          <div className="space-y-2 max-w-sm ml-auto text-sm">
            <div className="flex justify-between">
              <span>{t("salesOrder.subtotal")}</span>
              <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t("salesOrder.vatAmount")} ({vatRate}%)
              </span>
              <span className="font-mono">
                {formatCurrency(totals.vatAmount)}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span>{t("salesOrder.totalAmount")}</span>
              <span className="font-mono">{formatCurrency(totals.total)}</span>
            </div>
            {Number(watchDepositPercent) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {t("salesOrder.depositAmount")} ({watchDepositPercent}%)
                </span>
                <span className="font-mono">
                  {formatCurrency(totals.depositAmount)}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("common.notes")}</Label>
              <Textarea {...register("notes")} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("salesOrder.internalNotes")}</Label>
              <Textarea {...register("internalNotes")} rows={3} />
            </div>
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
          <Link href="/sales/orders">
            <Button type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
