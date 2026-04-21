"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Info, Package, Wrench, Layers } from "lucide-react";
import type { BillingNature } from "@/lib/validators/billing-nature";

interface BillingNaturePickerProps {
  value: BillingNature;
  suggestion?: BillingNature; // auto-suggested from lines
  onChange: (v: BillingNature) => void;
  /**
   * If true shows a compact header without the explanatory callout.
   * Use `false` on create forms (user needs the info), `true` on edit forms where space is tight.
   */
  compact?: boolean;
  disabled?: boolean;
}

const OPTIONS: {
  value: BillingNature;
  label: string;
  description: string;
  icon: typeof Package;
}[] = [
  {
    value: "GOODS",
    label: "ขายสินค้า",
    description: "ผลิตตามแบบ/catalog ของเรา — ไม่หัก ณ ที่จ่าย",
    icon: Package,
  },
  {
    value: "MANUFACTURING_SERVICE",
    label: "รับจ้างทำของ",
    description: "ลูกค้าเอาแบบมา — ลูกค้าหัก 3% (ม.3 เตรส)",
    icon: Wrench,
  },
  {
    value: "MIXED",
    label: "ผสม",
    description: "ส่วนสินค้า + ส่วนบริการ — ระบุ nature ต่อ line",
    icon: Layers,
  },
];

export function BillingNaturePicker({
  value,
  suggestion,
  onChange,
  compact = false,
  disabled = false,
}: BillingNaturePickerProps) {
  const isOverride = suggestion && suggestion !== value;
  const isDefault = value === "GOODS";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="font-semibold">นโยบายภาษีเอกสารนี้</Label>
        {isDefault ? (
          <Badge variant="outline" className="border-green-500/50 text-green-700">
            ขายสินค้า (default)
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-500/50 text-amber-700">
            พิเศษ
          </Badge>
        )}
        {isOverride && (
          <Badge variant="outline" className="border-blue-500/50 text-blue-700">
            auto-suggest: {OPTIONS.find((o) => o.value === suggestion)?.label}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`text-left p-3 rounded-xl border-2 transition-colors ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/30"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{opt.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      {!compact && (
        <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-xs text-muted-foreground">
          <Info className="h-4 w-4 flex-shrink-0 text-blue-600 mt-0.5" />
          <p>
            Default = ขายสินค้า (OEM goods) เพราะถ้าเราออกแบบ + ใช้วัสดุ + tooling ของเรา
            ถือเป็นขายสินค้าตามคำพิพากษา ฎ.2776/2532 และ ฎ.3849/2546
            (การติดโลโก้ลูกค้าไม่เปลี่ยน nature)
          </p>
        </div>
      )}
    </Card>
  );
}
