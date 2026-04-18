import { prisma } from "@/lib/prisma";
import type { BillingCycle } from "@/generated/prisma/client";

export const VAT_RATE = 0.07; // 7% Thai VAT

/** Calculate subscription amounts (in satang) */
export function calculateAmounts(params: {
  priceMonthlySatang: number;
  priceYearlySatang: number;
  billingCycle: BillingCycle;
  discountSatang?: number;
}) {
  const base =
    params.billingCycle === "YEARLY"
      ? params.priceYearlySatang
      : params.priceMonthlySatang;
  const discount = params.discountSatang ?? 0;
  const afterDiscount = Math.max(0, base - discount);
  const vat = Math.round(afterDiscount * VAT_RATE);
  const total = afterDiscount + vat;
  return {
    amountSatang: base,
    discountSatang: discount,
    vatSatang: vat,
    totalSatang: total,
  };
}

/** Compute period dates for a subscription */
export function computePeriod(billingCycle: BillingCycle, start: Date = new Date()) {
  const end = new Date(start);
  if (billingCycle === "YEARLY") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return { periodStart: start, periodEnd: end };
}

/** Mark a subscription as active (after successful payment) */
export async function activateSubscription(params: {
  subscriptionId: string;
  omiseChargeId?: string;
  gatewayRef?: string;
  slipVerifiedAt?: Date;
  slipUrl?: string;
}) {
  const sub = await prisma.subscription.update({
    where: { id: params.subscriptionId },
    data: {
      status: "ACTIVE",
      omiseChargeId: params.omiseChargeId,
      gatewayRef: params.gatewayRef,
      slipVerifiedAt: params.slipVerifiedAt,
      slipUrl: params.slipUrl,
    },
    include: { plan: true, tenant: true },
  });

  // Update tenant status + plan
  await prisma.tenant.update({
    where: { id: sub.tenantId },
    data: {
      status: "ACTIVE",
      planId: sub.planId,
    },
  });

  return sub;
}
