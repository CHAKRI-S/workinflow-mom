export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-green-500/10 text-green-600",
    TRIAL: "bg-yellow-500/10 text-yellow-600",
    SUSPENDED: "bg-red-500/10 text-red-600",
    CANCELLED: "bg-muted text-muted-foreground",
    PENDING: "bg-blue-500/10 text-blue-600",
    EXPIRED: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || "bg-muted"}`}>
      {status}
    </span>
  );
}
