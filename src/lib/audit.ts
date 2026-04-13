import { prisma } from "@/lib/prisma";

interface AuditParams {
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "CANCEL";
  entityType: string;
  entityId: string;
  entityNumber?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  reason?: string;
  userId: string;
  userName: string;
  tenantId: string;
}

export async function createAuditLog(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityNumber: params.entityNumber || null,
        changes: params.changes ? JSON.stringify(params.changes) : null,
        reason: params.reason || null,
        userId: params.userId,
        userName: params.userName,
        tenantId: params.tenantId,
      },
    });
  } catch (error) {
    // Audit log failure should not break the main operation
    console.error("Audit log error:", error);
  }
}

/** Check if a financial document can be edited (only DRAFT) */
export function canEditDocument(status: string): boolean {
  return status === "DRAFT";
}

/** Check if a document can be cancelled */
export function canCancelDocument(status: string): boolean {
  return status !== "CANCELLED";
}
