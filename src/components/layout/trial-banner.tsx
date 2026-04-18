"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";

/** Banner shown at the top when tenant is on trial or trial is expiring soon */
export function TrialBanner() {
  const { tenant, loading } = usePlan();
  if (loading || !tenant) return null;

  // Suspended / cancelled → show critical banner
  if (tenant.status === "SUSPENDED") {
    return (
      <div className="bg-red-500 text-white text-sm px-6 py-2 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span className="font-medium">บัญชีถูกระงับ —</span>
        <span>กรุณาติดต่อผู้ดูแลระบบ</span>
      </div>
    );
  }

  // Trial → show countdown
  if (tenant.status === "TRIAL" && tenant.trialDaysLeft !== null) {
    const days = tenant.trialDaysLeft;
    const urgent = days <= 3;
    const warn = days <= 7;

    return (
      <div
        className={`text-sm px-6 py-2 flex items-center justify-between gap-2 ${
          urgent
            ? "bg-red-500 text-white"
            : warn
              ? "bg-yellow-500 text-white"
              : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
        }`}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>
            <span className="font-medium">ทดลองใช้ฟรี</span> — เหลืออีก{" "}
            <span className="font-bold">{days}</span> วัน
          </span>
        </div>
        <Link
          href="/th/admin/billing/upgrade"
          className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
            urgent || warn
              ? "bg-white/20 hover:bg-white/30"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Upgrade <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return null;
}
