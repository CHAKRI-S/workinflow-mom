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
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ApiResponse {
  range: { from: string; to: string };
  totals: {
    count: number;
    totalGross: number;
    totalNet: number;
    totalWht: number;
  };
  byMonth: Array<{ ym: string; count: number; totalWht: number }>;
  byStatus: Record<string, { count: number; totalWht: number }>;
  entries: Array<{
    id: string;
    receiptNumber: string;
    issueDate: string;
    invoiceNumber: string | null;
    customerName: string;
    customerCode: string;
    payerTaxId: string | null;
    grossAmount: number;
    whtRate: number;
    whtAmount: number;
    netAmount: number;
    whtCertNumber: string | null;
    whtCertReceivedAt: string | null;
    whtCertStatus: string;
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  NOT_APPLICABLE: "ไม่เข้าข่าย",
  PENDING: "รอรับ cert",
  RECEIVED: "ได้รับแล้ว",
  VERIFIED: "ยืนยันแล้ว",
  MISSING_OVERDUE: "ค้างเกินกำหนด",
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

export function WhtCreditLedgerClient() {
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
          `/api/finance/reports/wht-ledger?from=${from}&to=${to}`
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">
          WHT Credit Ledger
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          สรุปยอด WHT ที่ถูกหัก ณ ที่จ่าย — ใช้สำหรับ reconcile กับ ภ.ง.ด.50/51
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
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">จำนวน</div>
              <div className="text-xl font-semibold mt-1">
                {data.totals.count}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">ใบเสร็จ</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">ยอด Gross</div>
              <div className="text-xl font-semibold font-mono mt-1">
                {formatAmount(data.totals.totalGross)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">
                ยอด Net (รับจริง)
              </div>
              <div className="text-xl font-semibold font-mono mt-1">
                {formatAmount(data.totals.totalNet)}
              </div>
            </Card>
            <Card className="p-4 border-blue-500/40 bg-blue-50/40 dark:bg-blue-900/10">
              <div className="text-xs text-blue-700 dark:text-blue-400">
                WHT Credit รวม
              </div>
              <div className="text-xl font-bold font-mono mt-1 text-blue-900 dark:text-blue-300">
                {formatAmount(data.totals.totalWht)}
              </div>
            </Card>
          </div>

          {/* Chart + byStatus */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2">
              <h3 className="font-semibold mb-3 text-sm">WHT รายเดือน</h3>
              {data.byMonth.length > 0 ? (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="ym" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: unknown) => formatAmount(Number(v))}
                      />
                      <Bar
                        dataKey="totalWht"
                        fill="#3b82f6"
                        name="WHT"
                        radius={[4, 4, 0, 0]}
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

            <Card className="p-5">
              <h3 className="font-semibold mb-3 text-sm">สถานะ Cert</h3>
              <div className="space-y-2">
                {Object.entries(data.byStatus).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {STATUS_LABEL[k] ?? k}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {v.count} รายการ
                      </div>
                    </div>
                    <div className="font-mono text-sm">
                      {formatAmount(v.totalWht)}
                    </div>
                  </div>
                ))}
                {Object.keys(data.byStatus).length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    ไม่มีข้อมูล
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Entries */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">
                รายการละเอียด ({data.entries.length} รายการ)
              </h3>
              <CsvExportButton
                rows={data.entries}
                filename={`wht-ledger-${from}-${to}`}
                columns={[
                  { key: "receiptNumber", header: "เลขที่ใบเสร็จ" },
                  {
                    key: "issueDate",
                    header: "วันที่",
                    format: (v) => formatDate(String(v)),
                  },
                  { key: "invoiceNumber", header: "เลขที่ใบแจ้งหนี้" },
                  { key: "customerName", header: "ชื่อลูกค้า" },
                  { key: "payerTaxId", header: "เลขผู้เสียภาษีผู้จ่าย" },
                  {
                    key: "grossAmount",
                    header: "ยอด Gross",
                    format: (v) => formatAmount(Number(v)),
                  },
                  {
                    key: "whtRate",
                    header: "อัตรา %",
                    format: (v) => String(v),
                  },
                  {
                    key: "whtAmount",
                    header: "ยอด WHT",
                    format: (v) => formatAmount(Number(v)),
                  },
                  {
                    key: "netAmount",
                    header: "ยอด Net",
                    format: (v) => formatAmount(Number(v)),
                  },
                  { key: "whtCertNumber", header: "เลข 50 ทวิ" },
                  {
                    key: "whtCertReceivedAt",
                    header: "วันที่รับ cert",
                    format: (v) => (v ? formatDate(String(v)) : ""),
                  },
                  {
                    key: "whtCertStatus",
                    header: "สถานะ cert",
                    format: (v) => STATUS_LABEL[String(v)] ?? String(v),
                  },
                ]}
              />
            </div>
            {data.entries.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                ไม่มีข้อมูล
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-2">เลขที่ใบเสร็จ</th>
                      <th className="text-left py-2 px-2">วันที่</th>
                      <th className="text-left py-2 px-2">ลูกค้า</th>
                      <th className="text-right py-2 px-2">Gross</th>
                      <th className="text-right py-2 px-2">WHT</th>
                      <th className="text-right py-2 px-2">Net</th>
                      <th className="text-left py-2 px-2">50 ทวิ</th>
                      <th className="text-left py-2 px-2">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-muted/40">
                        <td className="py-2 px-2 font-mono">
                          {e.receiptNumber}
                        </td>
                        <td className="py-2 px-2">
                          {formatDate(e.issueDate)}
                        </td>
                        <td className="py-2 px-2">
                          <div>{e.customerName}</div>
                          {e.invoiceNumber && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {e.invoiceNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {formatAmount(e.grossAmount)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-blue-600">
                          {formatAmount(e.whtAmount)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {formatAmount(e.netAmount)}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {e.whtCertNumber ?? "-"}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {STATUS_LABEL[e.whtCertStatus] ?? e.whtCertStatus}
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
