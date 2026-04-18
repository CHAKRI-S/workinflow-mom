"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Factory, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface InvitePreview {
  email: string;
  name: string | null;
  role: string;
  companyName: string;
  invitedByName: string;
  expiresAt: string;
}

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token } = use(params);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ loginUrl: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invites/${token}`);
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error || "Invite not valid");
        } else {
          setInvite(data);
        }
      } catch {
        setLoadError("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");

    if (password !== confirm) {
      setError("รหัสผ่านยืนยันไม่ตรงกัน");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setSubmitting(false);
        return;
      }
      setDone({ loginUrl: data.loginUrl });
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-sm text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="font-semibold mb-2">Invite ใช้ไม่ได้</h2>
          <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
          <Link href="/login" className="text-sm text-primary hover:underline">
            ไปหน้า Login
          </Link>
        </div>
      </div>
    );
  }

  if (done && invite) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="font-semibold mb-2">เข้าร่วมเรียบร้อย!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            บัญชี {invite.email} พร้อมใช้งานแล้ว ({invite.companyName})
          </p>
          <a
            href={done.loginUrl}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-blue-600"
          >
            เข้าสู่ระบบ
          </a>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border bg-card p-6">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Factory className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">คุณถูกเชิญเข้า {invite.companyName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            โดย {invite.invitedByName} • ตำแหน่ง {invite.role}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">อีเมล</label>
            <input
              value={invite.email}
              disabled
              className="h-10 w-full rounded-lg border bg-muted px-3 text-sm text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">ชื่อ</label>
            <input
              id="name"
              name="name"
              defaultValue={invite.name ?? ""}
              required
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">รหัสผ่าน (อย่างน้อย 8 ตัว)</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-blue-600 disabled:opacity-60 gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            เข้าร่วม {invite.companyName}
          </button>
        </form>
      </div>
    </div>
  );
}
