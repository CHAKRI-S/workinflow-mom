"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pause, Play, Ban, Clock, RefreshCw, Package } from "lucide-react";
import { StatusBadge } from "@/components/superadmin/status-badge";

interface TenantData {
  id: string;
  name: string;
  slug: string | null;
  code: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  status: string;
  trialEndsAt: string | null;
  onboardedAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  planId: string | null;
  planName: string | null;
  counts: {
    users: number;
    customers: number;
    products: number;
    cncMachines: number;
    workOrders: number;
    invoices: number;
  };
  subscriptions: Array<{
    id: string;
    planName: string;
    status: string;
    billingCycle: string;
    periodStart: string;
    periodEnd: string;
    totalSatang: number;
    paymentGateway: string | null;
  }>;
}

interface Plan {
  id: string;
  slug: string;
  name: string;
  tier: string;
}

export function TenantDetailClient({
  tenant,
  allPlans,
}: {
  tenant: TenantData;
  allPlans: Plan[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function call(url: string, body?: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Failed");
      } else {
        setMsg("Success — refreshing...");
        router.refresh();
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function changePlan(newPlanId: string) {
    if (!confirm("เปลี่ยน plan ของ tenant นี้?")) return;
    await call(`/api/sa/tenants/${tenant.id}/plan`, { planId: newPlanId });
  }

  async function changeStatus(newStatus: string) {
    if (!confirm(`เปลี่ยน status เป็น ${newStatus}?`)) return;
    await call(`/api/sa/tenants/${tenant.id}/status`, { status: newStatus });
  }

  async function extendTrial(days: number) {
    if (!confirm(`ต่อ trial อีก ${days} วัน?`)) return;
    await call(`/api/sa/tenants/${tenant.id}/extend-trial`, { days });
  }

  return (
    <>
      <Link
        href="/tenants"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tenants
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{tenant.name}</h1>
            <StatusBadge status={tenant.status} />
          </div>
          <p className="text-muted-foreground mt-1">
            {tenant.slug} • {tenant.code} • {tenant.email ?? "no email"}
          </p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border bg-card px-4 py-2 text-sm">{msg}</div>
      )}

      {/* Quick info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <InfoCard label="Plan" value={tenant.planName ?? "—"} />
        <InfoCard
          label="Trial ends"
          value={tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString("th-TH") : "—"}
        />
        <InfoCard
          label="Last active"
          value={tenant.lastActiveAt ? new Date(tenant.lastActiveAt).toLocaleDateString("th-TH") : "Never"}
        />
        <InfoCard
          label="Created"
          value={new Date(tenant.createdAt).toLocaleDateString("th-TH")}
        />
      </div>

      {/* Usage */}
      <div className="rounded-xl border bg-card p-5 mb-6">
        <h2 className="font-semibold mb-4">Usage</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <UsageItem label="Users" value={tenant.counts.users} />
          <UsageItem label="Customers" value={tenant.counts.customers} />
          <UsageItem label="Products" value={tenant.counts.products} />
          <UsageItem label="Machines" value={tenant.counts.cncMachines} />
          <UsageItem label="Work Orders" value={tenant.counts.workOrders} />
          <UsageItem label="Invoices" value={tenant.counts.invoices} />
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl border bg-card p-5 mb-6">
        <h2 className="font-semibold mb-4">Actions</h2>
        <div className="space-y-4">
          {/* Change plan */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">Change Plan</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {allPlans.map((p) => (
                <button
                  key={p.id}
                  disabled={busy || p.id === tenant.planId}
                  onClick={() => changePlan(p.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    p.id === tenant.planId
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted"
                  } disabled:opacity-60`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Extend trial */}
          {tenant.status === "TRIAL" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Extend Trial</span>
              </div>
              <div className="flex gap-2">
                {[7, 14, 30, 60].map((d) => (
                  <button
                    key={d}
                    disabled={busy}
                    onClick={() => extendTrial(d)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                  >
                    +{d} days
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm font-medium">Status</span>
            </div>
            <div className="flex gap-2">
              {tenant.status !== "ACTIVE" && (
                <button
                  disabled={busy}
                  onClick={() => changeStatus("ACTIVE")}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 text-green-600 px-3 py-1.5 text-xs font-medium hover:bg-green-500/20 disabled:opacity-60"
                >
                  <Play className="h-3 w-3" /> Activate
                </button>
              )}
              {tenant.status !== "SUSPENDED" && tenant.status !== "CANCELLED" && (
                <button
                  disabled={busy}
                  onClick={() => changeStatus("SUSPENDED")}
                  className="inline-flex items-center gap-1 rounded-lg bg-yellow-500/10 text-yellow-600 px-3 py-1.5 text-xs font-medium hover:bg-yellow-500/20 disabled:opacity-60"
                >
                  <Pause className="h-3 w-3" /> Suspend
                </button>
              )}
              {tenant.status !== "CANCELLED" && (
                <button
                  disabled={busy}
                  onClick={() => changeStatus("CANCELLED")}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-500/20 disabled:opacity-60"
                >
                  <Ban className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subscriptions */}
      <div className="rounded-xl border bg-card">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Subscriptions</h2>
        </div>
        {tenant.subscriptions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No subscriptions yet
          </div>
        ) : (
          <div className="divide-y text-sm">
            {tenant.subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">
                    {s.planName} — {s.billingCycle}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.periodStart).toLocaleDateString("th-TH")} →{" "}
                    {new Date(s.periodEnd).toLocaleDateString("th-TH")}
                    {s.paymentGateway && <> • {s.paymentGateway}</>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    ฿{(s.totalSatang / 100).toLocaleString("th-TH")}
                  </span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}

function UsageItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-lg">{value.toLocaleString()}</div>
    </div>
  );
}
