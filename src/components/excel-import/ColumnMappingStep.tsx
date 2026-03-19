import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Check, RotateCcw, Zap } from "lucide-react";
import type { ColumnMapping } from "@/lib/excel-mapping";
import { DB_FIELDS } from "@/lib/excel-mapping";

interface ColumnMappingStepProps {
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  mappings: ColumnMapping[];
  sampleData: Record<string, any>[];
  onMappingChange: (index: number, dbField: string | null) => void;
  onSheetChange: (sheetIndex: number) => void;
  onConfirm: () => void;
  onReset: () => void;
}

export default function ColumnMappingStep({
  fileName,
  sheetName,
  sheetNames,
  mappings,
  sampleData,
  onMappingChange,
  onSheetChange,
  onConfirm,
  onReset,
}: ColumnMappingStepProps) {
  const mappedCount = mappings.filter((m) => m.dbField).length;
  const autoCount = mappings.filter((m) => m.autoDetected && m.dbField).length;
  const requiredMapped = DB_FIELDS.filter((f) => f.required).every((f) =>
    mappings.some((m) => m.dbField === f.key)
  );

  // Fields already assigned
  const usedFields = new Set(mappings.map((m) => m.dbField).filter(Boolean));

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="surface-elevated p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              الورقة: {sheetName} · {mappedCount}/{mappings.length} أعمدة مربوطة
              {autoCount > 0 && (
                <span className="ml-1">
                  (<Zap className="inline h-3 w-3 text-primary" /> {autoCount} مكتشفة تلقائيا)
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sheetNames.length > 1 && (
            <Select
              value={sheetName}
              onValueChange={(v) => {
                const idx = sheetNames.indexOf(v);
                if (idx >= 0) onSheetChange(idx);
              }}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sheetNames.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            إلغاء
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={!requiredMapped}>
            <ArrowRight className="h-4 w-4" />
            معاينة
          </Button>
        </div>
      </div>

      {!requiredMapped && (
        <div className="text-xs text-destructive px-1">
          الحقول الإلزامية (عدد المحضر، التاريخ) يجب ربطها للمتابعة.
        </div>
      )}

      {/* Mapping table */}
      <div className="surface-elevated overflow-auto max-h-[520px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead>عنوان Excel</TableHead>
              <TableHead className="w-[50px] text-center">→</TableHead>
              <TableHead>حقل قاعدة البيانات</TableHead>
              <TableHead>معاينة (سطر 1)</TableHead>
              <TableHead className="w-[80px]">الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping, i) => {
              const sampleVal = sampleData[0]?.[mapping.excelHeader];
              return (
                <TableRow key={i} className={mapping.dbField ? "" : "opacity-60"}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="text-sm font-medium" dir="auto">
                    {mapping.excelHeader}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">→</TableCell>
                  <TableCell>
                    <Select
                      value={mapping.dbField || "__skip__"}
                      onValueChange={(v) =>
                        onMappingChange(i, v === "__skip__" ? null : v)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs w-[240px]">
                      <SelectValue placeholder="تجاوز" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__skip__">
                          <span className="text-muted-foreground">— تجاوز —</span>
                        </SelectItem>
                        {DB_FIELDS.map((f) => (
                          <SelectItem
                            key={f.key}
                            value={f.key}
                            disabled={
                              usedFields.has(f.key) && mapping.dbField !== f.key
                            }
                          >
                            {f.label}
                            {f.required && " *"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground max-w-[180px] truncate"
                    dir="auto"
                  >
                    {sampleVal !== undefined && sampleVal !== ""
                      ? String(sampleVal)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {mapping.dbField ? (
                      mapping.autoDetected ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-primary/30 text-primary"
                        >
                          <Zap className="h-3 w-3 mr-0.5" />
                          تلقائي
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-success/30 text-success"
                        >
                          <Check className="h-3 w-3 mr-0.5" />
                          يدوي
                        </Badge>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">تم التجاوز</span>
                    )}
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
