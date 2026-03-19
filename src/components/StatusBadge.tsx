import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";

type Status = "draft" | "under_review" | "validated" | "archived";

const statusConfig: Record<Status, { label: string; icon: typeof FileText; className: string }> = {
  draft: {
    label: "مسودة",
    icon: FileText,
    className: "bg-muted text-muted-foreground",
  },
  under_review: {
    label: "قيد المراجعة",
    icon: Clock,
    className: "bg-primary/10 text-primary",
  },
  validated: {
    label: "مصادق عليه",
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
  },
  archived: {
    label: "مؤرشف",
    icon: AlertTriangle,
    className: "bg-muted text-muted-foreground",
  },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium", config.className, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}