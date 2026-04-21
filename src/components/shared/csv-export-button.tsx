"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

/**
 * Client-side CSV download button.
 * Takes rows (array of plain objects) + column definitions and triggers a
 * blob download of the CSV. No backend round-trip needed.
 */
export function CsvExportButton<T extends Record<string, unknown>>({
  rows,
  columns,
  filename,
  label = "Export CSV",
  disabled,
}: {
  rows: T[];
  columns: Array<{
    key: keyof T | string;
    header: string;
    /** Optional formatter — by default calls String() */
    format?: (value: unknown, row: T) => string;
  }>;
  filename: string;
  label?: string;
  disabled?: boolean;
}) {
  const handle = () => {
    const csv = buildCsv(rows, columns);
    // Prepend BOM so Excel reads UTF-8 Thai correctly
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handle}
      disabled={disabled || rows.length === 0}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function buildCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{
    key: keyof T | string;
    header: string;
    format?: (value: unknown, row: T) => string;
  }>
): string {
  const headerRow = columns.map((c) => escape(c.header)).join(",");
  const dataRows = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key as keyof T];
        const formatted = c.format ? c.format(raw, row) : stringify(raw);
        return escape(formatted);
      })
      .join(",")
  );
  return [headerRow, ...dataRows].join("\r\n");
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function escape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
