import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, CheckCircle2, XCircle } from "lucide-react";
import type { PdfFileEntry } from "@/lib/pdf-batch-import";

const fmt = (v: number) => new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(v);

interface Props {
  entries: PdfFileEntry[];
  onBack: () => void;
  onImport: () => void;
}

export default function PdfPreviewStep({ entries, onBack, onImport }: Props) {
  const extracted = entries.filter(e => e.status === "extracted");
  const errored = entries.filter(e => e.status === "error");

  return (
    <div className="space-y-4">
      <div className="surface-elevated p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium">{extracted.length} ملف جاهز للاستيراد</p>
          {errored.length > 0 && (
            <p className="text-xs text-destructive">{errored.length} ملف(ات) بها أخطاء</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />رجوع
          </Button>
          <Button size="sm" onClick={onImport} disabled={extracted.length === 0}>
            <Play className="h-4 w-4" />بدء الاستيراد ({extracted.length})
          </Button>
        </div>
      </div>

      {errored.length > 0 && (
        <div className="surface-elevated p-3 border-s-2 border-s-destructive">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />ملفات بها أخطاء
          </p>
          {errored.map(e => (
            <p key={e.id} className="text-xs text-muted-foreground">
              {e.file.name}: {e.error}
            </p>
          ))}
        </div>
      )}

      <div className="surface-elevated overflow-auto max-h-[450px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>الملف</TableHead>
              <TableHead>عدد المحضر</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>المخالف الأول</TableHead>
              <TableHead>المخالفة</TableHead>
              <TableHead className="text-end">المحجوز</TableHead>
              <TableHead>الثقة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {extracted.map((entry, i) => {
              const d = entry.extractedData;
              const totalSeizure = (d?.total_actual_seizure || 0) + (d?.total_virtual_seizure || 0) + (d?.total_precautionary_seizure || 0);
              return (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{entry.file.name}</TableCell>
                  <TableCell className="font-mono text-xs font-medium">{d?.pv_number || "—"}</TableCell>
                  <TableCell className="text-xs">{d?.pv_date || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">
                    {d?.offenders?.[0]?.name_or_company || "—"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">
                    {d?.violations?.[0]?.violation_label || "—"}
                  </TableCell>
                  <TableCell className="text-end font-mono text-xs">
                    {totalSeizure > 0 ? fmt(totalSeizure) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.confidence && entry.confidence >= 70 ? "default" : "secondary"} className="text-[10px]">
                      {entry.confidence || 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
