"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  DateRangePicker,
  firstOfMonthStr,
  firstOfYearStr,
  todayStr,
} from "@/components/shared/date-range-picker";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { Loader2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

type Nature = "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";

interface ApiResponse {
  range: { from: string; to: string };
  byNature: Array<{
    billingNature: Nature;
    count: number;
    total: number;
    share: number;
  }>;
  monthlyTrend: Array<{
    ym: string;
    GOODS: number;
    MANUFACTURING_SERVICE: number;
    MIXED: number;
  }>;
  grandTotal: number;
  grandCount: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: string;
    billingNature: Nature;
    status: string;
    totalAmount: number;
    customerName: string;
    customerCode: string;
  }>;
}

const NATURE_LABEL: Record<Nature, string> = {
  GOODS: "ขายสินค้า",
  MANUFACTURING_SERVICE: "รับจ้างทำของ",
  MIXED: "ผสม",
};

const NATURE_COLOR: Record<Nature, string> = {
  GOODS: "#3b82f6",
  MANUFACTURING_SERVICE: "#f59e0b",
  MIXED: "#8b5cf6",
};

function formatAmount(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function RevenueByNatureClient() {
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
          `/api/finance/reports/revenue-by-nature?from=${from}&to=${to}`
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

  const pieData = data?.byNature.map((n) => ({
    name: NATURE_LABEL[n.billingNature],
    value: n.total,
    nature: n.billingNature,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">
          รายงานรายได้ตามประเภทการขาย
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          แยกรายได้ตาม Billing Nature — ไม่รวมเอกสาร Draft / Cancelled
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
          {/* KPI */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">รายได้รวม</div>
              <div className="text-xl font-semibold font-mono mt-1">
                {formatAmount(data.grandTotal)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {data.grandCount} ใบ
              </div>
            </Card>
            {data.byNature.map((n) => (
              <Card key={n.billingNature} className="p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: NATURE_COLOR[n.billingNature] }}
                  />
                  <div className="text-xs text-muted-foreground">
                    {NATURE_LABEL[n.billingNature]}
                  </div>
                </div>
                <div className="text-lg font-semibold font-mono mt-1">
                  {formatAmount(n.total)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {n.count} ใบ · {n.share}%
                </div>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3 text-sm">สัดส่วนรายได้</h3>
              {pieData && pieData.some((p) => p.value > 0) ? (
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
                            key={p.nature}
                            fill={NATURE_COLOR[p.nature]}
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
              <h3 className="font-semibold mb-3 text-sm">แนวโน้มรายเดือน</h3>
              {data.monthlyTrend.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="ym" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: unknown) => formatAmount(Number(v))}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="GOODS"
                        stackId="a"
                        fill={NATURE_COLOR.GOODS}
                        name={NATURE_LABEL.GOODS}
                      />
                      <Bar
                        dataKey="MANUFACTURING_SERVICE"
                        stackId="a"
                        fill={NATURE_COLOR.MANUFACTURING_SERVICE}
                        name={NATURE_LABEL.MANUFACTURING_SERVICE}
                      />
                      <Bar
                        dataKey="MIXED"
                        stackId="a"
                        fill={NATURE_COLOR.MIXED}
                        name={NATURE_LABEL.MIXED}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  ไม่มีข้อมูล
                </div>
              )}
            </Card>
          </div>

          {/* Drill-down */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">
                รายละเอียดใบแจ้งหนี้ ({data.invoices.length} ใบ)
              </h3>
              <CsvExportButton
                rows={data.invoices}
                filename={`revenue-by-nature-${from}-${to}`}
                columns={[
                  { key: "invoiceNumber", header: "เลขที่ใบแจ้งหนี้" },
                  {
                    key: "issueDate",
                    header: "วันที่",
                    format: (v) => formatDate(String(v)),
                  },
                  { key: "customerCode", header: "รหัสลูกค้า" },
                  { key: "customerName", header: "ชื่อลูกค้า" },
                  {
                    key: "billingNature",
                    header: "ประเภท",
                    format: (v) => NATURE_LABEL[v as Nature] ?? String(v),
                  },
                  { key: "status", header: "สถานะ" },
                  {
                    key: "totalAmount",
                    header: "ยอด (บาท)",
                    format: (v) => formatAmount(Number(v)),
                  },
                ]}
              />
            </div>
            {data.invoices.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                ไม่มีข้อมูล
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-2">เลขที่</th>
                      <th className="text-left py-2 px-2">วันที่</th>
                      <th className="text-left py-2 px-2">ลูกค้า</th>
                      <th className="text-left py-2 px-2">ประเภท</th>
                      <th className="text-left py-2 px-2">สถานะ</th>
                      <th className="text-right py-2 px-2">ยอด (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b hover:bg-muted/40">
                        <td className="py-2 px-2 font-mono">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2 px-2">
                          {formatDate(inv.issueDate)}
                        </td>
                        <td className="py-2 px-2">
                          <div>{inv.customerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {inv.customerCode}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs"
                            style={{ color: NATURE_COLOR[inv.billingNature] }}
                          >
                            {NATURE_LABEL[inv.billingNature]}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs">{inv.status}</td>
                        <td className="py-2 px-2 text-right font-mono">
                          {formatAmount(inv.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
