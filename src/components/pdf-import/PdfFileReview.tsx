import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowRight, Shield, FileText } from "lucide-react";
import type { FileImportItem } from "@/pages/PdfImportPage";

const FIELD_LABELS: Record<string, string> = {
  pv_number: "عدد المحضر",
  pv_date: "التاريخ",
  department_name: "القسم",
  officer_name: "الضابط",
  officer_badge: "الرقم",
  officer_rank: "الرتبة",
  referral_type: "طبيعة الإحالة",
  referral_source: "مصدر الإحالة",
  pv_type: "محضر/ضلع",
  customs_violation: "مخالفة ديوانية",
  currency_violation: "مخالفة صرفية",
  public_law_violation: "حق عام",
  seizure_renewal: "تجديد حجز",
  total_actual_seizure: "المحجوز الفعلي",
  total_virtual_seizure: "المحجوز الصوري",
  total_precautionary_seizure: "المحجوز التحفظي",
  notes: "ملاحظات",
  offenders: "المخالفون",
  violations: "المخالفات",
  seizures: "المحجوزات",
};

const confidenceColor = (score: number) => {
  if (score >= 80) return "bg-primary/10 text-primary border-primary/20";
  if (score >= 50) return "bg-accent/10 text-accent-foreground border-accent/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
};

const confidenceLabel = (score: number) => {
  if (score >= 80) return "عالية";
  if (score >= 50) return "متوسطة";
  return "ضعيفة";
};

interface PdfFileReviewProps {
  fileItem: FileImportItem;
  onEditedValuesChange: (values: Record<string, string>) => void;
  onPrefill: () => void;
}

const PdfFileReview = ({ fileItem, onEditedValuesChange, onPrefill }: PdfFileReviewProps) => {
  const { fieldCandidates, editedValues, overallConfidence, fileName } = fileItem;

  const scalarFields = fieldCandidates.filter(
    (f) => !["offenders", "violations", "seizures"].includes(f.field_name)
  );
  const arrayFields = fieldCandidates.filter((f) =>
    ["offenders", "violations", "seizures"].includes(f.field_name)
  );

  const updateField = (fieldName: string, value: string) => {
    onEditedValuesChange({ ...editedValues, [fieldName]: value });
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="surface-elevated p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              {fieldCandidates.length} حقل مستخرج
            </p>
          </div>
          <div className={`px-3 py-1 rounded-sm text-xs font-medium border ${confidenceColor(overallConfidence)}`}>
            <Shield className="h-3 w-3 inline me-1" />
            الثقة: {overallConfidence}% — {confidenceLabel(overallConfidence)}
          </div>
        </div>
        <Button size="sm" onClick={onPrefill}>
          <ArrowRight className="h-4 w-4" />
          ملء المحضر مسبقا
        </Button>
      </div>

      {/* Scalar fields */}
      <div className="surface-elevated p-6">
        <h2 className="text-sm font-medium mb-4">الحقول المستخرجة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scalarFields.map((field: any) => {
            const conf = field.confidence || 50;
            return (
              <div key={field.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    {FIELD_LABELS[field.field_name] || field.field_name}
                  </Label>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${confidenceColor(conf)}`}>
                    {conf}%
                  </span>
                </div>
                <Input
                  value={editedValues[field.field_name] || ""}
                  onChange={(e) => updateField(field.field_name, e.target.value)}
                  className={conf < 50 ? "border-destructive/30" : ""}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Array fields */}
      {arrayFields.map((field: any) => {
        let items: any[] = [];
        try {
          items = JSON.parse(field.extracted_value || "[]");
        } catch {
          items = [];
        }
        const conf = field.confidence || 50;

        return (
          <div key={field.id} className="surface-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium">
                {FIELD_LABELS[field.field_name] || field.field_name} ({items.length})
              </h2>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${confidenceColor(conf)}`}>
                {conf}%
              </span>
            </div>

            {field.field_name === "offenders" && items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم / الشركة</TableHead>
                    <TableHead>المعرف</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المدينة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.name_or_company || "—"}</TableCell>
                      <TableCell className="font-mono-data text-sm">{item.identifier || "—"}</TableCell>
                      <TableCell>{item.person_type === "physical" ? "شخص طبيعي" : item.person_type === "legal" ? "شخص معنوي" : item.person_type || "—"}</TableCell>
                      <TableCell>{item.city || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {field.field_name === "violations" && items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المخالفة</TableHead>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الأساس القانوني</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{item.violation_label || "—"}</TableCell>
                      <TableCell>{item.violation_category || "—"}</TableCell>
                      <TableCell className="text-xs">{item.legal_basis || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {field.field_name === "seizures" && items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نوع البضاعة</TableHead>
                    <TableHead className="text-end">الكمية</TableHead>
                    <TableHead>الوحدة</TableHead>
                    <TableHead className="text-end">القيمة</TableHead>
                    <TableHead>نوع الحجز</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.goods_type || item.goods_category || "—"}</TableCell>
                      <TableCell className="text-end font-mono-data">{item.quantity || "—"}</TableCell>
                      <TableCell>{item.unit || "—"}</TableCell>
                      <TableCell className="text-end font-mono-data">{item.estimated_value?.toLocaleString() || "—"}</TableCell>
                      <TableCell className="text-xs">{item.seizure_type || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                لم يتم اكتشاف أي عنصر
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PdfFileReview;
