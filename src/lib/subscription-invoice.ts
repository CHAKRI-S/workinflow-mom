import { prisma } from "@/lib/prisma";
import type { SubscriptionInvoice } from "@/generated/prisma/client";

/**
 * Generate the next platform-wide SubscriptionInvoice number.
 *
 * Format: `INV-YYYYMM-NNNN` (cross-tenant sequence, shared across platform).
 * The sequence resets each calendar month.
 *
 * Uses `prisma.$transaction` with a SERIALIZABLE isolation-like pattern —
 * counts existing invoices for the current month, then pads to 4 digits.
 *
 * NOTE: This is a count-based approach (not a DB sequence). Under high
 * concurrency two simultaneous calls could theoretically collide; the
 * `invoiceNumber` column is `@unique` at the schema level, so a collision
 * would surface as a Prisma error and callers can retry.
 */
export async function generateSubscriptionInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `INV-${yyyy}${mm}-`;

  const count = await prisma.$transaction(async (tx) => {
    return tx.subscriptionInvoice.count({
      where: { invoiceNumber: { startsWith: prefix } },
    });
  });

  const next = count + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/**
 * Create a SubscriptionInvoice for a given subscription.
 *
 * Snapshots tenant name/taxId/address + plan name so later edits to Tenant
 * or Plan don't retroactively change the issued invoice.
 *
 * Typically called from `activateSubscription` after payment completes.
 * Callers should catch/log errors gracefully — failing to generate an
 * invoice should not fail the activation itself.
 */
export async function createSubscriptionInvoice(
  subscriptionId: string
): Promise<SubscriptionInvoice> {
  const sub = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { tenant: true, plan: true },
  });

  const invoiceNumber = await generateSubscriptionInvoiceNumber();

  return prisma.subscriptionInvoice.create({
    data: {
      invoiceNumber,
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      // Snapshots
      tenantName: sub.tenant.name,
      tenantTaxId: sub.tenant.taxId,
      tenantAddress: sub.tenant.address,
      planName: sub.plan.name,
      // Amounts (satang)
      subtotalSatang: sub.amountSatang,
      discountSatang: sub.discountSatang,
      vatSatang: sub.vatSatang,
      totalSatang: sub.totalSatang,
      // Dates
      issueDate: new Date(),
      paidAt: new Date(),
    },
  });
}
