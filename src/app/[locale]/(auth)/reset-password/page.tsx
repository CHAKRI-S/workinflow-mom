"use client";

import { useState, use } from "react";
import Link from "next/link";
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = use(searchParams);
  const token = sp.token ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const passwordLongEnough = password.length >= 8;
  const hasConfirm = confirm.length > 0;
  const passwordsMatch = hasConfirm && password === confirm;
  const canSubmit = passwordLongEnough && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* New password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              รหัสผ่านใหม่
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-10 w-full rounded-lg border bg-background pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && !passwordLongEnough && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <X className="h-3 w-3 text-destructive" />
                ต้องมีอย่างน้อย 8 ตัวอักษร
              </p>
            )}
            {passwordLongEnough && (
              <p className="flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                ความยาวเพียงพอ ({password.length} ตัว)
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">
              ยืนยันรหัสผ่าน
            </label>
            <div className="relative">
              <input
                id="confirm"
                name="confirm"
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="flex h-10 w-full rounded-lg border bg-background pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {hasConfirm && passwordsMatch && (
              <p className="flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                รหัสผ่านตรงกัน
              </p>
            )}
            {hasConfirm && !passwordsMatch && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <X className="h-3 w-3" />
                รหัสผ่านยืนยันไม่ตรงกัน
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
          </button>
        </form>
      </div>
    </div>
  );
}
