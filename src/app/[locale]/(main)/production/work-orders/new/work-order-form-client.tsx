"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

const formSchema = z.object({
  productId: z.string().min(1, "Required"),
  cncMachineId: z.string().optional(),
  plannedQty: z.number().positive("Must be > 0"),
  plannedStart: z.string().min(1, "Required"),
  plannedEnd: z.string().min(1, "Required"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  color: z.string().optional(),
  materialSize: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SelectOption {
  id: string;
  code: string;
  name: string;
}

interface WorkOrderFormClientProps {
  products: SelectOption[];
  machines: SelectOption[];
}

export function WorkOrderFormClient({
  products,
  machines,
}: WorkOrderFormClientProps) {
  const t = useTranslations("workOrder");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      cncMachineId: "",
      plannedQty: undefined,
      plannedStart: "",
      plannedEnd: "",
      priority: "NORMAL",
      color: "",
      materialSize: "",
      assignedTo: "",
      notes: "",
    },
  });

  const selectedProductId = watch("productId");
  const selectedPriority = watch("priority");

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/production/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          cncMachineId: data.cncMachineId || null,
          color: data.color || null,
          materialSize: data.materialSize || null,
          assignedTo: data.assignedTo || null,
          notes: data.notes || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Failed to create work order");
        return;
      }

      const created = await res.json();
      router.push(`/production/work-orders/${created.id}`);
    } catch {
      alert("Network error");
    } finally {
      setIsSubmitting(false);
    }
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
        <h1 className="text-2xl font-medium">{t("new")}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("woInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product */}
              <div className="space-y-1.5">
                <Label htmlFor="productId">{t("product")} *</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={(val) => setValue("productId", val ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("selectProduct")} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.productId && (
                  <p className="text-xs text-destructive">
                    {errors.productId.message}
                  </p>
                )}
              </div>

              {/* CNC Machine */}
              <div className="space-y-1.5">
                <Label htmlFor="cncMachineId">{t("machine")}</Label>
                <Select
                  value={watch("cncMachineId") ?? ""}
                  onValueChange={(val) =>
                    setValue("cncMachineId", !val || val === "__none__" ? "" : val)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("selectMachine")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-</SelectItem>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.code} - {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label>{t("priority")}</Label>
                <Select
                  value={selectedPriority}
                  onValueChange={(val) =>
                    setValue("priority", (val ?? "NORMAL") as FormValues["priority"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map(
                      (p) => (
                        <SelectItem key={p} value={p}>
                          {t(`priority_label.${p}` as any)}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Planned Qty */}
              <div className="space-y-1.5">
                <Label htmlFor="plannedQty">{t("plannedQty")} *</Label>
                <Input
                  id="plannedQty"
                  type="number"
                  step="0.0001"
                  min="0"
                  {...register("plannedQty", { valueAsNumber: true })}
                />
                {errors.plannedQty && (
                  <p className="text-xs text-destructive">
                    {errors.plannedQty.message}
                  </p>
                )}
              </div>

              {/* Assigned To */}
              <div className="space-y-1.5">
                <Label htmlFor="assignedTo">{t("assignedTo")}</Label>
                <Input id="assignedTo" {...register("assignedTo")} />
              </div>
            </CardContent>
          </Card>

          {/* Dates & Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>{tc("date")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Planned Start */}
              <div className="space-y-1.5">
                <Label htmlFor="plannedStart">{t("plannedStart")} *</Label>
                <Input
                  id="plannedStart"
                  type="date"
                  {...register("plannedStart")}
                />
                {errors.plannedStart && (
                  <p className="text-xs text-destructive">
                    {errors.plannedStart.message}
                  </p>
                )}
              </div>

              {/* Planned End */}
              <div className="space-y-1.5">
                <Label htmlFor="plannedEnd">{t("plannedEnd")} *</Label>
                <Input
                  id="plannedEnd"
                  type="date"
                  {...register("plannedEnd")}
                />
                {errors.plannedEnd && (
                  <p className="text-xs text-destructive">
                    {errors.plannedEnd.message}
                  </p>
                )}
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <Label htmlFor="color">{t("color")}</Label>
                <Input id="color" {...register("color")} />
              </div>

              {/* Material Size */}
              <div className="space-y-1.5">
                <Label htmlFor="materialSize">{t("materialSize")}</Label>
                <Input id="materialSize" {...register("materialSize")} />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">{tc("notes")}</Label>
                <Textarea id="notes" {...register("notes")} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 justify-end">
          <Link href="/production/work-orders">
            <Button variant="outline" type="button">
              {tc("cancel")}
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="h-4 w-4 animate-spin" data-icon="inline-start" />
            )}
            {tc("create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
