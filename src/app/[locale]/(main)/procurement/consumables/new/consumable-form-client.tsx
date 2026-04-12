"use client";

import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
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

const CATEGORIES = [
  "CUTTING_TOOL",
  "COOLANT",
  "ABRASIVE",
  "MEASURING",
  "SAFETY",
  "OTHER",
] as const;

export function ConsumableFormClient() {
  const t = useTranslations("consumable");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [brand, setBrand] = useState("");
  const [specification, setSpecification] = useState("");
  const [unit, setUnit] = useState("PCS");
  const [stockQty, setStockQty] = useState(0);
  const [minStockQty, setMinStockQty] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !name.trim()) {
      setError("Code and name are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/procurement/consumables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          category,
          brand: brand.trim() || null,
          specification: specification.trim() || null,
          unit: unit.trim() || "PCS",
          stockQty,
          minStockQty,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }

      router.push("/procurement/consumables");
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
        <Link href="/procurement/consumables">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">{t("new")}</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("code")} *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("code")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("name")} *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("name")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("category")}</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v ?? "OTHER")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("category")} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`categoryLabel.${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("brand")}</Label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={t("brand")}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("specification")}</Label>
              <Input
                value={specification}
                onChange={(e) => setSpecification(e.target.value)}
                placeholder={t("specification")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("unit")}</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="PCS"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("stock")}</Label>
              <Input
                type="number"
                value={stockQty}
                onChange={(e) => setStockQty(Number(e.target.value))}
                min={0}
                step="any"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("minStock")}</Label>
              <Input
                type="number"
                value={minStockQty}
                onChange={(e) => setMinStockQty(Number(e.target.value))}
                min={0}
                step="any"
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
            {tCommon("save")}
          </Button>
          <Link href="/procurement/consumables">
            <Button type="button" variant="outline">
              {tCommon("cancel")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
