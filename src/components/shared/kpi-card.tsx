import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KpiCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {description && (
          <p
            className={cn(
              "text-xs mt-1",
              trend === "up" && "text-green-600 dark:text-green-400",
              trend === "down" && "text-red-600 dark:text-red-400",
              (!trend || trend === "neutral") && "text-muted-foreground"
            )}
          >
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
