"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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
import { useState, useCallback } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitCost: string | null;
}

interface Consumable {
  id: string;
  code: string;
  name: string;
  unit: string;
  lastPrice: string | null;
}

type LineType = "MATERIAL" | "CONSUMABLE" | "OTHER";

interface POLineInput {
  lineType: LineType;
  materialId: string;
  consumableId: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  notes: string;
}

const emptyLine = (): POLineInput => ({
  lineType: "OTHER",
  materialId: "",
  consumableId: "",
  description: "",
  quantity: 1,
  unit: "PCS",
  unitCost: 0,
  notes: "",
});

export function POFormClient({
  materials,
  consumables,
}: {
  materials: Material[];
  consumables: Consumable[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLineInput[]>([emptyLine()]);

  const formatCurrency = (val: number) =>
    Number(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const updateLine = (index: number, field: keyof POLineInput, value: unknown) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineTypeChange = (index: number, lineType: LineType) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        lineType,
        materialId: "",
        consumableId: "",
        description: lineType === "OTHER" ? updated[index].description : "",
        unit: "PCS",
        unitCost: 0,
      };
      return updated;
    });
  };

  const handleMaterialChange = (index: number, materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        materialId,
        consumableId: "",
        description: material ? material.name : updated[index].description,
        unit: material ? material.unit : updated[index].unit,
        unitCost: material && material.unitCost
          ? Number(material.unitCost)
          : updated[index].unitCost,
      };
      return updated;
    });
  };

  const handleConsumableChange = (index: number, consumableId: string) => {
    const consumable = consumables.find((c) => c.id === consumableId);
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        consumableId,
        materialId: "",
        description: consumable ? consumable.name : updated[index].description,
        unit: consumable ? consumable.unit : updated[index].unit,
        unitCost: consumable && consumable.lastPrice
          ? Number(consumable.lastPrice)
          : updated[index].unitCost,
      };
      return updated;
    });
  };

  const calculateLineTotal = useCallback((line: POLineInput) => {
    const qty = Number(line.quantity) || 0;
    const cost = Number(line.unitCost) || 0;
    return Math.round(qty * cost * 100) / 100;
  }, []);

  const totalAmount = lines.reduce(
    (sum, line) => sum + calculateLineTotal(line),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      setError(t("purchaseOrder.validation.supplierRequired"));
      return;
    }

    if (lines.length === 0) {
      setError(t("purchaseOrder.validation.linesRequired"));
      return;
    }

    // Validate all lines have description
    const invalidLine = lines.find((l) => !l.description.trim());
    if (invalidLine) {
      setError(t("purchaseOrder.validation.descriptionRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        supplierName: supplierName.trim(),
        supplierContact: supplierContact.trim() || null,
        expectedDate: expectedDate || null,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({
          lineType: line.lineType,
          materialId: line.lineType === "MATERIAL" && line.materialId ? line.materialId : null,
          consumableId: line.lineType === "CONSUMABLE" && line.consumableId ? line.consumableId : null,
          description: line.description,
          quantity: Number(line.quantity),
          unit: line.unit,
          unitCost: Number(line.unitCost),
          notes: line.notes || null,
        })),
      };

      const res = await fetch("/api/procurement/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }

      const result = await res.json();
      router.push(`/procurement/purchase-orders/${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/procurement/purchase-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {t("purchaseOrder.new")}
        </h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Supplier Info */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">{t("purchaseOrder.supplierInfo")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("purchaseOrder.supplierName")} *</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("purchaseOrder.supplierContact")}</Label>
              <Input
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("purchaseOrder.expectedDate")}</Label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Line Items */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("purchaseOrder.lines")}</h2>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              {t("purchaseOrder.addLine")}
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("purchaseOrder.noLines")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="min-w-[130px]">
                      {t("purchaseOrder.lineType")}
                    </TableHead>
                    <TableHead className="min-w-[180px]">
                      {t("purchaseOrder.material")}
                    </TableHead>
                    <TableHead className="min-w-[150px]">
                      {t("purchaseOrder.description")}
                    </TableHead>
                    <TableHead className="w-24">
                      {t("purchaseOrder.quantity")}
                    </TableHead>
                    <TableHead className="w-24">
                      {t("purchaseOrder.unit")}
                    </TableHead>
                    <TableHead className="w-28">
                      {t("purchaseOrder.unitCost")}
                    </TableHead>
                    <TableHead className="w-32">
                      {t("purchaseOrder.lineTotal")}
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => {
                    const lineTotal = calculateLineTotal(line);

                    return (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>

                        {/* Line Type Select */}
                        <TableCell>
                          <Select
                            value={line.lineType}
                            onValueChange={(v) =>
                              handleLineTypeChange(index, (v ?? "OTHER") as LineType)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MATERIAL">
                                {t("purchaseOrder.lineTypeMaterial")}
                              </SelectItem>
                              <SelectItem value="CONSUMABLE">
                                {t("purchaseOrder.lineTypeConsumable")}
                              </SelectItem>
                              <SelectItem value="OTHER">
                                {t("purchaseOrder.lineTypeOther")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Material / Consumable / Other selector */}
                        <TableCell>
                          {line.lineType === "MATERIAL" && (
                            <Select
                              value={line.materialId}
                              onValueChange={(v) =>
                                handleMaterialChange(index, v ?? "")
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue
                                  placeholder={t("purchaseOrder.selectMaterial")}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {materials.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.code} - {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {line.lineType === "CONSUMABLE" && (
                            <Select
                              value={line.consumableId}
                              onValueChange={(v) =>
                                handleConsumableChange(index, v ?? "")
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue
                                  placeholder={t("purchaseOrder.selectConsumable")}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {consumables.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.code} - {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {line.lineType === "OTHER" && (
                            <span className="text-xs text-muted-foreground">
                              {t("purchaseOrder.lineTypeOther")}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Input
                            value={line.description}
                            onChange={(e) =>
                              updateLine(index, "description", e.target.value)
                            }
                            placeholder={t("purchaseOrder.description")}
                            className="min-w-[120px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(
                                index,
                                "quantity",
                                Number(e.target.value)
                              )
                            }
                            min={0.0001}
                            step="any"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.unit}
                            onChange={(e) =>
                              updateLine(index, "unit", e.target.value)
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.unitCost}
                            onChange={(e) =>
                              updateLine(
                                index,
                                "unitCost",
                                Number(e.target.value)
                              )
                            }
                            min={0}
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {formatCurrency(lineTotal)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {lines.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(index)}
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
        </Card>

        {/* Total Summary */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">{t("purchaseOrder.totalAmount")}</h2>
          <div className="max-w-sm ml-auto">
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span>{t("purchaseOrder.totalAmount")}</span>
              <span className="font-mono">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label>{t("common.notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
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
          <Link href="/procurement/purchase-orders">
            <Button type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
