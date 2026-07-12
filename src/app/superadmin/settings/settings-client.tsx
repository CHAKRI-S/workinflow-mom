"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle, Shield, Mail, CreditCard, Link2, Clock, AlertCircle, KeyRound, Power, Building2, Save, Send, MessageCircle, RefreshCw } from "lucide-react";

interface SaUser {
  id: string;
  username: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface IntegrationStatus {
  email: { resend: { configured: boolean; fromAddress: string | null } };
  payment: {
    omise: { configured: boolean; webhookSecret: boolean; publicKey: string | null };
    slipok: { configured: boolean; branchId: string | null };
  };
  auth: { saJwtSecret: { configured: boolean; fallback: boolean } };
  cron: { configured: boolean };
  telegram: { configured: boolean };
  urls: { appUrl: string | null; landingUrl: string | null; saUrl: string | null };
}

interface PlatformIssuer {
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  issuerPhone: string;
  issuerEmail: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  promptPayId: string;
}

export function SettingsClient({
  currentSaId,
  initialAdmins,
}: {
  currentSaId: string;
  initialAdmins: SaUser[];
}) {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [showCreateSa, setShowCreateSa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordFor, setPasswordFor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sa/integrations/status")
      .then((r) => r.json())
      .then(setIntegrations)
      .catch(() => {});
  }, []);

  async function handleCreateSa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      username: String(fd.get("username") || "").trim().toLowerCase(),
      email: String(fd.get("email") || "").trim().toLowerCase(),
      name: String(fd.get("name") || "").trim(),
      password: String(fd.get("password") || ""),
    };
    try {
      const res = await fetch("/api/sa/admins", {
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
      setShowCreateSa(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(id: string, newPassword: string) {
    const res = await fetch(`/api/sa/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed");
      return false;
    }
    alert("เปลี่ยนรหัสผ่านสำเร็จ");
    setPasswordFor(null);
    return true;
  }

  async function toggleActive(sa: SaUser) {
    await fetch(`/api/sa/admins/${sa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !sa.isActive }),
    });
    router.refresh();
  }

  async function deleteSa(sa: SaUser) {
    if (!confirm(`ลบ SA "${sa.username}"?`)) return;
    const res = await fetch(`/api/sa/admins/${sa.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Settings</h1>
        <p className="text-muted-foreground">Platform configuration และ SA user management</p>
      </div>

      {/* Platform Issuer (WorkinFlow legal entity info for SaaS tax invoices) */}
      <PlatformIssuerSection />

      {/* Telegram notification destinations */}
      <TelegramSection />

      {/* Integration status */}
      <div className="rounded-xl border bg-card p-5 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Integration Status
        </h2>

        {!integrations ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <IntegrationItem
              icon={Mail}
              label="Email (Resend)"
              configured={integrations.email.resend.configured}
              detail={integrations.email.resend.fromAddress ?? "RESEND_API_KEY not set"}
            />
            <IntegrationItem
              icon={CreditCard}
              label="Omise (Card + PromptPay)"
              configured={integrations.payment.omise.configured}
              detail={
                integrations.payment.omise.publicKey ??
                "OMISE_PUBLIC_KEY + OMISE_SECRET_KEY not set"
              }
              warning={!integrations.payment.omise.webhookSecret}
              warningText="Webhook secret not set (signature verification disabled)"
            />
            <IntegrationItem
              icon={CreditCard}
              label="SlipOK (Slip verification)"
              configured={integrations.payment.slipok.configured}
              detail={
                integrations.payment.slipok.branchId
                  ? `Branch: ${integrations.payment.slipok.branchId}`
                  : "SLIPOK_API_KEY + SLIPOK_BRANCH_ID not set"
              }
            />
            <IntegrationItem
              icon={Shield}
              label="SA JWT secret"
              configured={integrations.auth.saJwtSecret.configured}
              detail={
                integrations.auth.saJwtSecret.configured
                  ? "SA_JWT_SECRET set"
                  : integrations.auth.saJwtSecret.fallback
                    ? "Using AUTH_SECRET fallback (not recommended)"
                    : "NOT SET — SA login will fail!"
              }
              warning={!integrations.auth.saJwtSecret.configured}
            />
            <IntegrationItem
              icon={Clock}
              label="Cron secret"
              configured={integrations.cron.configured}
              detail={
                integrations.cron.configured
                  ? "CRON_SECRET set"
                  : "CRON_SECRET not set (trial cron ไม่มี auth)"
              }
            />
            <IntegrationItem
              icon={Send}
              label="Telegram (แจ้งเตือน)"
              configured={integrations.telegram.configured}
              detail={
                integrations.telegram.configured
                  ? "TELEGRAM_BOT_TOKEN set"
                  : "TELEGRAM_BOT_TOKEN not set (แจ้งเตือนปิดอยู่)"
              }
            />
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground pt-4 border-t">
          Integration secrets อยู่ใน Coolify env vars — แก้ได้ที่ Coolify UI แล้ว redeploy
        </div>
      </div>

      {/* Super Admin users */}
      <div className="rounded-xl border bg-card mb-6">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" /> Super Admin Users ({initialAdmins.length})
          </h2>
          <button
            onClick={() => setShowCreateSa((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-blue-600"
          >
            <Plus className="h-3.5 w-3.5" /> Add SA
          </button>
        </div>

        {showCreateSa && (
          <form onSubmit={handleCreateSa} className="p-5 bg-muted/30 border-b space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                name="username"
                placeholder="Username"
                required
                minLength={3}
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              />
              <input
                name="name"
                placeholder="Full name"
                required
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              />
              <input
                name="password"
                type="password"
                placeholder="Password (min 8 chars)"
                required
                minLength={8}
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5" /> {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateSa(false)}
                className="inline-flex h-9 items-center rounded-lg border px-4 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">User</th>
              <th className="text-left px-4 py-2 font-medium">Last Login</th>
              <th className="text-center px-4 py-2 font-medium">Active</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {initialAdmins.map((sa) => (
              <tr key={sa.id}>
                <td className="px-4 py-2">
                  <div className="font-medium">
                    {sa.name}
                    {sa.id === currentSaId && (
                      <span className="ml-2 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">YOU</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{sa.username} • {sa.email}</div>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {sa.lastLoginAt ? new Date(sa.lastLoginAt).toLocaleString("th-TH") : "Never"}
                </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => toggleActive(sa)} disabled={sa.id === currentSaId}>
                    {sa.isActive ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground inline" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setPasswordFor(sa.id)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <KeyRound className="h-3 w-3" /> Password
                    </button>
                    {sa.id !== currentSaId && (
                      <button
                        onClick={() => deleteSa(sa)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {passwordFor && (
        <PasswordDialog
          onClose={() => setPasswordFor(null)}
          onSubmit={(pwd) => changePassword(passwordFor, pwd)}
        />
      )}
    </>
  );
}

function PlatformIssuerSection() {
  const [data, setData] = useState<PlatformIssuer | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/sa/platform-settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Load failed"))))
      .then(setData)
      .catch(() => setMessage({ type: "err", text: "โหลดข้อมูลไม่สำเร็จ" }));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sa/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: body.error || "บันทึกไม่สำเร็จ" });
        setSaving(false);
        return;
      }
      setData(body);
      setMessage({ type: "ok", text: "บันทึกแล้ว — ใบกำกับภาษี SaaS จะใช้ข้อมูลใหม่ทันที" });
    } catch {
      setMessage({ type: "err", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof PlatformIssuer>(key: K, value: PlatformIssuer[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const allBlank =
    data !== null &&
    !data.issuerName &&
    !data.issuerTaxId &&
    !data.issuerAddress &&
    !data.issuerPhone &&
    !data.issuerEmail;

  return (
    <div className="rounded-xl border bg-card p-5 mb-6">
      <h2 className="font-semibold mb-1 flex items-center gap-2">
        <Building2 className="h-4 w-4" /> Platform Issuer
        <span className="text-xs font-normal text-muted-foreground">
          (ผู้ให้บริการ — แสดงบนใบกำกับภาษีค่าบริการ SaaS ที่ออกให้ tenant)
        </span>
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        ข้อมูลนิติบุคคลที่ดำเนินการ WorkinFlow ใช้แสดงใน SubscriptionInvoice PDF — เปลี่ยนได้ทันทีไม่ต้อง redeploy
      </p>

      {data === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {allBlank && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                ยังไม่ได้ตั้งค่า — ใบกำกับภาษี SaaS จะขึ้น <code className="font-mono">[SETUP REQUIRED]</code> จนกว่าจะบันทึกข้อมูลจริง
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                ชื่อนิติบุคคล (Legal name)
              </label>
              <input
                value={data.issuerName}
                onChange={(e) => update("issuerName", e.target.value)}
                placeholder="บริษัท เวิร์คอินโฟลว์ จำกัด"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                maxLength={200}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                เลขประจำตัวผู้เสียภาษี (13 หลัก)
              </label>
              <input
                value={data.issuerTaxId}
                onChange={(e) => update("issuerTaxId", e.target.value)}
                placeholder="0105567xxxxxxxx"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm font-mono"
                maxLength={20}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                ที่อยู่สำนักงานใหญ่
              </label>
              <textarea
                value={data.issuerAddress}
                onChange={(e) => update("issuerAddress", e.target.value)}
                placeholder="xxx ถนน xxx แขวง xxx เขต xxx กรุงเทพฯ 10xxx"
                rows={2}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                maxLength={500}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                value={data.issuerPhone}
                onChange={(e) => update("issuerPhone", e.target.value)}
                placeholder="02-xxx-xxxx"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                maxLength={50}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                อีเมล
              </label>
              <input
                type="email"
                value={data.issuerEmail}
                onChange={(e) => update("issuerEmail", e.target.value)}
                placeholder="billing@workinflow.cloud"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                maxLength={200}
              />
            </div>
          </div>

          {/* Bank account — shown to tenants who pay by manual bank transfer */}
          <div className="pt-3 mt-1 border-t">
            <h3 className="text-xs font-semibold mb-1 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" /> บัญชีธนาคาร (สำหรับลูกค้าโอนเงิน)
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              แสดงให้ลูกค้าที่เลือกชำระด้วยการโอนผ่านบัญชี แล้ว superadmin ยืนยันเอง
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  ธนาคาร
                </label>
                <input
                  value={data.bankName}
                  onChange={(e) => update("bankName", e.target.value)}
                  placeholder="ธนาคารกสิกรไทย"
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  ชื่อบัญชี
                </label>
                <input
                  value={data.bankAccountName}
                  onChange={(e) => update("bankAccountName", e.target.value)}
                  placeholder="บริษัท เวิร์คอินโฟลว์ จำกัด"
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  เลขที่บัญชี
                </label>
                <input
                  value={data.bankAccountNumber}
                  onChange={(e) => update("bankAccountNumber", e.target.value)}
                  placeholder="xxx-x-xxxxx-x"
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm font-mono"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  สาขา (ไม่บังคับ)
                </label>
                <input
                  value={data.bankBranch}
                  onChange={(e) => update("bankBranch", e.target.value)}
                  placeholder="สาขาสีลม"
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  PromptPay ID (ไม่บังคับ)
                </label>
                <input
                  value={data.promptPayId}
                  onChange={(e) => update("promptPayId", e.target.value)}
                  placeholder="0-XXXX-XXXX-X"
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm font-mono"
                  maxLength={50}
                />
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`flex items-start gap-2 rounded-lg p-2 text-xs ${
                message.type === "ok"
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.type === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
              )}
              {message.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              บันทึก
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface TelegramChat {
  id: string;
  chatId: string;
  label: string;
  active: boolean;
  createdAt: string;
}
interface DetectedChat {
  chatId: string;
  title: string;
  type: string;
}

function TelegramSection() {
  const [chats, setChats] = useState<TelegramChat[] | null>(null);
  const [botConfigured, setBotConfigured] = useState<boolean>(false);
  const [chatId, setChatId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<DetectedChat[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/sa/telegram/chats");
      const data = await res.json();
      setChats(data.chats ?? []);
      setBotConfigured(Boolean(data.botConfigured));
    } catch {
      setChats([]);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function addChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatId.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sa/telegram/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.trim(), label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "เพิ่มไม่สำเร็จ" });
        return;
      }
      setChatId("");
      setLabel("");
      await load();
      setMsg({ type: "ok", text: "เพิ่มปลายทางแล้ว" });
    } catch {
      setMsg({ type: "err", text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  async function removeChat(id: string) {
    if (!confirm("ลบปลายทางนี้?")) return;
    await fetch(`/api/sa/telegram/chats/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggle(c: TelegramChat) {
    await fetch(`/api/sa/telegram/chats/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    await load();
  }

  async function detect() {
    setDetecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sa/telegram/detect");
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "ดึงไม่สำเร็จ" });
        setDetected([]);
        return;
      }
      setDetected(data.chats ?? []);
      if ((data.chats ?? []).length === 0) {
        setMsg({
          type: "err",
          text: "ยังไม่พบแชต — กด /start ให้บอท (หรือเพิ่มบอทเข้ากลุ่มแล้วพิมพ์อะไรก็ได้) ก่อน",
        });
      }
    } catch {
      setMsg({ type: "err", text: "Network error" });
    } finally {
      setDetecting(false);
    }
  }

  async function sendTest(id?: string) {
    setMsg(null);
    const res = await fetch("/api/sa/telegram/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { chatId: id } : {}),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? { type: "ok", text: `ส่งข้อความทดสอบแล้ว (${data.sent} ปลายทาง)` }
        : { type: "err", text: data.error || "ส่งไม่สำเร็จ" }
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 mb-6">
      <h2 className="font-semibold mb-1 flex items-center gap-2">
        <Send className="h-4 w-4" /> Telegram แจ้งเตือน
        <span className="text-xs font-normal text-muted-foreground">
          (แจ้งเมื่อมีลูกค้าสมัคร / โอนเงิน / ใกล้หมดอายุ ฯลฯ)
        </span>
      </h2>

      {!botConfigured && (
        <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-700 dark:text-yellow-400 mb-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            ยังไม่ได้ตั้งค่า <code className="font-mono">TELEGRAM_BOT_TOKEN</code> — เพิ่มใน env (Coolify) แล้ว redeploy ก่อนถึงจะส่งได้
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mb-3">
        วิธีใช้: เปิดแชต/กลุ่มใน Telegram → เพิ่มบอท <code className="font-mono">@workinflow_bot</code> → กด /start (หรือพิมพ์ข้อความในกลุ่ม) → กด &quot;ดึง Chat ID&quot; แล้วเลือกปลายทาง
      </p>

      {/* Add form */}
      <form onSubmit={addChat} className="flex flex-wrap gap-2 mb-3">
        <input
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Chat ID (เช่น 123456789 หรือ -100xxxx)"
          className="h-9 flex-1 min-w-[200px] rounded-lg border bg-background px-3 text-sm font-mono"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ชื่อเรียก (ไม่บังคับ)"
          className="h-9 flex-1 min-w-[160px] rounded-lg border bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !chatId.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          เพิ่ม
        </button>
        <button
          type="button"
          onClick={detect}
          disabled={detecting || !botConfigured}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          ดึง Chat ID
        </button>
      </form>

      {/* Detected chats */}
      {detected && detected.length > 0 && (
        <div className="mb-3 rounded-lg border bg-muted/30 p-2 text-xs">
          <div className="mb-1 font-medium text-muted-foreground">แชตที่ตรวจพบ (กดเพื่อเลือก):</div>
          <div className="flex flex-wrap gap-2">
            {detected.map((d) => (
              <button
                key={d.chatId}
                type="button"
                onClick={() => {
                  setChatId(d.chatId);
                  setLabel(d.title);
                }}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 hover:bg-muted"
              >
                <MessageCircle className="h-3 w-3" />
                {d.title}
                <span className="font-mono text-muted-foreground">({d.chatId})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div
          className={`mb-3 flex items-start gap-2 rounded-lg p-2 text-xs ${
            msg.type === "ok"
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {msg.type === "ok" ? (
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
          )}
          {msg.text}
        </div>
      )}

      {/* Chat list */}
      {chats === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : chats.length === 0 ? (
        <p className="text-xs text-muted-foreground">ยังไม่มีปลายทาง</p>
      ) : (
        <div className="space-y-2">
          {chats.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{c.label || "(ไม่มีชื่อ)"}</div>
                <div className="font-mono text-xs text-muted-foreground">{c.chatId}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!c.active && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    ปิด
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => sendTest(c.chatId)}
                  disabled={!botConfigured}
                  title="ส่งข้อความทดสอบ"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  title={c.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-muted"
                >
                  <Power className={`h-3.5 w-3.5 ${c.active ? "text-green-600" : "text-muted-foreground"}`} />
                </button>
                <button
                  type="button"
                  onClick={() => removeChat(c.id)}
                  title="ลบ"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationItem({
  icon: Icon,
  label,
  configured,
  detail,
  warning,
  warningText,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  configured: boolean;
  detail: string;
  warning?: boolean;
  warningText?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
          configured ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {configured ? (
            <span className="text-xs text-green-600 font-medium">Configured</span>
          ) : (
            <span className="text-xs text-muted-foreground">Not set</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 font-mono">{detail}</div>
        {warning && warningText && (
          <div className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {warningText}
          </div>
        )}
      </div>
      {!configured && <Power className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
    </div>
  );
}

function PasswordDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (pwd: string) => Promise<boolean>;
}) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pwd !== confirm) {
      setError("Password ไม่ตรงกัน");
      return;
    }
    if (pwd.length < 8) {
      setError("อย่างน้อย 8 ตัว");
      return;
    }
    setLoading(true);
    await onSubmit(pwd);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-card border p-5 space-y-3">
        <h3 className="font-semibold">Change Password</h3>
        <input
          type="password"
          placeholder="New password (min 8)"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          minLength={8}
          required
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
        />
        {error && <div className="text-xs text-destructive">{error}</div>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border px-4 text-sm hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
