"use client";

import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const MATERIAL_UNITS = [
  "PCS",
  "KG",
  "M",
  "MM",
  "CM",
  "SHEET",
  "BAR",
  "ROD",
  "BLOCK",
  "SET",
  "BOX",
] as const;

interface MaterialFormData {
  code: string;
  name: string;
  type: string;
  specification: string;
  unit: string;
  dimensions: string;
  stockQty: string;
  minStockQty: string;
  unitCost: string;
}

export function MaterialFormClient() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<MaterialFormData>({
    defaultValues: {
      code: "",
      name: "",
      type: "",
      specification: "",
      unit: "PCS",
      dimensions: "",
      stockQty: "0",
      minStockQty: "0",
      unitCost: "",
    },
  });

  const onSubmit = async (data: MaterialFormData) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/production/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: data.code,
          name: data.name,
          type: data.type || null,
          specification: data.specification || null,
          unit: data.unit,
          dimensions: data.dimensions || null,
          stockQty: data.stockQty ? Number(data.stockQty) : 0,
          minStockQty: data.minStockQty ? Number(data.minStockQty) : 0,
          unitCost: data.unitCost ? Number(data.unitCost) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create material");
      }

      router.push("/production/materials");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/production/materials">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {t("material.new")}
        </h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("material.code")} *</Label>
              <Input
                {...register("code", { required: "Code is required" })}
                placeholder={t("material.code")}
              />
              {errors.code && (
                <p className="text-xs text-destructive">
                  {errors.code.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("material.name")} *</Label>
              <Input
                {...register("name", { required: "Name is required" })}
                placeholder={t("material.name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("material.type")}</Label>
              <Input
                {...register("type")}
                placeholder={t("material.type")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("material.specification")}</Label>
              <Input
                {...register("specification")}
                placeholder={t("material.specification")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("material.unit")}</Label>
              <Select
                defaultValue="PCS"
                onValueChange={(v) => setValue("unit", v ?? "PCS")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("material.selectUnit")} />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("material.dimensions")}</Label>
              <Input
                {...register("dimensions")}
                placeholder={t("material.dimensions")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("material.stock")}</Label>
              <Input
                {...register("stockQty")}
                type="number"
                step="0.0001"
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("material.minStock")}</Label>
              <Input
                {...register("minStockQty")}
                type="number"
                step="0.0001"
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("material.unitCost")}</Label>
              <Input
                {...register("unitCost")}
                type="number"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {t("common.save")}
          </Button>
          <Link href="/production/materials">
            <Button type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
