import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnomalyBadgeProps {
  message: string;
  severity?: "low" | "medium" | "high";
  className?: string;
}

export function AnomalyBadge({ message, severity = "medium", className }: AnomalyBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium border",
        "bg-accent/10 text-accent border-accent/20",
        className
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {message}
    </span>
  );
}
