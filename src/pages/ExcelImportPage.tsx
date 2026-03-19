import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { parseExcelFile, buildRows, importPvRows } from "@/lib/excel-import";
import type { ParsedExcelFile } from "@/lib/excel-import";
import type { ExcelPvRow, ImportResult, ColumnMapping, ValidationError } from "@/lib/excel-mapping";
import { validateRows } from "@/lib/excel-mapping";
import { toast } from "sonner";

import ExcelUploadStep from "@/components/excel-import/ExcelUploadStep";
import ColumnMappingStep from "@/components/excel-import/ColumnMappingStep";
import PreviewStep from "@/components/excel-import/PreviewStep";
import ImportResultsStep from "@/components/excel-import/ImportResultsStep";

type Stage = "upload" | "mapping" | "preview" | "importing" | "done";

const ExcelImportPage = () => {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("upload");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  // Parsed file state
  const [parsed, setParsed] = useState<ParsedExcelFile | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // Preview & import state
  const [rows, setRows] = useState<ExcelPvRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  // Step 1: File upload
  const handleFileSelected = useCallback(async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    try {
      const result = await parseExcelFile(file);
      setParsed(result);
      setMappings(result.mappings);
      setStage("mapping");

      const autoCount = result.mappings.filter((m) => m.autoDetected && m.dbField).length;
      toast.success(
        `${result.rawRows.length} lignes détectées · ${autoCount} colonnes auto-mappées`
      );
    } catch (err: any) {
      toast.error("خطأ في القراءة: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Step 1b: Switch sheet
  const handleSheetChange = useCallback(
    async (sheetIndex: number) => {
      if (!parsed) return;
      // Re-parse is needed since we stored the File — but we stored rawRows per sheet
      // For simplicity, we'll inform user to re-upload if sheet changes
      // In practice, store the file reference
      toast.info("يرجى إعادة استيراد الملف لتغيير الورقة.");
    },
    [parsed]
  );

  // Step 2: Update a single mapping
  const handleMappingChange = useCallback(
    (index: number, dbField: string | null) => {
      setMappings((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], dbField, autoDetected: false };
        return next;
      });
    },
    []
  );

  // Step 2 → 3: Confirm mapping, build preview
  const handleConfirmMapping = useCallback(() => {
    if (!parsed) return;
    const built = buildRows(parsed.rawRows, mappings);
    const errors = validateRows(built);
    setRows(built);
    setValidationErrors(errors);
    setStage("preview");
  }, [parsed, mappings]);

  // Step 3 → 4: Launch import
  const handleImport = useCallback(async () => {
    if (!user) return;
    setStage("importing");
    setTotal(rows.length);

    const importResults = await importPvRows(rows, user.id, (current, t) => {
      setProgress(current);
      setTotal(t);
    });

    setResults(importResults);
    setStage("done");

    const s = importResults.filter((r) => r.status === "success").length;
    const e = importResults.filter((r) => r.status === "error").length;
    const sk = importResults.filter((r) => r.status === "skipped").length;
    toast.success(`اكتمل الاستيراد: ${s} ناجح، ${sk} تم تجاوزه، ${e} أخطاء`);
  }, [rows, user]);

  // Reset
  const handleReset = useCallback(() => {
    setStage("upload");
    setParsed(null);
    setMappings([]);
    setRows([]);
    setResults([]);
    setValidationErrors([]);
    setProgress(0);
    setFileName("");
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">استيراد Excel</h1>
        <p className="text-sm text-muted-foreground">
          استيراد بيانات المحاضر من ملفات Excel (.xlsx, .xlsm) مع
          ربط تفاعلي للأعمدة
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {["الملف", "الربط", "معاينة", "استيراد"].map((label, i) => {
          const stageOrder = ["upload", "mapping", "preview", "importing"];
          const currentIdx = stageOrder.indexOf(
            stage === "done" ? "importing" : stage
          );
          const isActive = i <= currentIdx;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-px ${isActive ? "bg-primary" : "bg-border"}`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground"
                }`}
              >
                <span className="w-4 h-4 rounded-full border text-[10px] flex items-center justify-center font-mono">
                  {i + 1}
                </span>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {stage === "upload" && (
        <ExcelUploadStep onFileSelected={handleFileSelected} loading={loading} />
      )}

      {stage === "mapping" && parsed && (
        <ColumnMappingStep
          fileName={fileName}
          sheetName={parsed.sheetName}
          sheetNames={parsed.sheetNames}
          mappings={mappings}
          sampleData={parsed.rawRows.slice(0, 3)}
          onMappingChange={handleMappingChange}
          onSheetChange={handleSheetChange}
          onConfirm={handleConfirmMapping}
          onReset={handleReset}
        />
      )}

      {stage === "preview" && (
        <PreviewStep
          fileName={fileName}
          rows={rows}
          validationErrors={validationErrors}
          onBack={() => setStage("mapping")}
          onImport={handleImport}
        />
      )}

      {(stage === "importing" || stage === "done") && (
        <ImportResultsStep
          results={results}
          progress={progress}
          total={total}
          importing={stage === "importing"}
          onReset={handleReset}
        />
      )}
    </div>
  );
};

export default ExcelImportPage;
