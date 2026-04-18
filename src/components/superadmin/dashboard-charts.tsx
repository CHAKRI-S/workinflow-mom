"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonthlySignup {
  month: string;
  count: number;
}

interface PlanDistItem {
  tier: string;
  name: string;
  count: number;
}

interface StatusItem {
  status: string;
  count: number;
}

interface TopPlan {
  id: string;
  name: string;
  tier: string;
  activeCount: number;
}

interface StatsData {
  monthlySignups: MonthlySignup[];
  planDistribution: PlanDistItem[];
  statusBreakdown: StatusItem[];
  topPlans: TopPlan[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PIE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#22c55e",
  TRIAL: "#3b82f6",
  SUSPENDED: "#f59e0b",
  CANCELLED: "#ef4444",
};

function formatMonth(monthKey: string): string {
  const [year, m] = monthKey.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1, 1);
  return date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardCharts() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/sa/stats")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json() as Promise<StatsData>;
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return null;

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    );
  }

  const hasSignups = data.monthlySignups.some((d) => d.count > 0);
  const hasDist = data.planDistribution.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
      {/* ── Monthly Signups Bar Chart ──────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">New Tenants (6 months)</h3>
        {hasSignups ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={data.monthlySignups}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(label) =>
                  typeof label === "string" ? formatMonth(label) : label
                }
                formatter={(val) => [val, "New tenants"]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
              />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="ยังไม่มี tenant สมัครใน 6 เดือนที่ผ่านมา" />
        )}
      </div>

      {/* ── Plan Distribution Pie Chart ───────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">Plan Distribution</h3>
        {hasDist ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.planDistribution}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.planDistribution.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(val, name) => [val, name]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="ยังไม่มีข้อมูล plan" />
        )}
      </div>

      {/* ── Status Breakdown ──────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">Tenant Status Breakdown</h3>
        {data.statusBreakdown.length > 0 ? (
          <div className="space-y-3">
            {data.statusBreakdown
              .sort((a, b) => b.count - a.count)
              .map((row) => {
                const total = data.statusBreakdown.reduce(
                  (sum, r) => sum + r.count,
                  0
                );
                const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                const color = STATUS_COLORS[row.status] ?? "#94a3b8";
                return (
                  <div key={row.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span
                        className="font-medium"
                        style={{ color }}
                      >
                        {row.status}
                      </span>
                      <span className="text-muted-foreground">
                        {row.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <EmptyState message="ยังไม่มี tenant" />
        )}
      </div>

      {/* ── Top Active Plans ──────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">Top Plans (Active)</h3>
        {data.topPlans.length > 0 ? (
          <div className="space-y-2">
            {data.topPlans.map((plan, i) => (
              <div
                key={plan.id}
                className="flex items-center justify-between py-1.5 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">
                    {i + 1}.
                  </span>
                  <div>
                    <div className="text-sm font-medium">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">{plan.tier}</div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-primary">
                  {plan.activeCount} tenants
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="ยังไม่มี active tenant" />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
      {message}
    </div>
  );
}
