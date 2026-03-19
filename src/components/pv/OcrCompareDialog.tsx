import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload, FileText, Loader2, CheckCircle2, ArrowLeftRight, Shield, Replace, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FieldDiff {
  field: string;
  label: string;
  currentValue: string;
  extractedValue: string;
  confidence: number;
  status: "different" | "empty_fill" | "same" | "new";
  accepted: boolean;
}

interface OcrCompareDialogProps {
  currentData: {
    pv_number: string;
    pv_date: string;
    department_name: string;
    officer_name: string;
    referral_type: string;
    pv_type: string;
    notes: string;
    offenders: { name_or_company: string; identifier: string; person_type: string; city: string }[];
    violations: { violation_label: string; violation_category: string; legal_basis: string }[];
    seizures: { goods_category: string; goods_type: string; quantity: string; unit: string; estimated_value: string; seizure_type: string }[];
  };
  onApply: (data: Record<string, any>) => void;
}

const FIELD_LABELS: Record<string, string> = {
  pv_number: "عدد المحضر",
  pv_date: "التاريخ",
  department_name: "القسم",
  officer_name: "الضابط",
  officer_badge: "رقم الشارة",
  officer_rank: "الرتبة",
  referral_type: "طبيعة الإحالة",
  referral_source: "مصدر الإحالة",
  pv_type: "نوع الوثيقة",
  customs_violation: "مخالفة ديوانية",
  currency_violation: "مخالفة صرفية",
  public_law_violation: "حق عام",
  seizure_renewal: "تجديد حجز",
  total_actual_seizure: "المحجوز الفعلي",
  total_virtual_seizure: "المحجوز الصوري",
  total_precautionary_seizure: "المحجوز التحفظي",
  notes: "ملاحظات",
};

const COMPARABLE_FIELDS = [
  "pv_number", "pv_date", "department_name", "officer_name",
  "referral_type", "pv_type", "notes",
  "customs_violation", "currency_violation", "public_law_violation",
  "total_actual_seizure", "total_virtual_seizure", "total_precautionary_seizure",
];

type Stage = "idle" | "uploading" | "processing" | "comparing";

const OcrCompareDialog = ({ currentData, onApply }: OcrCompareDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [diffs, setDiffs] = useState<FieldDiff[]>([]);
  const [extractedArrays, setExtractedArrays] = useState<{
    offenders?: any[];
    violations?: any[];
    seizures?: any[];
  }>({});
  const [overallConfidence, setOverallConfidence] = useState(0);
  const [acceptArrays, setAcceptArrays] = useState<Record<string, boolean>>({});

  const buildDiffs = (extracted: any, confidence: any): FieldDiff[] => {
    const result: FieldDiff[] = [];
    for (const field of COMPARABLE_FIELDS) {
      const extractedVal = extracted[field];
      if (extractedVal === null || extractedVal === undefined) continue;
      const extractedStr = String(extractedVal);
      const currentVal = String((currentData as any)[field] || "");
      const conf = confidence[field] || 50;

      if (!currentVal && extractedStr) {
        result.push({ field, label: FIELD_LABELS[field] || field, currentValue: currentVal, extractedValue: extractedStr, confidence: conf, status: "empty_fill", accepted: true });
      } else if (currentVal !== extractedStr && extractedStr) {
        result.push({ field, label: FIELD_LABELS[field] || field, currentValue: currentVal, extractedValue: extractedStr, confidence: conf, status: "different", accepted: false });
      }
    }
    return result;
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("صيغة غير مدعومة. استخدم PDF أو JPG أو PNG.");
      return;
    }

    setStage("uploading");
    setFileName(file.name);

    try {
      const storagePath = `ocr-imports/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("pv-attachments")
        .upload(storagePath, file);
      if (uploadErr) throw uploadErr;

      const { data: importRec, error: importErr } = await supabase
        .from("document_imports")
        .insert({
          import_type: "pdf",
          source_file_name: file.name,
          storage_path: storagePath,
          uploaded_by: user.id,
          status: "pending",
        })
        .select("id")
        .single();
      if (importErr) throw importErr;

      setStage("processing");

      const { data: extractResult, error: extractErr } = await supabase.functions.invoke("ocr-extract", {
        body: { import_id: importRec.id },
      });

      if (extractErr) throw new Error(extractErr.message);
      if (extractResult?.error) throw new Error(extractResult.error);

      const extracted = extractResult.extracted || {};
      const confidence = extractResult.confidence || {};
      setOverallConfidence(extractResult.overall_confidence || 50);

      const fieldDiffs = buildDiffs(extracted, confidence);
      setDiffs(fieldDiffs);

      // Handle arrays
      const arrays: any = {};
      const arrayAccept: Record<string, boolean> = {};
      if (extracted.offenders?.length) {
        arrays.offenders = extracted.offenders;
        arrayAccept.offenders = currentData.offenders.length === 0;
      }
      if (extracted.violations?.length) {
        arrays.violations = extracted.violations;
        arrayAccept.violations = currentData.violations.length === 0;
      }
      if (extracted.seizures?.length) {
        arrays.seizures = extracted.seizures;
        arrayAccept.seizures = currentData.seizures.length === 0;
      }
      setExtractedArrays(arrays);
      setAcceptArrays(arrayAccept);

      setStage("comparing");
      toast.success(`اكتمل التحليل — الثقة: ${extractResult.overall_confidence}%`);
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || "خطأ غير معروف"));
      setStage("idle");
    }
  }, [user, currentData]);

  const toggleDiff = (index: number) => {
    setDiffs(prev => prev.map((d, i) => i === index ? { ...d, accepted: !d.accepted } : d));
  };

  const toggleArray = (key: string) => {
    setAcceptArrays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = () => {
    const result: Record<string, any> = {};
    for (const diff of diffs) {
      if (diff.accepted) {
        result[diff.field] = diff.extractedValue;
      }
    }
    if (acceptArrays.offenders && extractedArrays.offenders) {
      result.offenders = extractedArrays.offenders;
    }
    if (acceptArrays.violations && extractedArrays.violations) {
      result.violations = extractedArrays.violations;
    }
    if (acceptArrays.seizures && extractedArrays.seizures) {
      result.seizures = extractedArrays.seizures;
    }
    onApply(result);
    setOpen(false);
    setStage("idle");
    setDiffs([]);
    setExtractedArrays({});
    toast.success("تم تطبيق البيانات المستخرجة");
  };

  const acceptedCount = diffs.filter(d => d.accepted).length + Object.values(acceptArrays).filter(Boolean).length;
  const totalChanges = diffs.length + Object.keys(extractedArrays).length;

  const confColor = (score: number) => {
    if (score >= 80) return "text-primary";
    if (score >= 50) return "text-amber-500";
    return "text-destructive";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setStage("idle"); setDiffs([]); setExtractedArrays({}); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4" />
          PDF / OCR استيراد
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            استيراد وثيقة PDF — مقارنة مع البيانات الحالية
          </DialogTitle>
        </DialogHeader>

        {/* Upload */}
        {stage === "idle" && (
          <div className="p-8 flex flex-col items-center gap-4 border-2 border-dashed border-border rounded-lg">
            <div className="p-4 bg-primary/10 rounded-full">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              قم بتحميل ملف PDF أو صورة — سيتم مقارنة البيانات المستخرجة مع المحضر الحالي
            </p>
            <label className="cursor-pointer">
              <Button asChild>
                <span>
                  <Upload className="h-4 w-4" />
                  اختيار ملف
                </span>
              </Button>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Processing */}
        {(stage === "uploading" || stage === "processing") && (
          <div className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="font-medium">
              {stage === "uploading" ? "جاري التحميل..." : "جاري التحليل بالذكاء الاصطناعي..."}
            </p>
            <p className="text-sm text-muted-foreground">{fileName}</p>
            <Progress value={stage === "uploading" ? 30 : 65} className="w-full max-w-sm" />
          </div>
        )}

        {/* Comparing */}
        {stage === "comparing" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className={cn("h-5 w-5", confColor(overallConfidence))} />
                <span className="text-sm">
                  الثقة الإجمالية: <strong className={confColor(overallConfidence)}>{overallConfidence}%</strong>
                </span>
                <Badge variant="outline">{totalChanges} تغيير محتمل</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{acceptedCount}/{totalChanges} مقبول</span>
            </div>

            {diffs.length === 0 && Object.keys(extractedArrays).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-primary" />
                <p>لا توجد اختلافات — البيانات متطابقة</p>
              </div>
            )}

            {/* Scalar field diffs */}
            {diffs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">الحقول</h3>
                {diffs.map((diff, i) => (
                  <div
                    key={diff.field}
                    className={cn(
                      "border rounded-lg p-3 transition-colors cursor-pointer",
                      diff.accepted ? "border-primary/40 bg-primary/5" : "border-border",
                      diff.status === "empty_fill" && "border-emerald-500/40 bg-emerald-500/5"
                    )}
                    onClick={() => toggleDiff(i)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{diff.label}</span>
                        {diff.status === "empty_fill" && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                            <Plus className="h-3 w-3" /> حقل فارغ
                          </Badge>
                        )}
                        {diff.status === "different" && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
                            <ArrowLeftRight className="h-3 w-3" /> مختلف
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", confColor(diff.confidence))}>
                          {diff.confidence}%
                        </span>
                        <Button
                          variant={diff.accepted ? "default" : "outline"}
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={(e) => { e.stopPropagation(); toggleDiff(i); }}
                        >
                          {diff.accepted ? <CheckCircle2 className="h-3 w-3" /> : <Replace className="h-3 w-3" />}
                          {diff.accepted ? "مقبول" : "استبدال"}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-0.5">القيمة الحالية</span>
                        <div className={cn(
                          "px-2 py-1 rounded text-sm min-h-[28px]",
                          diff.currentValue ? "bg-muted" : "bg-muted/50 text-muted-foreground italic"
                        )}>
                          {diff.currentValue || "— فارغ —"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-0.5">القيمة المستخرجة</span>
                        <div className={cn(
                          "px-2 py-1 rounded text-sm font-medium min-h-[28px]",
                          diff.status === "empty_fill"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        )}>
                          {diff.extractedValue}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Array diffs */}
            {Object.entries(extractedArrays).map(([key, items]) => {
              if (!items?.length) return null;
              const existing = (currentData as any)[key] || [];
              const isEmpty = existing.length === 0;
              const accepted = acceptArrays[key];
              const labelMap: Record<string, string> = { offenders: "المخالفون", violations: "المخالفات", seizures: "المحجوزات" };

              return (
                <div
                  key={key}
                  className={cn(
                    "border rounded-lg p-3 transition-colors",
                    accepted ? "border-primary/40 bg-primary/5" : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{labelMap[key] || key} ({items.length})</span>
                      {isEmpty ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                          <Plus className="h-3 w-3" /> قائمة فارغة
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
                          <ArrowLeftRight className="h-3 w-3" /> {existing.length} حالي → {items.length} مستخرج
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant={accepted ? "default" : "outline"}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => toggleArray(key)}
                    >
                      {accepted ? <CheckCircle2 className="h-3 w-3" /> : <Replace className="h-3 w-3" />}
                      {accepted ? "مقبول" : (isEmpty ? "ملء" : "استبدال")}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {key === "offenders" && items.map((item: any, i: number) => (
                      <div key={i} className={cn(
                        "px-2 py-1 rounded",
                        isEmpty
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      )}>
                        {item.name_or_company} — {item.identifier || "—"} — {item.city || "—"}
                      </div>
                    ))}
                    {key === "violations" && items.map((item: any, i: number) => (
                      <div key={i} className={cn(
                        "px-2 py-1 rounded",
                        isEmpty
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      )}>
                        {item.violation_label} — {item.violation_category || "—"}
                      </div>
                    ))}
                    {key === "seizures" && items.map((item: any, i: number) => (
                      <div key={i} className={cn(
                        "px-2 py-1 rounded",
                        isEmpty
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      )}>
                        {item.goods_category} / {item.goods_type} — {item.quantity} {item.unit} — {item.estimated_value} د.ت
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Actions */}
            {totalChanges > 0 && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => { setOpen(false); setStage("idle"); }}>
                  إلغاء
                </Button>
                <Button onClick={handleApply} disabled={acceptedCount === 0}>
                  <CheckCircle2 className="h-4 w-4" />
                  تطبيق {acceptedCount} تغيير
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OcrCompareDialog;
