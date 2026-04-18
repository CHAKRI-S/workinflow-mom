"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Tag, ToggleLeft, ToggleRight } from "lucide-react";

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerTenant: number | null;
  isActive: boolean;
  createdAt: string;
  usageCount: number;
}

export function DiscountsClient({ initialCodes }: { initialCodes: DiscountCode[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      code: String(fd.get("code") || "").trim().toUpperCase(),
      description: String(fd.get("description") || "").trim() || null,
      discountType: String(fd.get("discountType") || "PERCENT") as "PERCENT" | "FIXED",
      discountValue: Number(fd.get("discountValue") || 0),
      validUntil: String(fd.get("validUntil") || "") || null,
      maxUses: fd.get("maxUses") ? Number(fd.get("maxUses")) : null,
      maxUsesPerTenant: fd.get("maxUsesPerTenant") ? Number(fd.get("maxUsesPerTenant")) : null,
      isActive: true,
    };

    // Convert date to ISO datetime
    const body = {
      ...payload,
      validFrom: null,
      validUntil: payload.validUntil ? new Date(payload.validUntil).toISOString() : null,
    };

    try {
      const res = await fetch("/api/sa/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Create failed");
        setLoading(false);
        return;
      }
      setShowForm(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(c: DiscountCode) {
    await fetch(`/api/sa/discounts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    router.refresh();
  }

  async function deleteCode(c: DiscountCode) {
    if (!confirm(`ลบ discount code "${c.code}"?`)) return;
    const res = await fetch(`/api/sa/discounts/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }
    router.refresh();
  }

  function formatValue(c: DiscountCode) {
    return c.discountType === "PERCENT"
      ? `${c.discountValue}%`
      : `฿${(c.discountValue / 100).toLocaleString("th-TH")}`;
  }

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Discount Codes</h1>
          <p className="text-muted-foreground">โค้ดส่วนลดสำหรับลูกค้าตอน upgrade</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" /> New Code
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border bg-card p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Code *</label>
              <input
                name="code"
                required
                placeholder="SUMMER2026"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm uppercase"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <input
                name="description"
                placeholder="Summer promo"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Type *</label>
              <select name="discountType" className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                <option value="PERCENT">Percent (%)</option>
                <option value="FIXED">Fixed amount (satang)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Value *</label>
              <input
                name="discountValue"
                type="number"
                required
                min={1}
                placeholder="10"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Valid Until</label>
              <input
                name="validUntil"
                type="date"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Max Uses Total</label>
              <input
                name="maxUses"
                type="number"
                min={1}
                placeholder="100"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Max Uses Per Tenant</label>
              <input
                name="maxUsesPerTenant"
                type="number"
                min={1}
                placeholder="1"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {initialCodes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
          <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
          ยังไม่มี discount codes — สร้างใหม่ได้
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Discount</th>
                <th className="text-left px-4 py-3 font-medium">Valid Until</th>
                <th className="text-center px-4 py-3 font-medium">Used</th>
                <th className="text-center px-4 py-3 font-medium">Active</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialCodes.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold">{c.code}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground">{c.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatValue(c)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.validUntil ? new Date(c.validUntil).toLocaleDateString("th-TH") : "ไม่หมดอายุ"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {c.usedCount}
                    {c.maxUses ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(c)}>
                      {c.isActive ? (
                        <ToggleRight className="h-5 w-5 text-green-500 inline" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground inline" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteCode(c)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
