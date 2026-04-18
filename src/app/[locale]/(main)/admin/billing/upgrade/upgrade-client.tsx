"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  CreditCard,
  QrCode,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowDownCircle,
} from "lucide-react";

interface Plan {
  id: string;
  slug: string;
  tier: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  yearlyDiscountPercent: number;
  maxUsers: number;
  maxMachines: number;
  maxCustomers: number;
  maxProducts: number;
}

interface Usage {
  users: number;
  machines: number;
  customers: number;
  products: number;
}

type Step = "select-plan" | "confirm-downgrade" | "select-method" | "pay" | "success";
type Gateway = "OMISE" | "SLIPOK";

interface LimitIssue {
  resource: string;
  label: string;
  current: number;
  limit: number;
}

function computeDowngradeIssues(target: Plan, usage: Usage): LimitIssue[] {
  const issues: LimitIssue[] = [];
  if (target.maxUsers > 0 && usage.users > target.maxUsers) {
    issues.push({ resource: "users", label: "ผู้ใช้งาน", current: usage.users, limit: target.maxUsers });
  }
  if (target.maxMachines > 0 && usage.machines > target.maxMachines) {
    issues.push({ resource: "machines", label: "เครื่องจักร", current: usage.machines, limit: target.maxMachines });
  }
  if (target.maxCustomers > 0 && usage.customers > target.maxCustomers) {
    issues.push({ resource: "customers", label: "ลูกค้า", current: usage.customers, limit: target.maxCustomers });
  }
  if (target.maxProducts > 0 && usage.products > target.maxProducts) {
    issues.push({ resource: "products", label: "สินค้า", current: usage.products, limit: target.maxProducts });
  }
  return issues;
}

export function UpgradeClient({
  plans,
  currentPlanId,
  currentPlanName,
  currentPlanTier,
  currentPriceMonthly,
  usage,
  omiseReady,
}: {
  plans: Plan[];
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanTier: string | null;
  currentPriceMonthly: number;
  usage: Usage;
  omiseReady: boolean;
}) {
  const [step, setStep] = useState<Step>("select-plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  // Default to SLIPOK (PromptPay + slip) since OMISE credit card is not yet configured
  const [gateway, setGateway] = useState<Gateway>("SLIPOK");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState<{
    subscriptionId: string;
    qrCodeUrl?: string | null;
    sourceId?: string;
    amountSatang: number;
    configMissing?: boolean;
    instructions?: string;
    downgraded?: boolean;
  } | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);

  function formatSat(sat: number) {
    return `฿${(sat / 100).toLocaleString("th-TH")}`;
  }

  function isDowngradeToFree(target: Plan): boolean {
    return target.priceMonthly === 0 && currentPriceMonthly > 0;
  }

  function isDowngrade(target: Plan): boolean {
    return target.priceMonthly < currentPriceMonthly;
  }

  function handlePlanClick(p: Plan) {
    if (p.id === currentPlanId) return;
    setSelectedPlan(p);
    setError("");
    // Free downgrade → skip payment selection entirely
    if (isDowngradeToFree(p)) {
      setStep("confirm-downgrade");
      return;
    }
    setStep("select-method");
  }

  async function startCheckout(opts?: { downgradeToFree?: boolean }) {
    if (!selectedPlan) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          billingCycle: cycle,
          paymentGateway: opts?.downgradeToFree ? "SLIPOK" : gateway,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed");
        setLoading(false);
        return;
      }
      setCheckout(data);
      // Downgrade to free was processed immediately → jump to success
      if (data.downgraded) {
        setStep("success");
      } else {
        setStep("pay");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function uploadSlip() {
    if (!slipFile || !checkout) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("subscriptionId", checkout.subscriptionId);
      fd.append("file", slipFile);
      const res = await fetch("/api/billing/confirm-slip", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Slip verification failed");
        setLoading(false);
        return;
      }
      setStep("success");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  // ─── Select plan ────────────────────────────────
  if (step === "select-plan") {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold mb-1">เลือก Plan</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Current: <span className="font-medium text-foreground">{currentPlanName ?? "—"}</span>
          {currentPlanTier && (
            <span className="ml-2 text-xs text-muted-foreground">({currentPlanTier})</span>
          )}
        </p>

        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-full border bg-card p-1">
            <button
              onClick={() => setCycle("MONTHLY")}
              className={`px-5 py-1.5 text-sm font-medium rounded-full transition ${
                cycle === "MONTHLY" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              รายเดือน
            </button>
            <button
              onClick={() => setCycle("YEARLY")}
              className={`px-5 py-1.5 text-sm font-medium rounded-full transition ${
                cycle === "YEARLY" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              รายปี <span className="text-[10px] font-semibold text-green-600 ml-1">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isCurrent = p.id === currentPlanId;
            const price = cycle === "MONTHLY" ? p.priceMonthly : Math.round(p.priceYearly / 12);
            const downgradeIssues = !isCurrent && isDowngrade(p) ? computeDowngradeIssues(p, usage) : [];
            const blocked = downgradeIssues.length > 0;
            const isFreeDown = !isCurrent && isDowngradeToFree(p);

            return (
              <button
                key={p.id}
                onClick={() => {
                  if (isCurrent || blocked) return;
                  handlePlanClick(p);
                }}
                disabled={isCurrent || blocked}
                className={`rounded-xl border bg-card p-5 text-left transition ${
                  isCurrent
                    ? "opacity-60 cursor-not-allowed"
                    : blocked
                    ? "opacity-70 cursor-not-allowed border-destructive/40"
                    : "hover:border-primary hover:shadow-md"
                }`}
              >
                <div className="font-semibold flex items-center gap-2">
                  {p.name}
                  {isFreeDown && !blocked && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      ดาวน์เกรด
                    </span>
                  )}
                </div>
                {p.description && (
                  <div className="text-xs text-muted-foreground mt-1 min-h-[32px]">
                    {p.description}
                  </div>
                )}
                <div className="mt-3 text-2xl font-bold">
                  {price === 0 ? "ฟรี" : formatSat(price)}
                </div>
                <div className="text-xs text-muted-foreground">
                  /เดือน{cycle === "YEARLY" ? " (จ่ายรายปี)" : ""}
                </div>

                {isCurrent && (
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Check className="h-3 w-3" /> ใช้อยู่
                  </div>
                )}

                {blocked && (
                  <div className="mt-3 text-[11px] text-destructive space-y-0.5">
                    <div className="flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-3 w-3" /> ดาวน์เกรดไม่ได้
                    </div>
                    {downgradeIssues.map((i) => (
                      <div key={i.resource} className="pl-4">
                        • {i.label}: {i.current}/{i.limit}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Confirm downgrade to FREE (no payment) ─────
  if (step === "confirm-downgrade" && selectedPlan) {
    return (
      <div className="max-w-xl">
        <button
          onClick={() => setStep("select-plan")}
          className="text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          ← กลับไปเลือก Plan
        </button>

        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ArrowDownCircle className="h-6 w-6 text-amber-500" />
          ยืนยันการดาวน์เกรด
        </h1>

        <div className="rounded-xl border bg-card p-5 mb-4">
          <div className="text-xs text-muted-foreground mb-1">จาก</div>
          <div className="font-semibold">{currentPlanName ?? "—"}</div>
          <div className="my-3 border-t border-dashed"></div>
          <div className="text-xs text-muted-foreground mb-1">ไป</div>
          <div className="font-semibold">{selectedPlan.name}</div>
          <div className="mt-1 text-sm text-muted-foreground">ฟรี ไม่มีค่าใช้จ่าย</div>
        </div>

        <div className="rounded-xl border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40 p-4 mb-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-amber-900 dark:text-amber-200">
              <div className="font-medium mb-1">หลังดาวน์เกรด</div>
              <ul className="space-y-0.5 text-xs list-disc list-inside">
                <li>จำกัด {selectedPlan.maxUsers || "ไม่จำกัด"} ผู้ใช้ / {selectedPlan.maxMachines || "ไม่จำกัด"} เครื่อง / {selectedPlan.maxCustomers || "ไม่จำกัด"} ลูกค้า</li>
                <li>ฟีเจอร์บางอย่างจะถูกปิด — ข้อมูลเดิมยังอยู่ครบ</li>
                <li>สามารถอัพเกรดกลับได้ตลอดเวลา</li>
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep("select-plan")}
            disabled={loading}
            className="flex-1 h-11 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => startCheckout({ downgradeToFree: true })}
            disabled={loading}
            className="flex-1 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600 disabled:opacity-60 gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            ยืนยันดาวน์เกรด
          </button>
        </div>
      </div>
    );
  }

  // ─── Select payment method ──────────────────────
  if (step === "select-method" && selectedPlan) {
    const total =
      cycle === "MONTHLY" ? selectedPlan.priceMonthly : selectedPlan.priceYearly;
    const vat = Math.round(total * 0.07);
    const grand = total + vat;

    return (
      <div className="max-w-2xl">
        <button onClick={() => setStep("select-plan")} className="text-sm text-muted-foreground hover:text-foreground mb-4">
          ← เปลี่ยน Plan
        </button>

        <h1 className="text-2xl font-bold mb-6">เลือกวิธีชำระเงิน</h1>

        <div className="rounded-xl border bg-card p-5 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold">{selectedPlan.name}</div>
              <div className="text-xs text-muted-foreground">
                {cycle === "MONTHLY" ? "รายเดือน" : "รายปี"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Subtotal: {formatSat(total)}</div>
              <div className="text-xs text-muted-foreground">VAT 7%: {formatSat(vat)}</div>
              <div className="text-xl font-bold mt-1">{formatSat(grand)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <PaymentOption
            icon={QrCode}
            title="PromptPay QR + อัพโหลดสลิป"
            desc="สแกนจ่ายผ่าน PromptPay แล้วอัพโหลดสลิป ระบบตรวจสอบอัตโนมัติผ่าน SlipOK"
            selected={gateway === "SLIPOK"}
            onClick={() => setGateway("SLIPOK")}
            badge="แนะนำ"
          />
          <PaymentOption
            icon={CreditCard}
            title="บัตรเครดิต / เดบิต"
            desc={
              omiseReady
                ? "ชำระด้วยบัตรผ่าน Omise — ตัดบัตรทันที"
                : "กำลังเตรียมระบบ — ใช้งานได้เร็วๆ นี้"
            }
            selected={gateway === "OMISE"}
            onClick={() => omiseReady && setGateway("OMISE")}
            disabled={!omiseReady}
            badge={omiseReady ? undefined : "เร็วๆ นี้"}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
          </div>
        )}

        <button
          onClick={() => startCheckout()}
          disabled={loading}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600 disabled:opacity-60 gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          ดำเนินการ <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ─── Payment step ───────────────────────────────
  if (step === "pay" && checkout) {
    if (checkout.configMissing) {
      return (
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold mb-6">รอการตั้งค่า</h1>
          <div className="rounded-xl border bg-yellow-500/10 p-5 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">Payment gateway ยังไม่พร้อม</div>
                <p>ผู้ดูแลระบบยังไม่ได้ตั้งค่า Omise API keys — กรุณาติดต่อ <a href="mailto:hello@workinflow.cloud" className="text-primary underline">hello@workinflow.cloud</a></p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Subscription {checkout.subscriptionId} สร้างแล้ว (PENDING) — superadmin activate ให้ได้
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (gateway === "OMISE" && checkout.qrCodeUrl) {
      return (
        <div className="max-w-md">
          <h1 className="text-2xl font-bold mb-2">สแกน QR เพื่อชำระเงิน</h1>
          <p className="text-sm text-muted-foreground mb-6">
            ยอด {formatSat(checkout.amountSatang)} • ใช้แอปธนาคารใดก็ได้
          </p>
          <div className="rounded-xl border bg-white p-4 flex items-center justify-center">
            <Image
              src={checkout.qrCodeUrl}
              alt="PromptPay QR"
              width={256}
              height={256}
              unoptimized
            />
          </div>
          <p className="mt-4 text-xs text-center text-muted-foreground">
            รอการยืนยันอัตโนมัติหลังชำระ — หน้านี้จะอัพเดต
          </p>
        </div>
      );
    }

    if (gateway === "SLIPOK") {
      return (
        <div className="max-w-md">
          <h1 className="text-2xl font-bold mb-2">อัพโหลดสลิป</h1>
          <p className="text-sm text-muted-foreground mb-6">
            ยอด {formatSat(checkout.amountSatang)}
          </p>

          <div className="rounded-xl border bg-card p-4 mb-4">
            <div className="text-xs text-muted-foreground mb-1">โอนเงินไปที่</div>
            <div className="font-mono text-sm">
              ธ.กสิกรไทย • XXX-X-XXXXX-X<br />
              บริษัท WorkinFlow Cloud จำกัด
            </div>
          </div>

          <label className="block rounded-xl border-2 border-dashed bg-card p-6 text-center cursor-pointer hover:bg-muted transition">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
            />
            {slipFile ? (
              <div className="text-sm font-medium">{slipFile.name}</div>
            ) : (
              <>
                <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm font-medium">คลิกเพื่อเลือกไฟล์สลิป</div>
                <div className="text-xs text-muted-foreground mt-1">JPG, PNG (max 5MB)</div>
              </>
            )}
          </label>

          {error && (
            <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            onClick={uploadSlip}
            disabled={loading || !slipFile}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600 disabled:opacity-60 gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            ยืนยันการชำระ
          </button>
        </div>
      );
    }

    // Fallback — should not reach here (MANUAL was removed)
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-4">กำลังรอยืนยัน</h1>
        <p className="text-muted-foreground text-sm">
          {checkout.instructions || "ระบบกำลังประมวลผลคำสั่งซื้อ"}
        </p>
      </div>
    );
  }

  // ─── Success ────────────────────────────────────
  if (step === "success") {
    const wasDowngrade = checkout?.downgraded;
    return (
      <div className="max-w-md text-center py-8">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${wasDowngrade ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"}`}>
          {wasDowngrade ? <ArrowDownCircle className="h-8 w-8" /> : <Check className="h-8 w-8" />}
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {wasDowngrade ? "ดาวน์เกรดสำเร็จ" : "ชำระเงินสำเร็จ"}
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          {wasDowngrade
            ? `เปลี่ยนมาใช้ ${selectedPlan?.name ?? "Plan ใหม่"} แล้ว`
            : "Subscription ถูกเปิดใช้งานแล้ว ขอบคุณที่เชื่อใจ WorkinFlow"}
        </p>
        <Link
          href="/admin/billing"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600"
        >
          กลับไปหน้า Billing
        </Link>
      </div>
    );
  }

  return null;
}

function PaymentOption({
  icon: Icon,
  title,
  desc,
  selected,
  onClick,
  disabled,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-start gap-3 w-full rounded-xl border bg-card p-4 text-left transition ${
        disabled
          ? "opacity-60 cursor-not-allowed"
          : selected
          ? "border-primary ring-2 ring-primary/20"
          : "hover:border-primary/50"
      }`}
    >
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
          selected && !disabled
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium flex items-center gap-2">
          {title}
          {badge && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                disabled
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      {selected && !disabled && <Check className="h-5 w-5 text-primary shrink-0" />}
    </button>
  );
}
