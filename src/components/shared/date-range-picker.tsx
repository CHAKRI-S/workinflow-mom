"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Controlled date-range picker (YYYY-MM-DD strings, native inputs).
 * Designed for report filters — no external date library dependency.
 */
export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  onPresetThisMonth,
  onPresetThisYear,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onPresetThisMonth?: () => void;
  onPresetThisYear?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">จากวันที่</label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-[160px]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">ถึงวันที่</label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-[160px]"
        />
      </div>
      {onPresetThisMonth && (
        <Button variant="outline" size="sm" onClick={onPresetThisMonth}>
          เดือนนี้
        </Button>
      )}
      {onPresetThisYear && (
        <Button variant="outline" size="sm" onClick={onPresetThisYear}>
          ปีนี้
        </Button>
      )}
    </div>
  );
}

/** Today formatted YYYY-MM-DD in local time */
export function todayStr(): string {
  const d = new Date();
  return isoLocal(d);
}

/** First day of current month */
export function firstOfMonthStr(): string {
  const d = new Date();
  return isoLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** First day of current year */
export function firstOfYearStr(): string {
  const d = new Date();
  return isoLocal(new Date(d.getFullYear(), 0, 1));
}

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
