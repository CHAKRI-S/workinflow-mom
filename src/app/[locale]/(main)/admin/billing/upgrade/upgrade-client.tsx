"use client";

import { useState } from "react";
import Image from "next/image";
import { CreditCard, QrCode, FileText, Loader2, Check, AlertCircle, ArrowRight } from "lucide-react";

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
}

type Step = "select-plan" | "select-method" | "pay" | "success";
type Gateway = "OMISE" | "SLIPOK" | "MANUAL";

export function UpgradeClient({
  plans,
  currentPlanId,
  currentPlanName,
}: {
  plans: Plan[];
  currentPlanId: string | null;
  currentPlanName: string | null;
}) {
  const [step, setStep] = useState<Step>("select-plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [gateway, setGateway] = useState<Gateway>("OMISE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState<{
    subscriptionId: string;
    qrCodeUrl?: string | null;
    sourceId?: string;
    amountSatang: number;
    configMissing?: boolean;
    instructions?: string;
  } | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);

  function formatSat(sat: number) {
    return `฿${(sat / 100).toLocaleString("th-TH")}`;
  }

  async function startCheckout() {
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
          paymentGateway: gateway,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed");
        setLoading(false);
        return;
      }
      setCheckout(data);
      setStep("pay");
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
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (isCurrent) return;
                  setSelectedPlan(p);
                  setStep("select-method");
                }}
                disabled={isCurrent}
                className={`rounded-xl border bg-card p-5 text-left transition ${
                  isCurrent
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:border-primary hover:shadow-md"
                }`}
              >
                <div className="font-semibold">{p.name}</div>
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
              </button>
            );
          })}
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
            title="PromptPay QR (Omise)"
            desc="สแกน QR ผ่านแอปธนาคาร ยืนยันยอดอัตโนมัติ"
            selected={gateway === "OMISE"}
            onClick={() => setGateway("OMISE")}
          />
          <PaymentOption
            icon={FileText}
            title="โอนแล้วอัพโหลดสลิป (SlipOK)"
            desc="โอนเข้าบัญชีบริษัท แล้วอัพโหลดสลิปเพื่อตรวจสอบ"
            selected={gateway === "SLIPOK"}
            onClick={() => setGateway("SLIPOK")}
          />
          <PaymentOption
            icon={CreditCard}
            title="ติดต่อฝ่ายบัญชี"
            desc="ออกใบแจ้งหนี้และชำระด้วยบัตรเครดิต/บัญชีบริษัท"
            selected={gateway === "MANUAL"}
            onClick={() => setGateway("MANUAL")}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
          </div>
        )}

        <button
          onClick={startCheckout}
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

    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-4">บันทึกคำสั่งซื้อแล้ว</h1>
        <p className="text-muted-foreground text-sm">
          {checkout.instructions || "ฝ่ายบัญชีจะติดต่อกลับเพื่อออกใบแจ้งหนี้ภายใน 1 วันทำการ"}
        </p>
      </div>
    );
  }

  // ─── Success ────────────────────────────────────
  if (step === "success") {
    return (
      <div className="max-w-md text-center py-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">ชำระเงินสำเร็จ</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Subscription ถูกเปิดใช้งานแล้ว ขอบคุณที่เชื่อใจ WorkinFlow
        </p>
        <a
          href="/th/admin/billing"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600"
        >
          กลับไปหน้า Billing
        </a>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 w-full rounded-xl border bg-card p-4 text-left transition ${
        selected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"
      }`}
    >
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      {selected && <Check className="h-5 w-5 text-primary shrink-0" />}
    </button>
  );
}
