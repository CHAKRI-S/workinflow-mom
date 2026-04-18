"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // Always show success (don't leak whether email exists)
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="font-semibold mb-2">ส่งอีเมลแล้ว</h2>
          <p className="text-sm text-muted-foreground">
            ถ้าอีเมลนี้มีบัญชีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปแล้ว
            <br />กรุณาตรวจสอบกล่องจดหมาย (อาจอยู่ใน spam)
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> กลับไปหน้า login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border bg-card p-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-center mb-1">ลืมรหัสผ่าน?</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          กรอกอีเมลของคุณ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ต"}
          </button>
        </form>

        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> กลับไปหน้า login
        </Link>
      </div>
    </div>
  );
}
