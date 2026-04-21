"use client";

import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Receipt as ReceiptIcon } from "lucide-react";

type Bucket = "0_30" | "31_60" | "61_90" | "90_plus";

interface OutstandingItem {
  id: string;
  receiptNumber: string;
  issueDate: string;
  ageDays: number;
  bucket: Bucket;
  grossAmount: string | null;
  whtAmount: string;
  whtRate: string;
  whtCertStatus: string;
  whtCertNumber: string | null;
  payerName: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    customer: { id: string; code: string; name: string } | null;
  } | null;
}

interface OutstandingResponse {
  items: OutstandingItem[];
  summary: {
    total: number;
    totalWhtAmount: number;
    buckets: Record<Bucket, { count: number; whtAmount: number }>;
  };
}

interface StatsResponse {
  year: number;
  totalCount: number;
  totalGross: number;
  totalNet: number;
  totalWhtAmount: number;
  byStatus: Record<string, { count: number; whtAmount: number }>;
  byMonth: Array<{ month: number; count: number; whtAmount: number }>;
}

const BUCKET_LABEL: Record<Bucket, string> = {
  "0_30": "0-30 วัน",
  "31_60": "31-60 วัน",
  "61_90": "61-90 วัน",
  "90_plus": "> 90 วัน",
};

const BUCKET_COLOR: Record<Bucket, string> = {
  "0_30": "text-gray-700",
  "31_60": "text-amber-600",
  "61_90": "text-orange-600",
  "90_plus": "text-red-600",
};

function formatCurrency(n: number | string) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function WhtTrackingClient() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [outstanding, setOutstanding] = useState<OutstandingResponse | null>(
    null
  );
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [outRes, statsRes] = await Promise.all([
          fetch("/api/finance/wht/outstanding"),
          fetch(`/api/finance/wht/stats?year=${year}`),
        ]);
        if (!cancelled) {
          if (outRes.ok) setOutstanding(await outRes.json());
          if (statsRes.ok) setStats(await statsRes.json());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">
          ติดตามหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)
        </h1>
      </div>

      {/* Outstanding summary */}
      {outstanding && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold">Cert คงค้าง (Aging)</h2>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-2">
            {(Object.keys(outstanding.summary.buckets) as Bucket[]).map((b) => (
              <div key={b} className="rounded-md border p-3">
                <div className={`text-xs ${BUCKET_COLOR[b]} font-medium`}>
                  {BUCKET_LABEL[b]}
                </div>
                <div className="text-2xl font-semibold mt-1">
                  {outstanding.summary.buckets[b].count}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {formatCurrency(outstanding.summary.buckets[b].whtAmount)} บาท
                </div>
              </div>
            ))}
          </div>
          <div className="text-sm text-muted-foreground pt-2">
            รวม {outstanding.summary.total} รายการ ·{" "}
            <span className="font-mono font-medium">
              {formatCurrency(outstanding.summary.totalWhtAmount)}
            </span>{" "}
            บาท
          </div>
        </Card>
      )}

      {/* Outstanding list */}
      {outstanding && outstanding.items.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">รายการ</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2">เลขที่</th>
                  <th className="text-left py-2 px-2">วันที่</th>
                  <th className="text-left py-2 px-2">Aging</th>
                  <th className="text-left py-2 px-2">ลูกค้า</th>
                  <th className="text-right py-2 px-2">WHT (บาท)</th>
                  <th className="text-left py-2 px-2">สถานะ</th>
                  <th className="text-left py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {outstanding.items.map((it) => (
                  <tr key={it.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-2 font-mono">
                      {it.receiptNumber}
                    </td>
                    <td className="py-2 px-2">{formatDate(it.issueDate)}</td>
                    <td
                      className={`py-2 px-2 font-medium ${BUCKET_COLOR[it.bucket]}`}
                    >
                      {it.ageDays} วัน
                    </td>
                    <td className="py-2 px-2">
                      {it.invoice?.customer?.name ?? it.payerName}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      {formatCurrency(it.whtAmount)}
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge
                        status={
                          it.whtCertStatus === "MISSING_OVERDUE"
                            ? "CANCELLED"
                            : "PENDING"
                        }
                        label={
                          it.whtCertStatus === "MISSING_OVERDUE"
                            ? "เกินกำหนด"
                            : "รอรับ"
                        }
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Link href={`/finance/receipts/${it.id}`}>
                        <Button variant="outline" size="sm">
                          <ReceiptIcon className="h-3 w-3 mr-1" />
                          เปิด
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* YTD Credit Summary */}
      {stats && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              WHT Credit สะสมปี {stats.year} (สำหรับ ภ.ง.ด.50/51)
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setYear(year - 1)}
              >
                ← {year - 1}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setYear(year + 1)}
                disabled={year >= new Date().getFullYear()}
              >
                {year + 1} →
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">ยอด Gross รวม</div>
              <div className="text-lg font-semibold mt-1 font-mono">
                {formatCurrency(stats.totalGross)}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">ยอด Net (รับจริง)</div>
              <div className="text-lg font-semibold mt-1 font-mono">
                {formatCurrency(stats.totalNet)}
              </div>
            </div>
            <div className="rounded-md border p-3 bg-blue-50">
              <div className="text-xs text-blue-700">WHT Credit รวม</div>
              <div className="text-xl font-bold mt-1 font-mono text-blue-900">
                {formatCurrency(stats.totalWhtAmount)}
              </div>
              <div className="text-xs text-blue-600 mt-0.5">
                จาก {stats.totalCount} รายการ
              </div>
            </div>
          </div>

          {/* By status */}
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">แยกตามสถานะ cert</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(stats.byStatus).map(([k, v]) => (
                <div key={k} className="text-xs rounded border p-2">
                  <div className="text-muted-foreground">{k}</div>
                  <div className="font-mono">
                    {v.count} · {formatCurrency(v.whtAmount)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">
              แยกตามเดือน
            </div>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
              {stats.byMonth.map((m) => (
                <div key={m.month} className="text-center text-xs">
                  <div className="text-muted-foreground">{m.month}</div>
                  <div className="font-mono text-[11px]">
                    {m.whtAmount > 0 ? formatCurrency(m.whtAmount) : "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {outstanding && outstanding.items.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          ยังไม่มี cert ที่คงค้าง
        </Card>
      )}
    </div>
  );
}
