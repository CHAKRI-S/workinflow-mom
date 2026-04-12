"use client";

import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { ArrowLeft, Save, Loader2, Package } from "lucide-react";

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

interface BomLine {
  id: string;
  qtyPerUnit: string | number;
  materialSize: string | null;
  materialType: string | null;
  piecesPerStock: number | null;
  product: {
    id: string;
    code: string;
    name: string;
  };
}

interface Material {
  id: string;
  code: string;
  name: string;
  type: string | null;
  specification: string | null;
  unit: string;
  dimensions: string | null;
  stockQty: string | number;
  minStockQty: string | number;
  unitCost: string | number | null;
  supplierId: string | null;
  bomLines: BomLine[];
}

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

export function MaterialDetailClient({ material }: { material: Material }) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, setValue, watch } = useForm<MaterialFormData>({
    defaultValues: {
      code: material.code,
      name: material.name,
      type: material.type || "",
      specification: material.specification || "",
      unit: material.unit,
      dimensions: material.dimensions || "",
      stockQty: String(material.stockQty),
      minStockQty: String(material.minStockQty),
      unitCost: material.unitCost !== null ? String(material.unitCost) : "",
    },
  });

  const currentUnit = watch("unit");

  const onSubmit = async (data: MaterialFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/production/materials/${material.id}`, {
        method: "PATCH",
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

      if (!res.ok) throw new Error("Failed to update");

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const stock = Number(material.stockQty);
  const minStock = Number(material.minStockQty);
  const isLowStock = stock < minStock && minStock > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/production/materials">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {material.code} — {material.name}
        </h1>
        {isLowStock && (
          <Badge variant="destructive">Low Stock</Badge>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl p-3 text-sm">
          Updated successfully
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t("material.edit")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("material.code")}</Label>
                <Input {...register("code")} />
              </div>

              <div className="space-y-1.5">
                <Label>{t("material.name")}</Label>
                <Input {...register("name")} />
              </div>

              <div className="space-y-1.5">
                <Label>{t("material.type")}</Label>
                <Input {...register("type")} />
              </div>

              <div className="space-y-1.5">
                <Label>{t("material.specification")}</Label>
                <Input {...register("specification")} />
              </div>

              <div className="space-y-1.5">
                <Label>{t("material.unit")}</Label>
                <Select
                  value={currentUnit}
                  onValueChange={(v) => {
                    if (v) setValue("unit", v);
                  }}
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
                <Input {...register("dimensions")} />
              </div>

              <div className="space-y-1.5">
                <Label>{t("material.stock")}</Label>
                <Input
                  {...register("stockQty")}
                  type="number"
                  step="0.0001"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("material.minStock")}</Label>
                <Input
                  {...register("minStockQty")}
                  type="number"
                  step="0.0001"
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

            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {t("common.save")}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* BOM Usage */}
      {material.bomLines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>BOM Usage ({material.bomLines.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("material.code")}</TableHead>
                    <TableHead>{t("material.name")}</TableHead>
                    <TableHead>Qty/Unit</TableHead>
                    <TableHead>Pcs/Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {material.bomLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm">
                        {line.product.code}
                      </TableCell>
                      <TableCell>{line.product.name}</TableCell>
                      <TableCell>
                        {Number(line.qtyPerUnit).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {line.piecesPerStock ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
