"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Factory } from "lucide-react";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const verified = searchParams.get("verified");
    if (verified === "success") {
      setInfo(t("verifiedSuccess"));
    } else if (verified === "expired") {
      setError(t("verificationExpired"));
      setNeedsVerification(true);
    } else if (verified === "invalid") {
      setError(t("verificationInvalid"));
      setNeedsVerification(true);
    }
  }, [searchParams, t]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsVerification(false);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") || "").trim();
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email: submittedEmail,
      password,
      redirect: false,
    });

    if (result?.error) {
      if (result.code === "email_not_verified") {
        setError(t("emailNotVerified"));
        setNeedsVerification(true);
      } else {
        setError(t("invalidCredentials"));
      }
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function resendVerification() {
    if (!email) return;
    setResending(true);
    setError("");
    setInfo("");

    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setInfo(t("verificationSent"));
      setNeedsVerification(false);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Factory className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">{t("loginTitle")}</CardTitle>
          <CardDescription>{t("loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@workinflow.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>

            {info && (
              <p className="text-sm text-green-600 text-center">{info}</p>
            )}

            {error && (
              <div className="space-y-2 text-center">
                <p className="text-sm text-destructive">{error}</p>
                {needsVerification && (
                  <button
                    type="button"
                    onClick={resendVerification}
                    disabled={resending || !email}
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
                  >
                    {resending ? "..." : t("resendVerification")}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "..." : t("login")}
            </button>

            <div className="text-center">
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline">
                ลืมรหัสผ่าน?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
