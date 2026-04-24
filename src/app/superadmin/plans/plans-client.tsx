"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2, Save, XCircle } from "lucide-react";

interface Plan {
  id: string;
  tier: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  yearlyDiscountPercent: number;
  maxUsers: number;
  maxMachines: number;
  maxCustomers: number;
  maxProducts: number;
  maxWorkOrdersPerMonth: number;
  featureProduction: boolean;
  featureFinance: boolean;
  featureMaintenance: boolean;
  featureFactoryDashboard: boolean;
  featureAuditLog: boolean;
  featurePurchaseOrders: boolean;
  featureAdvancedReports: boolean;
  featureExcelExport: boolean;
  featureCustomBranding: boolean;
  featureApiAccess: boolean;
  featureMultiLocation: boolean;
  sortOrder: number;
  isPublic: boolean;
  isActive: boolean;
  tenantCount: number;
}

const FEATURE_KEYS: Array<[keyof Plan, string]> = [
  ["featureProduction", "Production"],
  ["featureFinance", "Finance"],
  ["featurePurchaseOrders", "Purchase Orders"],
  ["featureMaintenance", "Maintenance"],
  ["featureFactoryDashboard", "Factory Dashboard"],
  ["featureAuditLog", "Audit Log"],
  ["featureAdvancedReports", "Advanced Reports"],
  ["featureExcelExport", "Excel Export"],
  ["featureCustomBranding", "Custom Branding"],
  ["featureApiAccess", "API Access"],
  ["featureMultiLocation", "Multi-Location"],
];

export function PlansClient({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  // BUG FIX: previously `const [plans] = useState(initialPlans)` froze the
  // list on first mount, so after PATCH succeeded and `router.refresh()`
  // re-fetched from Prisma, the UI still showed the STALE pre-edit values
  // — making users think the save failed even though the DB updated. Read
  // directly from the prop so refresh shows the new data.
  const plans = initialPlans;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit(p: Plan) {
    setEditingId(p.id);
    setDraft({ ...p });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/sa/plans/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        setSaving(false);
        return;
      }
      setEditingId(null);
      setDraft(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function fmt(sat: number) {
    return `฿${(sat / 100).toLocaleString("th-TH")}`;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Plans</h1>
        <p className="text-muted-foreground">
          แก้ไขราคา, limits, และ features ของแต่ละ plan
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {plans.map((p) => {
          const isEditing = editingId === p.id;
          const d = isEditing && draft ? draft : p;
          return (
            <div key={p.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {p.tier}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.tenantCount} tenants
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">slug: {p.slug}</div>
                </div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={save}
                      disabled={saving}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border px-4 text-sm font-medium hover:bg-muted"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(p)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border px-4 text-sm font-medium hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <PriceField
                  label="Monthly (฿)"
                  editing={isEditing}
                  value={d.priceMonthly}
                  display={fmt(d.priceMonthly)}
                  onChange={(v) => draft && setDraft({ ...draft, priceMonthly: Number(v) })}
                />
                <PriceField
                  label="Yearly (฿)"
                  editing={isEditing}
                  value={d.priceYearly}
                  display={fmt(d.priceYearly)}
                  onChange={(v) => draft && setDraft({ ...draft, priceYearly: Number(v) })}
                />
                <NumField
                  label="Yearly Discount %"
                  editing={isEditing}
                  value={d.yearlyDiscountPercent}
                  onChange={(v) => draft && setDraft({ ...draft, yearlyDiscountPercent: v })}
                />
                <NumField
                  label="Sort Order"
                  editing={isEditing}
                  value={d.sortOrder}
                  onChange={(v) => draft && setDraft({ ...draft, sortOrder: v })}
                />
              </div>

              {/* Limits */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-muted-foreground mb-2">LIMITS (0 = unlimited)</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <NumField label="Max Users" editing={isEditing} value={d.maxUsers} onChange={(v) => draft && setDraft({ ...draft, maxUsers: v })} />
                  <NumField label="Max Machines" editing={isEditing} value={d.maxMachines} onChange={(v) => draft && setDraft({ ...draft, maxMachines: v })} />
                  <NumField label="Max Customers" editing={isEditing} value={d.maxCustomers} onChange={(v) => draft && setDraft({ ...draft, maxCustomers: v })} />
                  <NumField label="Max Products" editing={isEditing} value={d.maxProducts} onChange={(v) => draft && setDraft({ ...draft, maxProducts: v })} />
                  <NumField label="Max WO/month" editing={isEditing} value={d.maxWorkOrdersPerMonth} onChange={(v) => draft && setDraft({ ...draft, maxWorkOrdersPerMonth: v })} />
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">FEATURES</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {FEATURE_KEYS.map(([key, label]) => {
                    const enabled = d[key] as boolean;
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                          !isEditing ? "opacity-75" : "cursor-pointer hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={!isEditing}
                          onChange={(e) =>
                            draft && setDraft({ ...draft, [key]: e.target.checked } as Plan)
                          }
                          className="h-3.5 w-3.5"
                        />
                        {enabled ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/40" />
                        )}
                        <span className="flex-1">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Public / Active */}
              <div className="mt-4 flex gap-4 text-xs">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={d.isPublic}
                    disabled={!isEditing}
                    onChange={(e) => draft && setDraft({ ...draft, isPublic: e.target.checked })}
                  />
                  Public (visible on pricing page)
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={d.isActive}
                    disabled={!isEditing}
                    onChange={(e) => draft && setDraft({ ...draft, isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PriceField({
  label,
  editing,
  value,
  display,
  onChange,
}: {
  label: string;
  editing: boolean;
  value: number;
  display: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {editing ? (
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
        />
      ) : (
        <div className="text-sm font-medium">{display}</div>
      )}
    </div>
  );
}

function NumField({
  label,
  editing,
  value,
  onChange,
}: {
  label: string;
  editing: boolean;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {editing ? (
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
        />
      ) : (
        <div className="text-sm font-medium">{value === 0 ? "∞" : value.toLocaleString()}</div>
      )}
    </div>
  );
}
