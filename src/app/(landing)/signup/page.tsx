"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Factory, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  BusinessInfoSection,
  type BusinessInfoValue,
} from "@/components/forms/business-info-section";

interface SignupResponse {
  success?: boolean;
  error?: string;
  message?: string;
  loginUrl?: string;
  tenantId?: string;
  trialEndsAt?: string;
}

const EMPTY_BUSINESS: BusinessInfoValue = {
  juristicType: "",
  taxId: "",
  branchNo: "00000",
  name: "",
  address: "",
  country: "TH",
};

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SignupResponse | null>(null);
  const [business, setBusiness] = useState<BusinessInfoValue>(EMPTY_BUSINESS);

  const patchBusiness = (patch: Partial<BusinessInfoValue>) =>
    setBusiness((prev) => ({ ...prev, ...patch }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      // Company info comes from BusinessInfoSection state
      companyName: business.name.trim(),
      taxId: business.taxId.trim() || undefined,
      juristicType: business.juristicType || undefined,
      branchNo: business.branchNo || "00000",
      country: business.country || "TH",
      billingAddress: business.address.trim() || undefined,
      adminName: String(fd.get("adminName") || "").trim(),
      adminEmail: String(fd.get("adminEmail") || "")
        .trim()
        .toLowerCase(),
      adminPassword: String(fd.get("adminPassword") || ""),
      phone: String(fd.get("phone") || "").trim() || undefined,
      acceptTerms: fd.get("acceptTerms") === "on",
    };

    if (!payload.companyName) {
      setError("กรุณากรอกชื่อบริษัท");
      setLoading(false);
      return;
    }

    if (payload.adminPassword !== String(fd.get("confirmPassword") || "")) {
      setError("รหัสผ่านยืนยันไม่ตรงกัน");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: SignupResponse = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "เกิดข้อผิดพลาดในการสมัคร");
        setLoading(false);
        return;
      }

      setSuccess(data);
      setLoading(false);

      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        if (data.loginUrl) {
          window.location.href = data.loginUrl;
        } else {
          router.push("/");
        }
      }, 3000);
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      setLoading(false);
    }
  }

  // Success screen
  if (success) {
    const trialDate = success.trialEndsAt
      ? new Date(success.trialEndsAt).toLocaleDateString("th-TH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    return (
      <div className="container mx-auto max-w-lg px-4 py-20">
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">สมัครสำเร็จ!</h1>
          <p className="text-muted-foreground mb-1">
            บัญชีของคุณพร้อมใช้งานแล้ว
          </p>
          {trialDate && (
            <p className="text-sm text-muted-foreground mb-6">
              ทดลองใช้ฟรีถึง {trialDate}
            </p>
          )}
          <div className="rounded-lg bg-muted p-4 text-sm text-left mb-6">
            <div className="font-semibold mb-2">ข้อมูลการเข้าใช้งาน:</div>
            <div className="text-muted-foreground">
              • URL:{" "}
              <span className="font-mono text-foreground">
                mom.workinflow.cloud
              </span>
              <br />• ใช้อีเมลและรหัสผ่านที่สมัครไว้เพื่อ login
              <br />• หลังเข้าสู่ระบบครั้งแรก คุณสามารถเชิญทีมงานเพิ่มเติมได้ที่หน้า
              User Management
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            กำลังพาไปหน้า Login ใน 3 วินาที...
          </p>
          {success.loginUrl && (
            <a
              href={success.loginUrl}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-blue-600 transition"
            >
              ไปที่หน้า Login
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
          <Factory className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold">เริ่มใช้ WorkinFlow MOM</h1>
        <p className="text-muted-foreground mt-2">
          ทดลองใช้ฟรี 30 วัน ไม่ต้องใส่บัตรเครดิต
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Business Info */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="text-sm font-semibold text-muted-foreground">
            ข้อมูลบริษัท / นิติบุคคล
          </div>
          <BusinessInfoSection
            value={business}
            onChange={patchBusiness}
            onAutoFill={patchBusiness}
            nameLabel="ชื่อบริษัท"
            namePlaceholder="บริษัท ○○○ จำกัด"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              label="เบอร์โทร"
              name="phone"
              placeholder="02-xxx-xxxx"
            />
          </div>
        </div>

        {/* Admin */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="text-sm font-semibold text-muted-foreground">
            บัญชีผู้ดูแลระบบ (Admin)
          </div>
          <Field
            label="ชื่อ-นามสกุล *"
            name="adminName"
            required
            placeholder="ชื่อของคุณ"
          />
          <Field
            label="อีเมล *"
            name="adminEmail"
            type="email"
            required
            placeholder="you@company.com"
            autoComplete="email"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              label="รหัสผ่าน *"
              name="adminPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="อย่างน้อย 8 ตัว"
            />
            <Field
              label="ยืนยันรหัสผ่าน *"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>

        {/* Terms */}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            className="mt-0.5 h-4 w-4"
            required
          />
          <span className="text-muted-foreground">
            ฉันยอมรับ{" "}
            <Link href="/terms" className="text-primary hover:underline">
              เงื่อนไขการใช้งาน
            </Link>{" "}
            และ{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              นโยบายความเป็นส่วนตัว
            </Link>
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-blue-600 transition disabled:opacity-60 gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "กำลังสร้างบัญชี..." : "สมัครใช้งานฟรี"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          มีบัญชีแล้ว?{" "}
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL || "https://mom.workinflow.cloud"}/th/login`}
            className="text-primary hover:underline font-medium"
          >
            เข้าสู่ระบบ
          </a>
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  minLength,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        autoComplete={autoComplete}
        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    </div>
  );
}
