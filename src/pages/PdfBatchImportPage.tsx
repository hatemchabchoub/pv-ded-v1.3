import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PdfFileEntry } from "@/lib/pdf-batch-import";
import { uploadAndProcessPdf, importExtractedPvs } from "@/lib/pdf-batch-import";

import PdfBatchUploadStep from "@/components/pdf-batch-import/PdfBatchUploadStep";
import PdfProcessingStep from "@/components/pdf-batch-import/PdfProcessingStep";
import PdfPreviewStep from "@/components/pdf-batch-import/PdfPreviewStep";
import PdfBatchResultsStep from "@/components/pdf-batch-import/PdfBatchResultsStep";

type Stage = "upload" | "processing" | "preview" | "importing" | "done";

const PdfBatchImportPage = () => {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [entries, setEntries] = useState<PdfFileEntry[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [results, setResults] = useState<Array<{ fileId: string; status: "success" | "skipped" | "error"; error?: string }>>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartProcessing = useCallback(async () => {
    if (!user || files.length === 0) return;

    const initialEntries: PdfFileEntry[] = files.map((file, i) => ({
      file,
      id: `pdf-${Date.now()}-${i}`,
      status: "pending" as const,
    }));

    setEntries(initialEntries);
    setStage("processing");
    setProcessedCount(0);

    // Process files sequentially to avoid rate limits
    for (let i = 0; i < initialEntries.length; i++) {
      const entry = initialEntries[i];
      try {
        const result = await uploadAndProcessPdf(
          entry.file,
          user.id,
          (status, error) => {
            setEntries(prev =>
              prev.map(e => e.id === entry.id ? { ...e, status, error } : e)
            );
          }
        );

        setEntries(prev =>
          prev.map(e =>
            e.id === entry.id
              ? { ...e, status: "extracted", importId: result.importId, extractedData: result.extracted, confidence: result.confidence }
              : e
          )
        );
      } catch (err: any) {
        setEntries(prev =>
          prev.map(e =>
            e.id === entry.id ? { ...e, status: "error", error: err.message } : e
          )
        );
      }
      setProcessedCount(i + 1);
    }

    setStage("preview");
    toast.success("اكتمل تحليل جميع الملفات");
  }, [files, user]);

  const handleImport = useCallback(async () => {
    if (!user) return;
    setStage("importing");
    const validEntries = entries.filter(e => e.status === "extracted");
    setTotal(validEntries.length);

    const importResults = await importExtractedPvs(entries, user.id, (current, t) => {
      setProgress(current);
      setTotal(t);
    });

    setResults(importResults);
    setStage("done");

    const s = importResults.filter(r => r.status === "success").length;
    const e = importResults.filter(r => r.status === "error").length;
    const sk = importResults.filter(r => r.status === "skipped").length;
    toast.success(`اكتمل الاستيراد: ${s} ناجح، ${sk} تم تجاوزه، ${e} أخطاء`);
  }, [entries, user]);

  const handleReset = useCallback(() => {
    setStage("upload");
    setFiles([]);
    setEntries([]);
    setResults([]);
    setProcessedCount(0);
    setProgress(0);
    setTotal(0);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">استيراد PDF دفعي</h1>
        <p className="text-sm text-muted-foreground">
          استيراد عدة ملفات PDF وتحليلها بالذكاء الاصطناعي لإنشاء محاضر تلقائياً
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {["الملفات", "التحليل", "معاينة", "استيراد"].map((label, i) => {
          const stageOrder = ["upload", "processing", "preview", "importing"];
          const currentIdx = stageOrder.indexOf(stage === "done" ? "importing" : stage);
          const isActive = i <= currentIdx;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${isActive ? "bg-primary" : "bg-border"}`} />}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm ${
                isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
              }`}>
                <span className="w-4 h-4 rounded-full border text-[10px] flex items-center justify-center font-mono">{i + 1}</span>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {stage === "upload" && (
        <PdfBatchUploadStep
          files={files}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveFile}
          onStartProcessing={handleStartProcessing}
          loading={false}
        />
      )}

      {stage === "processing" && (
        <PdfProcessingStep entries={entries} processedCount={processedCount} />
      )}

      {stage === "preview" && (
        <PdfPreviewStep
          entries={entries}
          onBack={() => setStage("upload")}
          onImport={handleImport}
        />
      )}

      {(stage === "importing" || stage === "done") && (
        <PdfBatchResultsStep
          entries={entries}
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

export default PdfBatchImportPage;
