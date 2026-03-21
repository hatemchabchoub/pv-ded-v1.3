import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: "default" | "primary" | "warning" | "success";
  className?: string;
}

const variantConfig = {
  default: {
    icon: "bg-muted text-muted-foreground",
    border: "border-transparent hover:border-border",
    glow: "",
  },
  primary: {
    icon: "bg-primary/10 text-primary",
    border: "border-primary/20 hover:border-primary/40",
    glow: "hover:shadow-primary/10",
  },
  warning: {
    icon: "bg-accent/10 text-accent-foreground",
    border: "border-accent/20 hover:border-accent/40",
    glow: "hover:shadow-accent/10",
  },
  success: {
    icon: "bg-success/10 text-success",
    border: "border-success/20 hover:border-success/40",
    glow: "hover:shadow-success/10",
  },
};

export function KpiCard({ label, value, icon: Icon, trend, variant = "default", className }: KpiCardProps) {
  const v = variantConfig[variant];

  return (
    <div
      className={cn(
        "surface-glass p-5 flex items-start justify-between transition-all duration-300 hover:shadow-lg group cursor-default glow-ring",
        v.border, v.glow, className
      )}
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground font-medium tracking-wide">{label}</p>
        <p className="text-[clamp(0.85rem,2.5vw,1.25rem)] font-bold font-mono-data tracking-tight whitespace-nowrap leading-tight">{value}</p>
        {trend && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            {trend}
          </p>
        )}
      </div>
      <div className={cn(
        "p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
        v.icon
      )}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}