/**
 * Tiny CSV builder — no external deps.
 * Handles UTF-8 BOM (for Excel), quote escaping, embedded commas/newlines.
 */

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const lines = [cols.join(",")];
  for (const row of rows) {
    const values = cols.map((c) => escapeCsvValue(row[c]));
    lines.push(values.join(","));
  }
  // Prepend UTF-8 BOM so Excel detects Thai correctly
  return "\uFEFF" + lines.join("\r\n");
}

function escapeCsvValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
