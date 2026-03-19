import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, AlertTriangle } from "lucide-react";
import type { ExcelPvRow, ValidationError } from "@/lib/excel-mapping";

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(v);

interface PreviewStepProps {
  fileName: string;
  rows: ExcelPvRow[];
  validationErrors: ValidationError[];
  onBack: () => void;
  onImport: () => void;
}

export default function PreviewStep({
  fileName,
  rows,
  validationErrors,
  onBack,
  onImport,
}: PreviewStepProps) {
  const errorRowSet = new Set(validationErrors.map((e) => e.row_index));

  return (
    <div className="space-y-4">
      <div className="surface-elevated p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {rows.length} سطر للاستيراد
            {validationErrors.length > 0 && (
              <span className="text-destructive ms-2">
                · {validationErrors.length} تحذير(ات)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            الربط
          </Button>
          <Button size="sm" onClick={onImport}>
            <Play className="h-4 w-4" />
            بدء الاستيراد
          </Button>
        </div>
      </div>

      {/* Validation warnings */}
      {validationErrors.length > 0 && (
        <div className="surface-elevated p-3 border-s-2 border-s-accent">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">
              تحذيرات التحقق
            </span>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-auto">
            {validationErrors.slice(0, 20).map((err, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                السطر {err.row_index + 1} — {err.field}: {err.message}
              </p>
            ))}
            {validationErrors.length > 20 && (
              <p className="text-xs text-muted-foreground">
                + {validationErrors.length - 20} أخرى…
              </p>
            )}
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="surface-elevated overflow-auto max-h-[450px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>عدد المحضر</TableHead>
              <TableHead>تاريخ</TableHead>
              <TableHead>القسم</TableHead>
              <TableHead>الضابط</TableHead>
              <TableHead>المخالف 1</TableHead>
              <TableHead>المخالفة</TableHead>
              <TableHead className="text-end">المحجوز</TableHead>
              <TableHead>نوع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 50).map((row, i) => (
              <TableRow
                key={i}
                className={errorRowSet.has(i) ? "bg-destructive/5" : ""}
              >
                <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                <TableCell className="font-mono text-xs font-medium">
                  {row.pv_number}
                </TableCell>
                <TableCell className="text-xs">{row.pv_date}</TableCell>
                <TableCell className="text-xs max-w-[120px] truncate">
                  {row.department_name}
                </TableCell>
                <TableCell className="text-xs max-w-[120px] truncate">
                  {row.officer_full?.split("(")[0]?.trim()}
                </TableCell>
                <TableCell className="text-xs max-w-[120px] truncate">
                  {row.offender1_name}
                </TableCell>
                <TableCell className="text-xs max-w-[150px] truncate">
                  {row.violation1}
                </TableCell>
                <TableCell className="text-end font-mono text-xs">
                  {row.total_seizure > 0 ? fmt(row.total_seizure) : "—"}
                </TableCell>
                <TableCell className="text-xs">{row.pv_type}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 50 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t">
            + {rows.length - 50} سطر إضافي
          </div>
        )}
      </div>
    </div>
  );
}
