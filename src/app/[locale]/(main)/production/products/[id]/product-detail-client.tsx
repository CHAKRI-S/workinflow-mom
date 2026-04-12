"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ArrowLeft,
  Edit,
  Paintbrush,
  Stamp,
  Plus,
  Trash2,
  Save,
  Loader2,
  ImagePlus,
  X,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";

interface BomLine {
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

interface ProductImage {
  id: string;
  productId: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  fusionFileName: string | null;
  fusionFileUrl: string | null;
  requiresPainting: boolean;
  requiresLogoEngraving: boolean;
  defaultColor: string | null;
  defaultSurfaceFinish: string | null;
  unitPrice: string | number | null;
  leadTimeDays: number;
  cycleTimeMinutes: string | number | null;
  bomLines: BomLine[];
  images: ProductImage[];
}

interface Material {
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

export function ProductDetailClient({
  product,
  materials,
}: {
  product: Product;
  materials: Material[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [bomLines, setBomLines] = useState<BomFormLine[]>(
    product.bomLines.map((l) => ({
      materialId: l.materialId,
      qtyPerUnit: Number(l.qtyPerUnit),
      materialSize: l.materialSize || "",
      materialType: l.materialType || "",
      piecesPerStock: l.piecesPerStock || null,
      notes: l.notes || "",
      sortOrder: l.sortOrder,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [bomDirty, setBomDirty] = useState(false);

  // Image state
  const [images, setImages] = useState<ProductImage[]>(product.images || []);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [showAddImage, setShowAddImage] = useState(false);
  const [viewImage, setViewImage] = useState<ProductImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addBomLine = () => {
    setBomLines((prev) => [
      ...prev,
      { materialId: "", qtyPerUnit: 1, materialSize: "", materialType: "", piecesPerStock: null, notes: "", sortOrder: prev.length },
    ]);
    setBomDirty(true);
  };

  const removeBomLine = (idx: number) => {
    setBomLines((prev) => prev.filter((_, i) => i !== idx));
    setBomDirty(true);
  };

  const updateBomLine = (idx: number, field: keyof BomFormLine, value: string | number | null) => {
    setBomLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
    setBomDirty(true);
  };

  const saveBom = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/production/products/${product.id}/bom`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: bomLines }),
      });
      if (!res.ok) throw new Error("Failed to save BOM");
      setBomDirty(false);
      router.refresh();
    } catch {
      alert("Failed to save BOM");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      // Upload file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "products");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();

      // Create image record
      const imgRes = await fetch(`/api/production/products/${product.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, caption: caption || undefined }),
      });
      if (!imgRes.ok) throw new Error("Failed to save image");
      const newImage = await imgRes.json();
      setImages((prev) => [...prev, newImage]);
      setCaption("");
      setShowAddImage(false);
    } catch {
      alert("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }, [product.id, caption]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [handleImageUpload]);

  const deleteImage = async (imageId: string) => {
    try {
      const res = await fetch(`/api/production/products/${product.id}/images/${imageId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch {
      alert("Failed to delete image");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/production/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{product.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">
              {product.code}
            </p>
          </div>
        </div>
        <Link href={`/production/products/${product.id}/edit`}>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-1" />
            {t("common.edit")}
          </Button>
        </Link>
      </div>

      {/* Product Details */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t("product.category")}</p>
            <p className="font-medium">{product.category || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("product.unitPrice")}</p>
            <p className="font-medium">
              {product.unitPrice
                ? `${Number(product.unitPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("product.leadTimeDays")}</p>
            <p className="font-medium">{product.leadTimeDays} {t("product.days")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("product.cycleTime")}</p>
            <p className="font-medium">
              {product.cycleTimeMinutes ? `${Number(product.cycleTimeMinutes)} ${t("product.minutesShort")}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("product.fusionFile")}</p>
            <p className="font-medium">{product.fusionFileName || "—"}</p>
          </div>
          <div className="col-span-2 flex gap-2">
            {product.requiresPainting && (
              <Badge variant="secondary" className="gap-1">
                <Paintbrush className="h-3 w-3" />
                {t("product.requiresPainting")}
              </Badge>
            )}
            {product.requiresLogoEngraving && (
              <Badge variant="secondary" className="gap-1">
                <Stamp className="h-3 w-3" />
                {t("product.requiresLogo")}
              </Badge>
            )}
            {product.defaultColor && (
              <Badge variant="outline">{product.defaultColor}</Badge>
            )}
            {product.defaultSurfaceFinish && (
              <Badge variant="outline">{product.defaultSurfaceFinish}</Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Images */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{t("product.images")}</h2>
          <Button
            onClick={() => setShowAddImage(!showAddImage)}
            variant="outline"
            size="sm"
          >
            <ImagePlus className="h-4 w-4 mr-1" />
            {t("product.addImage")}
          </Button>
        </div>

        {/* Add image form */}
        {showAddImage && (
          <div className="flex items-end gap-3 p-3 bg-muted/50 rounded-xl">
            <div className="flex-1 space-y-1.5">
              <Label>{t("product.caption")}</Label>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t("product.caption")}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              size="sm"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {uploading ? t("common.loading") : t("product.addImage")}
            </Button>
          </div>
        )}

        {images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((img) => (
              <div
                key={img.id}
                className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group relative"
              >
                <button
                  type="button"
                  className="w-full cursor-pointer"
                  onClick={() => setViewImage(img)}
                >
                  <img
                    src={img.url}
                    alt={img.caption || ""}
                    className="w-full h-40 object-cover"
                  />
                </button>
                <div className="p-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">
                    {img.caption || ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteImage(img.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t("product.noImages")}
          </div>
        )}
      </Card>

      {/* Full-size image overlay */}
      {viewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewImage(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setViewImage(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={viewImage.url}
            alt={viewImage.caption || ""}
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          {viewImage.caption && (
            <p className="absolute bottom-8 text-white text-sm bg-black/50 px-4 py-2 rounded-lg">
              {viewImage.caption}
            </p>
          )}
        </div>
      )}

      {/* BOM Editor */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{t("product.bom")}</h2>
          <div className="flex gap-2">
            {bomDirty && (
              <Button onClick={saveBom} disabled={saving} size="sm">
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {t("common.save")}
              </Button>
            )}
            <Button onClick={addBomLine} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t("product.addMaterial")}
            </Button>
          </div>
        </div>

        {bomLines.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>{t("material.name")}</TableHead>
                <TableHead className="w-32">{t("product.qtyPerUnit")}</TableHead>
                <TableHead>{t("product.materialSize")}</TableHead>
                <TableHead>{t("product.materialType")}</TableHead>
                <TableHead className="w-28">{t("product.piecesPerStock")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomLines.map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <Select
                      value={line.materialId}
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
                      placeholder="Ø50 x 100mm"
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
                    <Input
                      value={line.notes}
                      onChange={(e) => updateBomLine(idx, "notes", e.target.value)}
                      placeholder={t("common.notes")}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeBomLine(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t("product.noBom")}
          </div>
        )}
      </Card>
    </div>
  );
}
