import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "destructive";
}

const accentClasses: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export default function KpiCard({ title, value, subtitle, icon: Icon, accent = "primary" }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", accentClasses[accent])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="truncate text-base font-semibold leading-tight">{value}</p>
          {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
