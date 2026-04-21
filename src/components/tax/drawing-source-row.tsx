"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DrawingSource } from "@/lib/validators/billing-nature";

interface DrawingSourceRowProps {
  value: DrawingSource;
  onChange: (v: DrawingSource) => void;
  productCode?: string;
  drawingRevision?: string;
  customerDrawingUrl?: string;
  onProductCodeChange?: (v: string) => void;
  onDrawingRevisionChange?: (v: string) => void;
  onCustomerDrawingUrlChange?: (v: string) => void;
  disabled?: boolean;
  /** Compact layout for inline table row, otherwise full card-style */
  compact?: boolean;
}

const OPTIONS: {
  value: DrawingSource;
  label: string;
  short: string;
}[] = [
  { value: "TENANT_OWNED", label: "แบบเรา (GOODS)", short: "แบบเรา" },
  { value: "CUSTOMER_PROVIDED", label: "แบบลูกค้า (SERVICE)", short: "แบบลูกค้า" },
  { value: "JOINT_DEVELOPMENT", label: "ร่วมพัฒนา", short: "ร่วมพัฒนา" },
];

export function DrawingSourceRow({
  value,
  onChange,
  productCode,
  drawingRevision,
  customerDrawingUrl,
  onProductCodeChange,
  onDrawingRevisionChange,
  onCustomerDrawingUrlChange,
  disabled = false,
  compact = false,
}: DrawingSourceRowProps) {
  const isCustomer = value === "CUSTOMER_PROVIDED";

  return (
    <div className={compact ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
      <div className="space-y-1">
        <Label className="text-xs">ที่มาของแบบ</Label>
        <div className="flex flex-wrap gap-1.5">
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt.value)}
                className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-muted hover:border-muted-foreground/30"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {compact ? opt.short : opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {!isCustomer && (
        <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-2"}>
          <div className="space-y-1">
            <Label className="text-xs">รหัสสินค้า (SKU)</Label>
            <Input
              value={productCode ?? ""}
              onChange={(e) => onProductCodeChange?.(e.target.value)}
              placeholder="เช่น P-001"
              className="h-8 text-sm"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Drawing Rev</Label>
            <Input
              value={drawingRevision ?? ""}
              onChange={(e) => onDrawingRevisionChange?.(e.target.value)}
              placeholder="เช่น REV-A-2026"
              className="h-8 text-sm"
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {isCustomer && (
        <div className="space-y-1">
          <Label className="text-xs">ไฟล์แบบจากลูกค้า (URL)</Label>
          <Input
            value={customerDrawingUrl ?? ""}
            onChange={(e) => onCustomerDrawingUrlChange?.(e.target.value)}
            placeholder="https://..."
            className="h-8 text-sm"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
