"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productCreateSchema, ProductCreateInput } from "@/lib/validators/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useRef, useCallback } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2, ImagePlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  getBomMaterialModeLabelTh,
  getBomMaterialSourcingLabelTh,
  getDrawingSourceLabelTh,
  getMaterialUnitLabelTh,
  getProductKindLabelTh,
  getVatPriceModeLabelTh,
} from "@/lib/select-labels";

interface MaterialOption {
  id: string;
  code: string;
  name: string;
  unit: string;
}

function getMaterialOptionLabel(
  materials: MaterialOption[],
  materialId?: string | null,
): string {
  if (!materialId) return "";
  const material = materials.find((m) => m.id === materialId);
  return material ? `${material.code} — ${material.name}` : "ไม่พบวัตถุดิบที่เลือก";
}

type BomMaterialMode = "EXISTING" | "NEW";
type BomMaterialSourcing = "STOCK_CUT" | "JOB_SPECIFIC";

type MaterialUnit =
  | "PCS"
  | "KG"
  | "M"
  | "MM"
  | "CM"
  | "SHEET"
  | "BAR"
  | "ROD"
  | "BLOCK"
  | "SET"
  | "BOX";

const MATERIAL_UNITS: MaterialUnit[] = [
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
];

interface NewMaterialForm {
  name: string;
  type: string;
  specification: string;
  unit: MaterialUnit;
  dimensions: string;
  minStockQty: number;
  unitCost: number | null;
}

interface BomFormLine {
  mode: BomMaterialMode;
  materialId: string;
  newMaterial: NewMaterialForm;
  qtyPerUnit: number;
  materialSize: string;
  materialType: string;
  piecesPerStock: number | null;
  notes: string;
  sourcing: BomMaterialSourcing;
  sortOrder: number;
}

interface ExistingBomLine {
  id: string;
  materialId: string;
  qtyPerUnit: string | number;
  materialSize: string | null;
  materialType: string | null;
  piecesPerStock: number | null;
  notes: string | null;
  sourcing?: BomMaterialSourcing | null;
  sortOrder: number;
  material: { id: string; code: string; name: string; unit: string };
}

interface BomLinePayload {
  materialId?: string;
  newMaterial?: {
    name: string;
    type?: string;
    specification?: string;
    unit: MaterialUnit;
    dimensions?: string;
    minStockQty?: number;
    unitCost?: number;
  };
  qtyPerUnit: number;
  materialSize?: string;
  materialType?: string;
  piecesPerStock?: number;
  notes?: string;
  sourcing: BomMaterialSourcing;
  sortOrder: number;
}

function createEmptyNewMaterial(): NewMaterialForm {
  return {
    name: "",
    type: "",
    specification: "",
    unit: "PCS",
    dimensions: "",
    minStockQty: 0,
    unitCost: null,
  };
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeNewMaterial(newMaterial: NewMaterialForm): BomLinePayload["newMaterial"] {
  return {
    name: newMaterial.name.trim(),
    type: emptyToUndefined(newMaterial.type),
    specification: emptyToUndefined(newMaterial.specification),
    unit: newMaterial.unit,
    dimensions: emptyToUndefined(newMaterial.dimensions),
    minStockQty: newMaterial.minStockQty || undefined,
    unitCost: newMaterial.unitCost ?? undefined,
  };
}

export function buildBomLinePayload(lines: BomFormLine[]): BomLinePayload[] {
  return lines.flatMap((line, idx): BomLinePayload[] => {
    const common = {
      qtyPerUnit: line.qtyPerUnit,
      materialSize: emptyToUndefined(line.materialSize),
      materialType: emptyToUndefined(line.materialType),
      piecesPerStock: line.piecesPerStock ?? undefined,
      notes: emptyToUndefined(line.notes),
      sourcing: line.sourcing ?? "STOCK_CUT",
      sortOrder: idx,
    } satisfies Omit<BomLinePayload, "materialId" | "newMaterial">;

    if (line.mode === "EXISTING" && line.materialId) {
      const payload: BomLinePayload = { ...common, materialId: line.materialId };
      return [payload];
    }

    if (line.mode === "NEW" && line.newMaterial.name.trim()) {
      const payload: BomLinePayload = {
        ...common,
        newMaterial: sanitizeNewMaterial(line.newMaterial),
      };
      return [payload];
    }

    return [];
  });
}

export function getBomLineValidationError(lines: BomFormLine[]): string | null {
  const missingNewMaterialNameIndex = lines.findIndex(
    (line) => line.mode === "NEW" && !line.newMaterial.name.trim(),
  );

  if (missingNewMaterialNameIndex >= 0) {
    return `กรุณากรอกชื่อวัตถุดิบใหม่ใน BOM #${missingNewMaterialNameIndex + 1}`;
  }

  return null;
}

interface ProductImageItem {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

interface PendingImage {
  file: File;
  caption: string;
  previewUrl: string;
}

interface ProductFormProps {
  defaultValues?: Partial<ProductCreateInput> & { id?: string };
  isEdit?: boolean;
  materials?: MaterialOption[];
  existingBomLines?: ExistingBomLine[];
  existingImages?: ProductImageItem[];
}

export function ProductForm({ defaultValues, isEdit, materials = [], existingBomLines = [], existingImages = [] }: ProductFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image state
  const [savedImages, setSavedImages] = useState<ProductImageItem[]>(existingImages);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageCaption, setImageCaption] = useState("");
  const formFileInputRef = useRef<HTMLInputElement>(null);

  const addPendingImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setPendingImages((prev) => [...prev, { file, caption: imageCaption, previewUrl }]);
      setImageCaption("");
    }
    e.target.value = "";
  }, [imageCaption]);

  const removePendingImage = (idx: number) => {
    setPendingImages((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const deleteSavedImage = async (imageId: string) => {
    if (!defaultValues?.id) return;
    try {
      const res = await fetch(`/api/production/products/${defaultValues.id}/images/${imageId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setSavedImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch {
      setError("Failed to delete image");
    }
  };

  const uploadPendingImages = async (productId: string) => {
    for (const pending of pendingImages) {
      const formData = new FormData();
      formData.append("file", pending.file);
      formData.append("folder", "products");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) continue;
      const { url } = await uploadRes.json();

      await fetch(`/api/production/products/${productId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, caption: pending.caption || undefined }),
      });
    }
  };

  // BOM state
  const [bomLines, setBomLines] = useState<BomFormLine[]>(
    existingBomLines.map((l) => ({
      mode: "EXISTING",
      materialId: l.materialId,
      newMaterial: createEmptyNewMaterial(),
      qtyPerUnit: Number(l.qtyPerUnit),
      materialSize: l.materialSize || "",
      materialType: l.materialType || "",
      piecesPerStock: l.piecesPerStock || null,
      notes: l.notes || "",
      sourcing: l.sourcing ?? "STOCK_CUT",
      sortOrder: l.sortOrder,
    }))
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      productKind: "GOODS",
      drawingSource: "TENANT_OWNED",
      requiresPainting: false,
      requiresLogoEngraving: false,
      defaultVatPriceMode: "EXCLUSIVE",
      leadTimeDays: 0,
      ...defaultValues,
    },
  });

  const addBomLine = () => {
    setBomLines((prev) => [
      ...prev,
      {
        mode: "EXISTING",
        materialId: "",
        newMaterial: createEmptyNewMaterial(),
        qtyPerUnit: 1,
        materialSize: "",
        materialType: "",
        piecesPerStock: null,
        notes: "",
        sourcing: "STOCK_CUT",
        sortOrder: prev.length,
      },
    ]);
  };

  const removeBomLine = (idx: number) => {
    setBomLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBomLine = (
    idx: number,
    field: keyof BomFormLine,
    value: string | number | null | NewMaterialForm,
  ) => {
    setBomLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const updateBomLineMode = (idx: number, mode: BomMaterialMode) => {
    setBomLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              mode,
              materialId: mode === "EXISTING" ? l.materialId : "",
              newMaterial: mode === "NEW" ? l.newMaterial : createEmptyNewMaterial(),
            }
          : l,
      ),
    );
  };

  const updateNewMaterial = (
    idx: number,
    field: keyof NewMaterialForm,
    value: string | number | null,
  ) => {
    setBomLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              newMaterial: { ...l.newMaterial, [field]: value },
            }
          : l,
      ),
    );
  };

  const onSubmit = async (data: ProductCreateInput) => {
    setLoading(true);
    setError(null);

    const bomLineValidationError = getBomLineValidationError(bomLines);
    if (bomLineValidationError) {
      setError(bomLineValidationError);
      setLoading(false);
      return;
    }

    try {
      const url = isEdit
        ? `/api/production/products/${defaultValues?.id}`
        : "/api/production/products";
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

      const product = await res.json();
      const productId = isEdit ? defaultValues?.id : product.id;

      // Save BOM lines. Empty/unfinished rows are ignored; edit mode sends [] to clear BOM.
      if (productId) {
        const validLines = buildBomLinePayload(bomLines);
        if (validLines.length > 0 || isEdit) {
          const bomRes = await fetch(`/api/production/products/${productId}/bom`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lines: validLines }),
          });
          if (!bomRes.ok) {
            throw new Error("Product saved but BOM failed to save");
          }
        }
      }

      // Upload pending images
      if (productId && pendingImages.length > 0) {
        await uploadPendingImages(productId);
      }

      router.push(`/production/products/${productId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/production/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEdit ? t("product.edit") : t("product.new")}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">{t("product.basicInfo")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isEdit ? (
              <div className="space-y-1.5">
                <Label>{t("product.code")}</Label>
                <Input {...register("code")} disabled />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>รหัสสินค้า</Label>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  ระบบจะสร้างรหัสสินค้าให้อัตโนมัติ
                </div>
                <p className="text-xs text-muted-foreground">
                  รูปแบบตามรหัสบริษัท เช่น WF01-PRD-0001
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("product.name")} *</Label>
              <Input {...register("name")} />
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  {t("product.nameEditHint")}
                </p>
              )}
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.category")}</Label>
              <Input {...register("category")} placeholder="Bracket, Cover, Adapter..." />
            </div>

            <div className="space-y-1.5">
              <Label>ประเภท *</Label>
              <Select
                value={watch("productKind") ?? "GOODS"}
                onValueChange={(v) =>
                  setValue("productKind", v as ProductCreateInput["productKind"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => getProductKindLabelTh(value) || "สินค้า"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GOODS">สินค้า</SelectItem>
                  <SelectItem value="SERVICE">บริการ</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                เลือกว่าเป็นสินค้า/บริการจาก Product master เพื่อใช้เป็นข้อมูลอ้างอิงเอกสาร
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.unitPrice")}</Label>
              <Input
                {...register("unitPrice", { valueAsNumber: true })}
                type="number"
                min={0}
                step="0.01"
              />
            </div>

            <div className="space-y-1.5">
              <Label>รูปแบบ VAT เริ่มต้น</Label>
              <Select
                value={watch("defaultVatPriceMode") ?? "EXCLUSIVE"}
                onValueChange={(v) =>
                  setValue(
                    "defaultVatPriceMode",
                    v as ProductCreateInput["defaultVatPriceMode"],
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => getVatPriceModeLabelTh(value) || "VAT นอก"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXCLUSIVE">VAT นอก</SelectItem>
                  <SelectItem value="INCLUSIVE">VAT ใน</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.leadTimeDays")}</Label>
              <Input
                {...register("leadTimeDays", { valueAsNumber: true })}
                type="number"
                min={0}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("product.description")}</Label>
            <Textarea {...register("description")} rows={2} />
          </div>
        </Card>

        {/* Fusion 360 / Drawing */}
        <Card className="p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="font-semibold">ข้อมูลแบบงานของสินค้า/บริการ</h2>
            <p className="text-xs text-muted-foreground">
              ข้อมูลที่มาของแบบเป็น metadata สำหรับอ้างอิงงานผลิต ไม่ใช่การจัดประเภทภาษีอัตโนมัติ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ที่มาของแบบ</Label>
              <Select
                value={watch("drawingSource") ?? "TENANT_OWNED"}
                onValueChange={(v) =>
                  setValue("drawingSource", v as ProductCreateInput["drawingSource"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => getDrawingSourceLabelTh(value) || "แบบเรา"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT_OWNED">แบบเรา</SelectItem>
                  <SelectItem value="CUSTOMER_PROVIDED">แบบลูกค้า</SelectItem>
                  <SelectItem value="JOINT_DEVELOPMENT">ร่วมพัฒนา</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Drawing Rev</Label>
              <Input {...register("drawingRevision")} placeholder="REV-A" />
            </div>

            <div className="space-y-1.5">
              <Label>ไฟล์แบบจากลูกค้า (URL)</Label>
              <Input {...register("customerDrawingUrl")} placeholder="https://..." />
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.fusionFileName")}</Label>
              <Input {...register("fusionFileName")} placeholder="Part_A100_v3.f3d" />
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.fusionFileUrl")}</Label>
              <Input {...register("fusionFileUrl")} placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("product.drawingNotes")}</Label>
            <Textarea {...register("drawingNotes")} rows={2} />
          </div>
        </Card>

        {/* Manufacturing Options */}
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">{t("product.manufacturing")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Label className="flex items-center gap-2">
              <input type="checkbox" {...register("requiresPainting")} className="rounded" />
              {t("product.requiresPainting")}
            </Label>

            <Label className="flex items-center gap-2">
              <input type="checkbox" {...register("requiresLogoEngraving")} className="rounded" />
              {t("product.requiresLogo")}
            </Label>

            <div className="md:col-span-2 space-y-1.5">
              <Label>หมายเหตุสี/ผิวสำเร็จ</Label>
              <Textarea
                {...register("finishingNotes")}
                rows={3}
                placeholder="เช่น ลูกค้าสั่งหลายสีในสินค้าเดียวกัน: สีแดง 5 ชิ้น, สีดำ 10 ชิ้น / ผิว anodize ตาม line item"
              />
              <p className="text-xs text-muted-foreground">
                ใช้บันทึกหมายเหตุรวมเมื่อลูกค้าสั่งหลายสีหรือหลายผิวสำเร็จในสินค้าเดียวกัน ไม่แยกเป็นหลายช่องเพื่อไม่ให้สับสน
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.cycleTime")}</Label>
              <Input
                {...register("cycleTimeMinutes", { valueAsNumber: true })}
                type="number"
                min={0}
                step="0.01"
                placeholder="5.00"
              />
              <p className="text-xs text-muted-foreground">{t("product.cycleTimeHint")}</p>
            </div>
          </div>
        </Card>

        {/* BOM - Bill of Materials */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("product.bom")}</h2>
            <Button type="button" onClick={addBomLine} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t("product.addMaterial")}
            </Button>
          </div>

          {bomLines.length > 0 ? (
            <div className="space-y-4">
              {bomLines.map((line, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border bg-card/50 p-4 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">วัตถุดิบ #{idx + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        เลือกจากคลังเดิม หรือสร้างวัตถุดิบใหม่พร้อมบันทึกเข้า Master
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeBomLine(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>วิธีเลือกวัตถุดิบ</Label>
                      <Select
                        value={line.mode}
                        onValueChange={(v) => updateBomLineMode(idx, v as BomMaterialMode)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value) => getBomMaterialModeLabelTh(value) || "ใช้วัตถุดิบที่มีอยู่"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EXISTING">ใช้วัตถุดิบที่มีอยู่</SelectItem>
                          <SelectItem value="NEW">สร้างวัตถุดิบใหม่</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>แหล่งจัดหาวัตถุดิบ</Label>
                      <Select
                        value={line.sourcing}
                        onValueChange={(v) =>
                          updateBomLine(idx, "sourcing", v as BomMaterialSourcing)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value) => getBomMaterialSourcingLabelTh(value) || "สต๊อกแล้วแบ่งตัด"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STOCK_CUT">สต๊อกแล้วแบ่งตัด</SelectItem>
                          <SelectItem value="JOB_SPECIFIC">สั่งเฉพาะงาน/สินค้านี้</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {line.mode === "EXISTING" && (
                    <div className="space-y-1.5">
                      <Label>{t("material.name")}</Label>
                      <Select
                        value={line.materialId || undefined}
                        onValueChange={(v) => updateBomLine(idx, "materialId", v ?? "")}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("product.selectMaterial")}>
                            {(value) =>
                              getMaterialOptionLabel(materials, value) || t("product.selectMaterial")
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.code} — {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {line.mode === "NEW" && (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-4">
                      <div className="space-y-1">
                        <Label>สร้างวัตถุดิบใหม่</Label>
                        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                          ระบบจะสร้างรหัสวัตถุดิบให้อัตโนมัติ
                        </div>
                        <p className="text-xs text-muted-foreground">
                          รูปแบบตามรหัสบริษัท เช่น WF01-MAT-0001
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>ชื่อวัตถุดิบ *</Label>
                          <Input
                            value={line.newMaterial.name}
                            onChange={(e) => updateNewMaterial(idx, "name", e.target.value)}
                            placeholder="Aluminum 6061 Flat Bar"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>ประเภทวัตถุดิบ</Label>
                          <Input
                            value={line.newMaterial.type}
                            onChange={(e) => updateNewMaterial(idx, "type", e.target.value)}
                            placeholder="ALUMINUM"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Specification</Label>
                          <Input
                            value={line.newMaterial.specification}
                            onChange={(e) => updateNewMaterial(idx, "specification", e.target.value)}
                            placeholder="6061-T6"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>หน่วย</Label>
                          <Select
                            value={line.newMaterial.unit}
                            onValueChange={(v) => updateNewMaterial(idx, "unit", v as MaterialUnit)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {(value) => getMaterialUnitLabelTh(value) || "ชิ้น"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {MATERIAL_UNITS.map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                  {getMaterialUnitLabelTh(unit)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label>ขนาดตั้งต้น</Label>
                          <Input
                            value={line.newMaterial.dimensions}
                            onChange={(e) => updateNewMaterial(idx, "dimensions", e.target.value)}
                            placeholder="25 x 50 x 3000mm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Min Stock</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.newMaterial.minStockQty}
                            onChange={(e) =>
                              updateNewMaterial(idx, "minStockQty", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Unit Cost</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.newMaterial.unitCost ?? ""}
                            onChange={(e) =>
                              updateNewMaterial(idx, "unitCost", e.target.value ? parseFloat(e.target.value) || 0 : null)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-1.5">
                      <Label>{t("product.qtyPerUnit")}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.qtyPerUnit}
                        onChange={(e) =>
                          updateBomLine(idx, "qtyPerUnit", parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label>{t("product.materialSize")}</Label>
                      <Input
                        value={line.materialSize}
                        onChange={(e) => updateBomLine(idx, "materialSize", e.target.value)}
                        placeholder="20x15x60"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("product.materialType")}</Label>
                      <Input
                        value={line.materialType}
                        onChange={(e) => updateBomLine(idx, "materialType", e.target.value)}
                        placeholder="AL6061-T6"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("product.piecesPerStock")}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={line.piecesPerStock || ""}
                        onChange={(e) =>
                          updateBomLine(idx, "piecesPerStock", parseInt(e.target.value) || null)
                        }
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>หมายเหตุ BOM</Label>
                    <Input
                      value={line.notes}
                      onChange={(e) => updateBomLine(idx, "notes", e.target.value)}
                      placeholder="เช่น ใช้แท่งเดียวตัดได้ 24 ชิ้น"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("product.noBom")}
            </p>
          )}
        </Card>

        {/* Images */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("product.images")}</h2>
          </div>

          {/* Existing saved images (edit mode) */}
          {savedImages.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {savedImages.map((img) => (
                <div
                  key={img.id}
                  className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group relative"
                >
                  <img
                    src={img.url}
                    alt={img.caption || ""}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate">
                      {img.caption || ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => deleteSavedImage(img.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending images (not yet uploaded) */}
          {pendingImages.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {pendingImages.map((img, idx) => (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden border border-dashed border-blue-300 dark:border-blue-700 group relative"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.caption || ""}
                    className="w-full h-32 object-cover opacity-80"
                  />
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate">
                      {img.caption || img.file.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removePendingImage(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add image controls */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>{t("product.caption")}</Label>
              <Input
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder={t("product.caption")}
              />
            </div>
            <input
              ref={formFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={addPendingImage}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => formFileInputRef.current?.click()}
              variant="outline"
              size="sm"
            >
              <ImagePlus className="h-4 w-4 mr-1" />
              {t("product.addImage")}
            </Button>
          </div>

          {savedImages.length === 0 && pendingImages.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("product.noImages")}
            </p>
          )}
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
          <Link href="/production/products">
            <Button type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
