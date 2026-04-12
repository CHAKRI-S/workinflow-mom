import { Role } from "@/generated/prisma/client";
import { Session } from "next-auth";

export function checkPermission(
  session: Session | null,
  allowedRoles: Role[]
): boolean {
  if (!session?.user) return false;
  return allowedRoles.includes(session.user.role);
}

export function requirePermission(
  session: Session | null,
  allowedRoles: Role[]
): void {
  if (!checkPermission(session, allowedRoles)) {
    throw new Error("Unauthorized");
  }
}

// Role groups for common use
export const ROLES = {
  ALL: [
    Role.ADMIN,
    Role.MANAGER,
    Role.PLANNER,
    Role.SALES,
    Role.OPERATOR,
    Role.QC,
    Role.ACCOUNTING,
  ] as Role[],
  MANAGEMENT: [Role.ADMIN, Role.MANAGER] as Role[],
  PLANNING: [Role.ADMIN, Role.MANAGER, Role.PLANNER] as Role[],
  SALES_TEAM: [Role.ADMIN, Role.MANAGER, Role.SALES] as Role[],
  FINANCE: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTING, Role.SALES] as Role[],
  PRODUCTION: [
    Role.ADMIN,
    Role.MANAGER,
    Role.PLANNER,
    Role.OPERATOR,
  ] as Role[],
  QUALITY: [Role.ADMIN, Role.MANAGER, Role.QC] as Role[],
  ADMIN_ONLY: [Role.ADMIN] as Role[],
};
