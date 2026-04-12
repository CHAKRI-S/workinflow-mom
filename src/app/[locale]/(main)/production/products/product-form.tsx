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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useRef, useCallback } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2, ImagePlus } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface MaterialOption {
  id: string;
  code: string;
  name: string;
  unit: string;
}

interface BomFormLine {
  materialId: string;
  qtyPerUnit: number;
  materialSize: string;
  materialType: string;
  piecesPerStock: number | null;
  notes: string;
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
  sortOrder: number;
  material: { id: string; code: string; name: string; unit: string };
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
      materialId: l.materialId,
      qtyPerUnit: Number(l.qtyPerUnit),
      materialSize: l.materialSize || "",
      materialType: l.materialType || "",
      piecesPerStock: l.piecesPerStock || null,
      notes: l.notes || "",
      sortOrder: l.sortOrder,
    }))
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      requiresPainting: false,
      requiresLogoEngraving: false,
      leadTimeDays: 0,
      ...defaultValues,
    },
  });

  const addBomLine = () => {
    setBomLines((prev) => [
      ...prev,
      { materialId: "", qtyPerUnit: 1, materialSize: "", materialType: "", piecesPerStock: null, notes: "", sortOrder: prev.length },
    ]);
  };

  const removeBomLine = (idx: number) => {
    setBomLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBomLine = (idx: number, field: keyof BomFormLine, value: string | number | null) => {
    setBomLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const onSubmit = async (data: ProductCreateInput) => {
    setLoading(true);
    setError(null);

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

      // Save BOM if there are lines
      if (productId && bomLines.length > 0) {
        const validLines = bomLines.filter((l) => l.materialId);
        if (validLines.length > 0) {
          const bomRes = await fetch(`/api/production/products/${productId}/bom`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lines: validLines }),
          });
          if (!bomRes.ok) {
            throw new Error("Product saved but BOM failed to save");
          }
        }
      } else if (productId && isEdit && bomLines.length === 0) {
        // Clear BOM if all lines removed
        await fetch(`/api/production/products/${productId}/bom`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: [] }),
        });
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
            <div className="space-y-1.5">
              <Label>{t("product.code")} *</Label>
              <Input
                {...register("code")}
                disabled={isEdit}
                placeholder="PRD-00001"
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.name")} *</Label>
              <Input {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.category")}</Label>
              <Input {...register("category")} placeholder="Bracket, Cover, Adapter..." />
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
          <h2 className="font-semibold">{t("product.fusionFile")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="space-y-1.5">
              <Label>{t("product.defaultColor")}</Label>
              <Input {...register("defaultColor")} placeholder="Black Anodize" />
            </div>

            <div className="space-y-1.5">
              <Label>{t("product.defaultSurfaceFinish")}</Label>
              <Input {...register("defaultSurfaceFinish")} placeholder="Bead Blast, Polish..." />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t("material.name")}</TableHead>
                    <TableHead className="w-24">{t("product.qtyPerUnit")}</TableHead>
                    <TableHead>{t("product.materialSize")}</TableHead>
                    <TableHead>{t("product.materialType")}</TableHead>
                    <TableHead className="w-24">{t("product.piecesPerStock")}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bomLines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <Select
                          value={line.materialId || undefined}
                          onValueChange={(v) => updateBomLine(idx, "materialId", v ?? "")}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("product.selectMaterial")} />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.code} — {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.qtyPerUnit}
                          onChange={(e) =>
                            updateBomLine(idx, "qtyPerUnit", parseFloat(e.target.value) || 0)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.materialSize}
                          onChange={(e) => updateBomLine(idx, "materialSize", e.target.value)}
                          placeholder="20x15x60"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.materialType}
                          onChange={(e) => updateBomLine(idx, "materialType", e.target.value)}
                          placeholder="AL6061-T6"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={line.piecesPerStock || ""}
                          onChange={(e) => updateBomLine(idx, "piecesPerStock", parseInt(e.target.value) || null)}
                          placeholder="1"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeBomLine(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
