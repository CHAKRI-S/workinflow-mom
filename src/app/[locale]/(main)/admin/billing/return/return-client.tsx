"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Loader2, Check, AlertCircle, Clock } from "lucide-react";

type SubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

interface StatusResponse {
  status: SubscriptionStatus;
  failureReason?: string;
}

type UiState =
  | { kind: "polling" }
  | { kind: "success" }
  | { kind: "failed"; reason?: string }
  | { kind: "timeout" };

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;
const REDIRECT_AFTER_SUCCESS_MS = 3000;

export function ReturnClient({ subscriptionId }: { subscriptionId: string }) {
  const [state, setState] = useState<UiState>({ kind: "polling" });
  const router = useRouter();
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/billing/subscriptions/${encodeURIComponent(subscriptionId)}/status`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("status fetch failed");
        const data: StatusResponse = await res.json();
        if (cancelled) return;

        if (data.status === "ACTIVE") {
          setState({ kind: "success" });
          return;
        }
        if (
          data.status === "FAILED" ||
          data.status === "CANCELLED" ||
          data.status === "EXPIRED"
        ) {
          setState({ kind: "failed", reason: data.failureReason });
          return;
        }
      } catch {
        // Transient network error — just keep polling until timeout.
      }

      if (Date.now() - startRef.current >= POLL_TIMEOUT_MS) {
        setState({ kind: "timeout" });
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [subscriptionId]);

  // Auto-redirect to /admin/billing 3s after success
  useEffect(() => {
    if (state.kind !== "success") return;
    const t = setTimeout(() => {
      router.push("/admin/billing");
    }, REDIRECT_AFTER_SUCCESS_MS);
    return () => clearTimeout(t);
  }, [state.kind, router]);

  if (state.kind === "polling") {
    return (
      <div className="max-w-md text-center py-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <h1 className="text-2xl font-bold mb-2">กำลังยืนยันการชำระเงิน...</h1>
        <p className="text-sm text-muted-foreground">
          ระบบกำลังตรวจสอบผล 3D Secure จากธนาคารของคุณ กรุณาอย่าปิดหน้านี้
        </p>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="max-w-md text-center py-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">ชำระเงินสำเร็จ</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Subscription ถูกเปิดใช้งานแล้ว ระบบจะพาคุณกลับไปที่หน้า Billing โดยอัตโนมัติ
        </p>
        <Link
          href="/admin/billing"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600"
        >
          ไปยัง Billing
        </Link>
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <div className="max-w-md text-center py-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">ชำระเงินไม่สำเร็จ</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {state.reason ||
            "ธนาคารของคุณปฏิเสธการชำระเงิน — กรุณาลองใช้บัตรใบอื่นหรือช่องทางอื่น"}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/billing/upgrade"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600"
          >
            ลองใหม่
          </Link>
          <Link
            href="/admin/billing"
            className="inline-flex h-10 items-center justify-center rounded-lg border bg-card px-5 text-sm font-medium hover:bg-muted"
          >
            กลับหน้า Billing
          </Link>
        </div>
      </div>
    );
  }

  // timeout
  return (
    <div className="max-w-md text-center py-12">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <Clock className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold mb-2">การยืนยันใช้เวลานานกว่าปกติ</h1>
      <p className="text-sm text-muted-foreground mb-6">
        ระบบยังไม่ได้รับผลการชำระเงินจากธนาคาร — เราจะส่งอีเมลแจ้งคุณทันทีที่ชำระเงินสำเร็จ
      </p>
      <Link
        href="/admin/billing"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-blue-600"
      >
        กลับหน้า Billing
      </Link>
    </div>
  );
}
