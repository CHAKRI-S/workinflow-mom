"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  onboardedAt: string | null;
}

export interface PlanInfo {
  id: string;
  slug: string;
  tier: string;
  name: string;
  features: {
    production: boolean;
    finance: boolean;
    maintenance: boolean;
    factoryDashboard: boolean;
    auditLog: boolean;
    purchaseOrders: boolean;
    advancedReports: boolean;
    excelExport: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    multiLocation: boolean;
  };
  limits: {
    maxUsers: number;
    maxMachines: number;
    maxCustomers: number;
    maxProducts: number;
    maxWorkOrdersPerMonth: number;
  };
}

export interface TenantContextValue {
  tenant: TenantInfo | null;
  plan: PlanInfo | null;
  loading: boolean;
  /** Check if a feature key is enabled (safe default: true if no plan loaded yet) */
  hasFeature: (feature: keyof PlanInfo["features"]) => boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  plan: null,
  loading: true,
  hasFeature: () => true,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tenant/me");
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setTenant(data.tenant);
          setPlan(data.plan);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasFeature: TenantContextValue["hasFeature"] = (feature) => {
    if (!plan) return true; // default to allow while loading / legacy tenant
    return Boolean(plan.features[feature]);
  };

  return (
    <TenantContext.Provider value={{ tenant, plan, loading, hasFeature }}>
      {children}
    </TenantContext.Provider>
  );
}

export function usePlan(): TenantContextValue {
  return useContext(TenantContext);
}
