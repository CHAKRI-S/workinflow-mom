"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  DateRangePicker,
  firstOfYearStr,
  todayStr,
  firstOfMonthStr,
} from "@/components/shared/date-range-picker";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type Source = "TENANT_OWNED" | "CUSTOMER_PROVIDED" | "JOINT_DEVELOPMENT";

interface ApiResponse {
  range: { from: string; to: string };
  byDrawing: Array<{
    drawingSource: Source;
    lineCount: number;
    invoiceCount: number;
    revenue: number;
    share: number;
  }>;
  grandTotal: { lineCount: number; revenue: number };
  topCustomersByCustomerDrawing: Array<{
    customerId: string;
    code: string;
    name: string;
    revenue: number;
  }>;
}

const SOURCE_LABEL: Record<Source, string> = {
  TENANT_OWNED: "ออกแบบเอง",
  CUSTOMER_PROVIDED: "ลูกค้าส่งแบบ",
  JOINT_DEVELOPMENT: "ร่วมพัฒนา",
};

const SOURCE_COLOR: Record<Source, string> = {
  TENANT_OWNED: "#10b981",
  CUSTOMER_PROVIDED: "#ef4444",
  JOINT_DEVELOPMENT: "#f59e0b",
};

const SOURCE_DESC: Record<Source, string> = {
  TENANT_OWNED: "→ โดยปกติตีเป็น GOODS (ขายสินค้า) ความเสี่ยง WHT ต่ำ",
  CUSTOMER_PROVIDED:
    "→ โดยปกติตีเป็น MANUFACTURING_SERVICE (รับจ้างทำของ) ความเสี่ยง WHT สูง",
  JOINT_DEVELOPMENT: "→ grey area — ต้องดู contract term ว่าใครเป็นเจ้าของ IP",
};

function formatAmount(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function DrawingSourceMixClient() {
  const [from, setFrom] = useState(firstOfYearStr());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/finance/reports/drawing-source-mix?from=${from}&to=${to}`
        );
        if (res.ok && !cancelled) setData(await res.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const customerProvidedShare =
    data?.byDrawing.find((d) => d.drawingSource === "CUSTOMER_PROVIDED")?.share ?? 0;
  const showDriftWarning = customerProvidedShare >= 30;

  const pieData = data?.byDrawing
    .filter((d) => d.revenue > 0)
    .map((d) => ({
      name: SOURCE_LABEL[d.drawingSource],
      value: d.revenue,
      source: d.drawingSource,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">
          รายงานแหล่งที่มาของแบบงาน
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          สัดส่วนรายได้แยกตาม Drawing Source — ตรวจสอบการ drift จาก OEM Goods ไปทาง Contract Manufacturing
        </p>
      </div>

      <Card className="p-4">
        <DateRangePicker
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onPresetThisMonth={() => {
            setFrom(firstOfMonthStr());
            setTo(todayStr());
          }}
          onPresetThisYear={() => {
            setFrom(firstOfYearStr());
            setTo(todayStr());
          }}
        />
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          ไม่สามารถโหลดข้อมูลได้
        </Card>
      ) : (
        <>
          {showDriftWarning && (
            <Card className="p-4 border-amber-500/40 bg-amber-50/60 dark:bg-amber-900/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-900 dark:text-amber-300">
                    เตือน: งาน &quot;ลูกค้าส่งแบบ&quot; มีสัดส่วน{" "}
                    {customerProvidedShare}% ของรายได้
                  </div>
                  <div className="text-xs text-amber-800 dark:text-amber-300/80 mt-1 leading-relaxed">
                    สูงกว่า 30% แปลว่าธุรกิจกำลัง drift ไปทาง Contract
                    Manufacturing — ควรพิจารณาว่าจะปรับ billing nature ใน
                    invoice เหล่านี้เป็น MANUFACTURING_SERVICE หรือไม่ และ
                    เตรียมรับ WHT 3% ตาม ม.3 เตรส
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* KPI cards per source */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.byDrawing.map((d) => (
              <Card key={d.drawingSource} className="p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SOURCE_COLOR[d.drawingSource] }}
                  />
                  <div className="text-sm font-semibold">
                    {SOURCE_LABEL[d.drawingSource]}
                  </div>
                </div>
                <div className="text-xl font-semibold font-mono mt-1">
                  {formatAmount(d.revenue)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {d.share}% · {d.lineCount} บรรทัด · {d.invoiceCount} ใบ
                </div>
                <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {SOURCE_DESC[d.drawingSource]}
                </div>
              </Card>
            ))}
          </div>

          {/* Chart + table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3 text-sm">
                สัดส่วนรายได้ตามแหล่งแบบ
              </h3>
              {pieData && pieData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                        label={(entry) => {
                          const e = entry as unknown as { name: string };
                          return e.name;
                        }}
                      >
                        {pieData.map((p) => (
                          <Cell
                            key={p.source}
                            fill={SOURCE_COLOR[p.source]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: unknown) => formatAmount(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  ไม่มีข้อมูล
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3 text-sm">
                Top ลูกค้าที่ส่งแบบมาเอง (CUSTOMER_PROVIDED)
              </h3>
              {data.topCustomersByCustomerDrawing.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  ไม่มีลูกค้าที่ส่งแบบมา
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">ลูกค้า</th>
                        <th className="text-right py-2 px-2">รายได้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCustomersByCustomerDrawing.map((c) => (
                        <tr
                          key={c.customerId}
                          className="border-b last:border-0 hover:bg-muted/40"
                        >
                          <td className="py-2 px-2">
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.code}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-mono">
                            {formatAmount(c.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">สรุปข้อมูล</h3>
              <CsvExportButton
                rows={data.byDrawing}
                filename={`drawing-source-mix-${from}-${to}`}
                columns={[
                  {
                    key: "drawingSource",
                    header: "แหล่งแบบ",
                    format: (v) => SOURCE_LABEL[v as Source] ?? String(v),
                  },
                  { key: "lineCount", header: "จำนวนบรรทัด" },
                  { key: "invoiceCount", header: "จำนวนใบแจ้งหนี้" },
                  {
                    key: "revenue",
                    header: "รายได้",
                    format: (v) => formatAmount(Number(v)),
                  },
                  {
                    key: "share",
                    header: "% สัดส่วน",
                    format: (v) => `${v}%`,
                  },
                ]}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              รวมทั้งหมด {data.grandTotal.lineCount} บรรทัด · รายได้{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatAmount(data.grandTotal.revenue)}
              </span>{" "}
              บาท
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
