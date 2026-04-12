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

interface Consumable {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string | null;
  specification: string | null;
  unit: string;
  lastPrice: string | number | null;
  lastSupplier: string | null;
  lastPurchaseDate: string | null;
  stockQty: string | number;
  minStockQty: string | number;
}

export function ConsumableDetailClient({
  consumable,
}: {
  consumable: Consumable;
}) {
  const t = useTranslations("consumable");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [code, setCode] = useState(consumable.code);
  const [name, setName] = useState(consumable.name);
  const [category, setCategory] = useState(consumable.category);
  const [brand, setBrand] = useState(consumable.brand || "");
  const [specification, setSpecification] = useState(
    consumable.specification || ""
  );
  const [unit, setUnit] = useState(consumable.unit);
  const [stockQty, setStockQty] = useState(Number(consumable.stockQty));
  const [minStockQty, setMinStockQty] = useState(
    Number(consumable.minStockQty)
  );

  const formatPrice = (val: string | number | null) => {
    if (val === null || val === undefined) return "\u2014";
    return Number(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (d: string | null) => {
    if (!d) return "\u2014";
    return new Date(d).toLocaleDateString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/procurement/consumables/${consumable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          category,
          brand: brand.trim() || null,
          specification: specification.trim() || null,
          unit: unit.trim(),
          stockQty,
          minStockQty,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/procurement/consumables">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {consumable.code} — {consumable.name}
        </h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl p-3 text-sm">
          Updated successfully
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("code")}</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("category")}</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v ?? consumable.category)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
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
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("specification")}</Label>
              <Input
                value={specification}
                onChange={(e) => setSpecification(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("unit")}</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
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

        {/* Purchase Info (read-only, auto-updated from PO) */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            {t("lastPurchaseDate")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("lastPrice")}</Label>
              <div className="font-mono text-sm bg-muted/50 rounded-xl px-3 py-2">
                {formatPrice(consumable.lastPrice)}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("lastSupplier")}</Label>
              <div className="text-sm bg-muted/50 rounded-xl px-3 py-2">
                {consumable.lastSupplier || "\u2014"}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("lastPurchaseDate")}</Label>
              <div className="text-sm bg-muted/50 rounded-xl px-3 py-2">
                {formatDate(consumable.lastPurchaseDate)}
              </div>
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
