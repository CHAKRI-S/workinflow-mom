/**
 * Plan usage limits enforcement
 *
 * Usage: call require*Available(tenantId) BEFORE creating a new resource.
 * Throws "LIMIT_EXCEEDED:<resource>:<limit>" — caller should return 402 Payment Required.
 */

import { prisma } from "@/lib/prisma";
import { getTenantPlan } from "@/lib/plan-features";

export class PlanLimitError extends Error {
  constructor(
    public resource: string,
    public limit: number,
    public current: number,
  ) {
    super(`LIMIT_EXCEEDED:${resource}:${limit}`);
    this.name = "PlanLimitError";
  }
}

/** 0 = unlimited */
function limitReached(current: number, limit: number): boolean {
  if (limit === 0) return false;
  return current >= limit;
}

export async function requireSeatAvailable(tenantId: string): Promise<void> {
  const tenant = await getTenantPlan(tenantId);
  if (!tenant?.plan || tenant.plan.maxUsers === 0) return; // unlimited
  const current = await prisma.user.count({ where: { tenantId, isActive: true } });
  if (limitReached(current, tenant.plan.maxUsers)) {
    throw new PlanLimitError("users", tenant.plan.maxUsers, current);
  }
}

export async function requireMachineAvailable(tenantId: string): Promise<void> {
  const tenant = await getTenantPlan(tenantId);
  if (!tenant?.plan || tenant.plan.maxMachines === 0) return;
  const current = await prisma.cncMachine.count({ where: { tenantId, isActive: true } });
  if (limitReached(current, tenant.plan.maxMachines)) {
    throw new PlanLimitError("machines", tenant.plan.maxMachines, current);
  }
}

export async function requireCustomerAvailable(tenantId: string): Promise<void> {
  const tenant = await getTenantPlan(tenantId);
  if (!tenant?.plan || tenant.plan.maxCustomers === 0) return;
  const current = await prisma.customer.count({ where: { tenantId, isActive: true } });
  if (limitReached(current, tenant.plan.maxCustomers)) {
    throw new PlanLimitError("customers", tenant.plan.maxCustomers, current);
  }
}

export async function requireProductAvailable(tenantId: string): Promise<void> {
  const tenant = await getTenantPlan(tenantId);
  if (!tenant?.plan || tenant.plan.maxProducts === 0) return;
  const current = await prisma.product.count({ where: { tenantId, isActive: true } });
  if (limitReached(current, tenant.plan.maxProducts)) {
    throw new PlanLimitError("products", tenant.plan.maxProducts, current);
  }
}

export async function requireWorkOrderAvailable(tenantId: string): Promise<void> {
  const tenant = await getTenantPlan(tenantId);
  if (!tenant?.plan || tenant.plan.maxWorkOrdersPerMonth === 0) return;

  // Count WOs created this calendar month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const current = await prisma.workOrder.count({
    where: { tenantId, createdAt: { gte: monthStart } },
  });

  if (limitReached(current, tenant.plan.maxWorkOrdersPerMonth)) {
    throw new PlanLimitError("workOrdersPerMonth", tenant.plan.maxWorkOrdersPerMonth, current);
  }
}

/** Helper to convert PlanLimitError into a clean API response */
export function planLimitResponse(err: unknown): Response | null {
  if (err instanceof PlanLimitError) {
    return new Response(
      JSON.stringify({
        error: `คุณใช้งาน ${err.resource} ถึงขีดจำกัดแล้ว (${err.current}/${err.limit}) กรุณาอัพเกรด plan`,
        code: "PLAN_LIMIT_EXCEEDED",
        resource: err.resource,
        limit: err.limit,
        current: err.current,
      }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}
