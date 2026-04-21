"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Loader2, Eye } from "lucide-react";
import { StatusBadge } from "@/components/superadmin/status-badge";

// ── Types ────────────────────────────────────────────────────────────
type SubStatus = "TRIAL" | "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "SUSPENDED";
type SubCycle = "MONTHLY" | "YEARLY";
type SubGateway = "OMISE" | "SLIPOK" | "MANUAL" | null;

export interface SubscriptionRow {
  id: string;
  createdAt: string;
  status: SubStatus;
  billingCycle: SubCycle;
  periodStart: string;
  periodEnd: string;
  totalSatang: number;
  paymentGateway: SubGateway;
  tenant: {
    id: string;
    name: string;
    slug: string | null;
    code: string;
    status: string;
  };
  plan: {
    id: string;
    name: string;
    tier: string;
  };
}

interface Totals {
  mrr: number;
  arr: number;
  activeCount: number;
  pendingCount: number;
  failedThisMonth: number;
}

interface PlanOption {
  id: string;
  name: string;
  tier: string;
}

interface Props {
  initialItems: SubscriptionRow[];
  initialTotal: number;
  initialTotals: Totals;
  pageSize: number;
  plans: PlanOption[];
}

// ── Helpers ──────────────────────────────────────────────────────────
function baht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────
export function SubscriptionsClient({
  initialItems,
  initialTotal,
  initialTotals,
  pageSize,
  plans,
}: Props) {
  const [items, setItems] = useState<SubscriptionRow[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [totals, setTotals] = useState<Totals>(initialTotals);
  const [page, setPage] = useState(1);

  // Filters
  const [status, setStatus] = useState<"ALL" | SubStatus>("ALL");
  const [planId, setPlanId] = useState<string>("");
  const [gateway, setGateway] = useState<"ALL" | "OMISE" | "SLIPOK" | "MANUAL">("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchData = useCallback(
    async (opts: { page?: number } = {}) => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams();
        qs.set("page", String(opts.page ?? page));
        qs.set("pageSize", String(pageSize));
        if (status !== "ALL") qs.set("status", status);
        if (planId) qs.set("plan", planId);
        if (gateway !== "ALL") qs.set("gateway", gateway);
        if (search.trim()) qs.set("search", search.trim());

        const res = await fetch(`/api/sa/subscriptions?${qs.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Load failed");
          return;
        }
        const data: {
          items: SubscriptionRow[];
          total: number;
          totals: Totals;
        } = await res.json();
        setItems(data.items);
        setTotal(data.total);
        setTotals(data.totals);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, status, planId, gateway, search],
  );

  // Refetch when filters change (reset to page 1)
  useEffect(() => {
    setPage(1);
    void fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, planId, gateway, search]);

  // Refetch when page changes
  useEffect(() => {
    void fetchData({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Subscriptions</h1>
        <p className="text-muted-foreground">
          รายการ subscription / การชำระเงินของ tenant ทุกราย
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="MRR" value={baht(totals.mrr)} hint="Monthly recurring revenue" />
        <KpiCard label="ARR" value={baht(totals.arr)} hint="Annualised (MRR × 12)" />
        <KpiCard
          label="Active"
          value={totals.activeCount.toLocaleString("th-TH")}
          hint="Active subscriptions"
          accent="green"
        />
        <KpiCard
          label="Pending"
          value={totals.pendingCount.toLocaleString("th-TH")}
          hint={`${totals.failedThisMonth} failed this month`}
          accent="yellow"
        />
      </div>

      {/* Filters */}
      <form onSubmit={applySearch} className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tenant name, slug, gateway ref..."
            className="h-10 w-full rounded-lg border bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "ALL" | SubStatus)}
          className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="TRIAL">Trial</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="SUSPENDED">Suspended</option>
        </select>

        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={gateway}
          onChange={(e) => setGateway(e.target.value as "ALL" | "OMISE" | "SLIPOK" | "MANUAL")}
          className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="ALL">All gateways</option>
          <option value="OMISE">Omise</option>
          <option value="SLIPOK">SlipOK</option>
          <option value="MANUAL">Manual</option>
        </select>

        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-blue-600"
        >
          Apply
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="text-left px-4 py-3 font-medium">Tenant</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Cycle</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Gateway</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 mx-auto animate-spin" />
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground">
                  No subscriptions found
                </td>
              </tr>
            )}
            {!loading &&
              items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(s.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tenants/${s.tenant.id}`}
                      className="block"
                    >
                      <div className="font-medium hover:text-primary transition">
                        {s.tenant.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.tenant.slug ?? s.tenant.code}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{s.plan.name}</div>
                    <div className="text-xs text-muted-foreground">{s.plan.tier}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{s.billingCycle}</td>
                  <td className="px-4 py-3 text-right font-medium">{baht(s.totalSatang)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">{s.paymentGateway ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/subscriptions/${s.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"
                      title="View detail"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Page {page} of {pageCount} — {total.toLocaleString("th-TH")} total
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount || loading}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "yellow";
}) {
  const accentClasses =
    accent === "green"
      ? "text-green-600"
      : accent === "yellow"
        ? "text-yellow-600"
        : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accentClasses}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
