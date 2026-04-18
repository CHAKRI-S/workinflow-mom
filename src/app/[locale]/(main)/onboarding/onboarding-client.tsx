"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Image, Cpu, Users, Package, Sparkles, ArrowRight } from "lucide-react";

interface OnboardingClientProps {
  locale: string;
  tenantName: string;
  hasLogo: boolean;
  onboardedAt: string | null;
  trialEndsAt: string | null;
  status: string;
  planName: string;
  counts: {
    machines: number;
    customers: number;
    products: number;
    users: number;
  };
}

export function OnboardingClient({
  tenantName,
  hasLogo,
  onboardedAt,
  trialEndsAt,
  planName,
  counts,
}: OnboardingClientProps) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  const steps = [
    {
      id: "logo",
      title: "อัพโหลดโลโก้บริษัท",
      desc: "ใช้บนเอกสารต่างๆ เช่น ใบเสนอราคา ใบกำกับภาษี",
      href: "/admin/settings",
      done: hasLogo,
      icon: Image,
    },
    {
      id: "machines",
      title: "เพิ่มเครื่อง CNC",
      desc: `ตอนนี้มี ${counts.machines} เครื่อง — ต้องมีอย่างน้อย 1 เครื่องก่อนเริ่มวางแผน`,
      href: "/production/machines",
      done: counts.machines > 0,
      icon: Cpu,
    },
    {
      id: "customers",
      title: "เพิ่มลูกค้า",
      desc: `ตอนนี้มี ${counts.customers} ราย — เพิ่มลูกค้ารายแรกเพื่อเริ่มเสนอราคา`,
      href: "/sales/customers",
      done: counts.customers > 0,
      icon: Users,
    },
    {
      id: "products",
      title: "เพิ่มสินค้า",
      desc: `ตอนนี้มี ${counts.products} ชิ้น — สร้างสินค้าและ BOM`,
      href: "/production/products",
      done: counts.products > 0,
      icon: Package,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  async function handleComplete() {
    setCompleting(true);
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      if (res.ok) {
        router.push("/dashboard");
      }
    } finally {
      setCompleting(false);
    }
  }

  const trialDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold mb-2">ยินดีต้อนรับสู่ WorkinFlow MOM</h1>
        <p className="text-muted-foreground">
          {tenantName} — แผน <span className="font-medium text-foreground">{planName}</span>
          {trialDate && <> • ทดลองใช้ฟรีถึง {trialDate}</>}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">ความคืบหน้า</span>
          <span className="text-sm text-muted-foreground">
            {doneCount} / {steps.length}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            className="group flex items-start gap-4 rounded-xl border bg-card p-4 hover:border-primary/50 hover:bg-muted/30 transition"
          >
            <div className="shrink-0 mt-0.5">
              {step.done ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <step.icon className="h-4 w-4 text-muted-foreground" />
                <div className="font-medium">{step.title}</div>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{step.desc}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition" />
          </Link>
        ))}
      </div>

      {/* Preset users info */}
      <div className="mb-6 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-primary" />
          <div className="font-medium text-sm">ผู้ใช้งานถูกสร้างไว้ล่วงหน้าแล้ว</div>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          เราสร้างบัญชีสำหรับทุกตำแหน่งไว้ให้แล้ว — manager, planner, sales, operator, qc, accounting
          <br />
          <span className="text-xs">
            รหัสผ่านเริ่มต้น: <code className="rounded bg-background px-1.5 py-0.5 font-mono">changeme123</code>
            {" "}— ให้ admin เข้าไปเปลี่ยนอีเมล/รหัสแล้วส่งให้ทีมงาน
          </span>
        </p>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
        >
          จัดการผู้ใช้งาน <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Complete button */}
      <div className="flex gap-3">
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex-1 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-blue-600 transition disabled:opacity-60 gap-2"
        >
          {allDone ? "ไปที่ Dashboard" : "ข้ามและไปที่ Dashboard"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {onboardedAt && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          onboarding ทำเสร็จแล้วเมื่อ {new Date(onboardedAt).toLocaleDateString("th-TH")}
        </p>
      )}
    </div>
  );
}
