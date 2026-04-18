"use client";

import { useState, use } from "react";
import Link from "next/link";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = use(searchParams);
  const token = sp.token ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");

    if (password !== confirm) {
      setError("รหัสผ่านยืนยันไม่ตรงกัน");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "รีเซ็ตไม่สำเร็จ");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="font-semibold mb-2">ลิงก์ไม่ถูกต้อง</h2>
          <p className="text-sm text-muted-foreground mb-4">ไม่พบ token ในลิงก์</p>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            ขอลิงก์ใหม่
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="font-semibold mb-2">ตั้งรหัสผ่านใหม่สำเร็จ</h2>
          <Link
            href="/login"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border bg-card p-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-center mb-6">ตั้งรหัสผ่านใหม่</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">รหัสผ่านใหม่</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">ยืนยันรหัสผ่าน</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
          </button>
        </form>
      </div>
    </div>
  );
}
