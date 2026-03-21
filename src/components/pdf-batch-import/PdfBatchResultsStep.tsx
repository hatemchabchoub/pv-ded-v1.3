import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { PdfFileEntry } from "@/lib/pdf-batch-import";

interface ImportResult {
  fileId: string;
  status: "success" | "skipped" | "error";
  error?: string;
}

interface Props {
  entries: PdfFileEntry[];
  results: ImportResult[];
  progress: number;
  total: number;
  importing: boolean;
  onReset: () => void;
}

export default function PdfBatchResultsStep({ entries, results, progress, total, importing, onReset }: Props) {
  if (importing) {
    return (
      <div className="surface-elevated p-8 flex flex-col items-center gap-4">
        <p className="font-medium">جاري إنشاء المحاضر…</p>
        <Progress value={total > 0 ? (progress / total) * 100 : 0} className="w-full max-w-md" />
        <p className="text-sm text-muted-foreground">{progress} / {total} محضر</p>
      </div>
    );
  }

  const successCount = results.filter(r => r.status === "success").length;
  const skippedCount = results.filter(r => r.status === "skipped").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="surface-elevated p-4 border-s-2 border-s-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-medium">ناجح</span>
          </div>
          <p className="text-2xl font-semibold font-mono mt-1">{successCount}</p>
        </div>
        <div className="surface-elevated p-4 border-s-2 border-s-accent">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">تم تجاوزه</span>
          </div>
          <p className="text-2xl font-semibold font-mono mt-1">{skippedCount}</p>
        </div>
        <div className="surface-elevated p-4 border-s-2 border-s-destructive">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">أخطاء</span>
          </div>
          <p className="text-2xl font-semibold font-mono mt-1">{errorCount}</p>
        </div>
      </div>

      {results.some(r => r.status !== "success") && (
        <div className="surface-elevated overflow-auto max-h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>الملف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results
                .filter(r => r.status !== "success")
                .map((r, i) => {
                  const entry = entries.find(e => e.id === r.fileId);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]">{entry?.file.name || r.fileId}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-sm ${
                          r.status === "skipped" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                        }`}>
                          {r.status === "skipped" ? "تم التجاوز" : "خطأ"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.error}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      )}

      <Button variant="outline" onClick={onReset}>
        <RotateCcw className="h-4 w-4" />استيراد جديد
      </Button>
    </div>
  );
}
