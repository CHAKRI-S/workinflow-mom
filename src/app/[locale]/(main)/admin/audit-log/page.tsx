import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { ClipboardList, User } from "lucide-react";

interface SearchParams {
  entityType?: string;
  action?: string;
}

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.MANAGEMENT)) return <AccessDenied />;

  const tenantId = session.user.tenantId;
  const sp = await searchParams;

  const where: {
    tenantId: string;
    entityType?: string;
    action?: string;
  } = { tenantId };
  if (sp.entityType) where.entityType = sp.entityType;
  if (sp.action) where.action = sp.action;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Unique entity types and actions for filter dropdowns
  const [entityTypes, actions] = await Promise.all([
    prisma.auditLog
      .findMany({
        where: { tenantId },
        select: { entityType: true },
        distinct: ["entityType"],
        take: 50,
      })
      .then((rows) => rows.map((r) => r.entityType)),
    prisma.auditLog
      .findMany({
        where: { tenantId },
        select: { action: true },
        distinct: ["action"],
        take: 20,
      })
      .then((rows) => rows.map((r) => r.action)),
  ]);

  const actionColor: Record<string, string> = {
    CREATE: "bg-green-500/10 text-green-600",
    UPDATE: "bg-blue-500/10 text-blue-600",
    DELETE: "bg-red-500/10 text-red-600",
    STATUS_CHANGE: "bg-purple-500/10 text-purple-600",
    CANCEL: "bg-orange-500/10 text-orange-600",
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          ประวัติการเปลี่ยนแปลงทุกเอกสารในระบบ (มาตรฐาน ISO 9001)
        </p>
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-3 mb-4">
        <select
          name="entityType"
          defaultValue={sp.entityType ?? ""}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All entity types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={sp.action ?? ""}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-blue-600"
        >
          Filter
        </button>
      </form>

      {/* Logs */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
            ยังไม่มีประวัติ
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => {
              let changes: Record<string, { from: unknown; to: unknown }> | null = null;
              if (log.changes) {
                try {
                  changes = JSON.parse(log.changes);
                } catch {
                  /* ignore */
                }
              }
              return (
                <div key={log.id} className="p-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${actionColor[log.action] || "bg-muted"}`}>
                          {log.action}
                        </span>
                        <span className="font-medium">{log.entityType}</span>
                        {log.entityNumber && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {log.entityNumber}
                          </span>
                        )}
                      </div>
                      {log.reason && (
                        <div className="mt-1 text-xs text-muted-foreground italic">
                          &ldquo;{log.reason}&rdquo;
                        </div>
                      )}
                      {changes && Object.keys(changes).length > 0 && (
                        <div className="mt-2 rounded-lg bg-muted/50 p-2 text-xs font-mono">
                          {Object.entries(changes).map(([field, { from, to }]) => (
                            <div key={field} className="flex gap-2">
                              <span className="text-muted-foreground">{field}:</span>
                              <span className="line-through text-red-500/70">{String(from)}</span>
                              <span className="text-green-600">→ {String(to)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <User className="h-3 w-3" />
                        {log.userName}
                      </div>
                      <div className="mt-0.5">
                        {log.createdAt.toLocaleString("th-TH")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {logs.length === 200 && (
        <p className="mt-4 text-xs text-center text-muted-foreground">
          แสดงสูงสุด 200 รายการ — กรองเพื่อดูรายการเก่ากว่า
        </p>
      )}
    </div>
  );
}
