import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { PdfFileEntry } from "@/lib/pdf-batch-import";

interface Props {
  entries: PdfFileEntry[];
  processedCount: number;
}

const statusLabels: Record<PdfFileEntry["status"], string> = {
  pending: "في الانتظار",
  uploading: "جاري الرفع",
  processing: "جاري التحليل",
  extracted: "تم الاستخراج",
  error: "خطأ",
};

export default function PdfProcessingStep({ entries, processedCount }: Props) {
  const total = entries.length;
  const pct = total > 0 ? (processedCount / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="surface-elevated p-6 flex flex-col items-center gap-4">
        <p className="font-medium">جاري تحليل الملفات بالذكاء الاصطناعي…</p>
        <Progress value={pct} className="w-full max-w-md" />
        <p className="text-sm text-muted-foreground">
          {processedCount} / {total} ملف تمت معالجته
        </p>
      </div>

      <div className="surface-elevated p-4 space-y-1 max-h-[400px] overflow-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-sm">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{entry.file.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {entry.status === "extracted" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {entry.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
              {(entry.status === "uploading" || entry.status === "processing") && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              <Badge variant={entry.status === "error" ? "destructive" : entry.status === "extracted" ? "default" : "secondary"} className="text-[10px]">
                {statusLabels[entry.status]}
              </Badge>
              {entry.confidence !== undefined && entry.status === "extracted" && (
                <span className="text-xs text-muted-foreground">{entry.confidence}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
