"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Loader2, Copy, CheckCircle2, X, Clock, Ban, AlertCircle, ArrowLeft } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  name: string | null;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  invitedByName: string;
  createdAt: string;
}

const ROLES = [
  { value: "ADMIN", label: "ผู้ดูแลระบบ (Admin)" },
  { value: "MANAGER", label: "ผู้จัดการ (Manager)" },
  { value: "PLANNER", label: "วางแผนการผลิต (Planner)" },
  { value: "SALES", label: "ฝ่ายขาย (Sales)" },
  { value: "OPERATOR", label: "ช่าง CNC (Operator)" },
  { value: "QC", label: "ตรวจสอบคุณภาพ (QC)" },
  { value: "ACCOUNTING", label: "ฝ่ายบัญชี (Accounting)" },
];

export function InviteClient({ initialInvites }: { initialInvites: Invite[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ acceptUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") || "").trim().toLowerCase(),
      name: String(fd.get("name") || "").trim(),
      role: String(fd.get("role") || "OPERATOR"),
    };

    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }
      setSuccess({ acceptUrl: data.invite.acceptUrl });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function cancelInvite(id: string) {
    if (!confirm("ยกเลิก invite นี้?")) return;
    await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function copyLink() {
    if (!success) return;
    navigator.clipboard.writeText(success.acceptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function inviteStatus(i: Invite) {
    if (i.cancelledAt) return { label: "Cancelled", color: "bg-muted text-muted-foreground", icon: Ban };
    if (i.acceptedAt) return { label: "Accepted", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 };
    if (new Date(i.expiresAt) < new Date()) return { label: "Expired", color: "bg-red-500/10 text-red-600", icon: AlertCircle };
    return { label: "Pending", color: "bg-yellow-500/10 text-yellow-700", icon: Clock };
  }

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้าผู้ใช้งาน
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">เชิญผู้ใช้งาน</h1>
        <p className="text-sm text-muted-foreground">ส่ง invite link ผ่านอีเมล — หมดอายุใน 7 วัน</p>
      </div>

      {/* Invite form */}
      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 mb-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">อีเมล *</label>
            <input
              name="email"
              type="email"
              required
              placeholder="name@company.com"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium">ชื่อ *</label>
            <input
              name="name"
              required
              placeholder="ชื่อ-นามสกุล"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">ตำแหน่ง/สิทธิ์ *</label>
          <select
            name="role"
            defaultValue="OPERATOR"
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          ส่ง invite
        </button>
      </form>

      {/* Success alert with copy link */}
      {success && (
        <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm mb-1">ส่ง invite สำเร็จ!</div>
              <div className="text-xs text-muted-foreground mb-3">
                อีเมลถูกส่งแล้ว หรือแชร์ลิงก์นี้ด้วยตัวเอง:
              </div>
              <div className="flex gap-2">
                <input
                  value={success.acceptUrl}
                  readOnly
                  className="flex-1 h-9 rounded-lg border bg-background px-3 text-xs font-mono"
                />
                <button
                  onClick={copyLink}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-medium hover:bg-muted"
                >
                  {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <button onClick={() => setSuccess(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Invite history */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b">
          <div className="font-semibold">ประวัติ invites ({initialInvites.length})</div>
        </div>
        {initialInvites.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            ยังไม่มี invite
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">อีเมล / ชื่อ</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Expires</th>
                <th className="text-right px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialInvites.map((i) => {
                const { label, color, icon: Icon } = inviteStatus(i);
                const isPending = !i.acceptedAt && !i.cancelledAt && new Date(i.expiresAt) > new Date();
                return (
                  <tr key={i.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{i.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.name} • โดย {i.invitedByName}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs">{i.role}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
                        <Icon className="h-3 w-3" /> {label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(i.expiresAt).toLocaleDateString("th-TH")}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isPending && (
                        <button
                          onClick={() => cancelInvite(i.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          ยกเลิก
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
