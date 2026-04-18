/**
 * Plan feature enforcement helpers
 *
 * Two use cases:
 * 1. API routes → `requireFeature(tenantId, 'featureMaintenance')` throws if disabled
 * 2. UI → `getTenantPlan(tenantId)` returns plan with features, gate UI by boolean
 */

import { prisma } from "@/lib/prisma";

export type FeatureKey =
  | "featureProduction"
  | "featureFinance"
  | "featureMaintenance"
  | "featureFactoryDashboard"
  | "featureAuditLog"
  | "featurePurchaseOrders"
  | "featureAdvancedReports"
  | "featureExcelExport"
  | "featureCustomBranding"
  | "featureApiAccess"
  | "featureMultiLocation";

/** Load tenant + its plan (cached within the request via Prisma) */
export async function getTenantPlan(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });
}

/**
 * Check if a tenant has a feature enabled.
 * Returns true if no plan (safe default for existing tenants before migration completes).
 */
export async function hasFeature(tenantId: string, feature: FeatureKey): Promise<boolean> {
  const tenant = await getTenantPlan(tenantId);
  if (!tenant?.plan) return true; // legacy tenant without plan → allow everything
  return Boolean(tenant.plan[feature]);
}

/**
 * Throw if the feature is not enabled for this tenant.
 * Use in API routes:
 *   await requireFeature(tenantId, 'featureMaintenance')
 */
export async function requireFeature(tenantId: string, feature: FeatureKey): Promise<void> {
  const enabled = await hasFeature(tenantId, feature);
  if (!enabled) {
    throw new Error(`FEATURE_LOCKED:${feature}`);
  }
}

/**
 * Check if tenant is in a state that allows actions (not suspended / cancelled / trial-expired)
 */
export async function requireActiveTenant(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, trialEndsAt: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  if (tenant.status === "SUSPENDED") throw new Error("TENANT_SUSPENDED");
  if (tenant.status === "CANCELLED") throw new Error("TENANT_CANCELLED");
  if (tenant.status === "TRIAL" && tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
    throw new Error("TRIAL_EXPIRED");
  }
}
