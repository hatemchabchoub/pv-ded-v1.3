import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Eye, RotateCcw, ArrowRight, Shield, Plus, ChevronLeft, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import PdfFileReview from "@/components/pdf-import/PdfFileReview";

export type FileImportItem = {
  id: string;
  file: File;
  fileName: string;
  status: "queued" | "uploading" | "processing" | "extracted" | "error" | "validated";
  importId: string | null;
  extractedData: any;
  confidenceData: any;
  overallConfidence: number;
  fieldCandidates: any[];
  editedValues: Record<string, string>;
  errorMessage?: string;
};

const PdfImportPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [files, setFiles] = useState<FileImportItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Recent imports
  const { data: recentImports } = useQuery({
    queryKey: ["recent-imports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_imports")
        .select("*")
        .eq("import_type", "pdf")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const handleFilesSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const newItems: FileImportItem[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (!allowed.includes(file.type)) {
        toast.error(`${file.name}: صيغة غير مدعومة`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: الملف كبير جدا (الحد الأقصى 20 ميقا)`);
        continue;
      }
      newItems.push({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        status: "queued",
        importId: null,
        extractedData: null,
        confidenceData: {},
        overallConfidence: 0,
        fieldCandidates: [],
        editedValues: {},
      });
    }

    if (newItems.length > 0) {
      setFiles((prev) => [...prev, ...newItems]);
      toast.success(`تمت إضافة ${newItems.length} ملف(ات) — جاري التحليل...`);

      // Auto-process all new files sequentially
      for (const item of newItems) {
        await processFileItem(item);
      }
    }

    // Reset input
    e.target.value = "";
  }, [processFileItem]);

  const processFileItem = useCallback(async (fileItem: FileImportItem) => {
    if (!user) return;

    const fileId = fileItem.id;

    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "uploading" } : f))
    );
    setProcessingId(fileId);

    try {
      // Upload to storage
      const storagePath = `ocr-imports/${user.id}/${Date.now()}_${fileItem.fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from("pv-attachments")
        .upload(storagePath, fileItem.file);
      if (uploadErr) throw uploadErr;

      // Create import record
      const { data: importRec, error: importErr } = await supabase
        .from("document_imports")
        .insert({
          import_type: "pdf",
          source_file_name: fileItem.fileName,
          storage_path: storagePath,
          uploaded_by: user.id,
          status: "pending",
        })
        .select("id")
        .single();
      if (importErr) throw importErr;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: "processing", importId: importRec.id } : f
        )
      );

      // Extract via OCR
      const { data: extractResult, error: extractErr } = await supabase.functions.invoke("ocr-extract", {
        body: { import_id: importRec.id },
      });

      if (extractErr) throw new Error(extractErr.message);
      if (extractResult?.error) throw new Error(extractResult.error);

      // Load field candidates
      const { data: candidates } = await (supabase as any)
        .from("document_field_candidates")
        .select("*")
        .eq("import_id", importRec.id)
        .order("field_name");

      const edits: Record<string, string> = {};
      candidates?.forEach((c: any) => {
        edits[c.field_name] = c.extracted_value || "";
      });

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: "extracted",
                extractedData: extractResult.extracted,
                confidenceData: extractResult.confidence || {},
                overallConfidence: extractResult.overall_confidence || 50,
                fieldCandidates: candidates || [],
                editedValues: edits,
              }
            : f
        )
      );

      queryClient.invalidateQueries({ queryKey: ["recent-imports"] });
      toast.success(`${fileItem.fileName} — اكتمل الاستخراج (${extractResult.overall_confidence}%)`);
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: "error", errorMessage: err.message } : f
        )
      );
      toast.error(`${fileItem.fileName}: ${err.message || "خطأ غير معروف"}`);
    } finally {
      setProcessingId(null);
    }
  }, [user, queryClient]);

  const retryFile = useCallback(async (fileItem: FileImportItem) => {
    setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "queued" } : f));
    await processFileItem({ ...fileItem, status: "queued" });
  }, [processFileItem]);

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (activeFileId === fileId) setActiveFileId(null);
  };

  const updateFileEditedValues = (fileId: string, values: Record<string, string>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, editedValues: values } : f))
    );
  };

  const handlePrefill = (fileItem: FileImportItem) => {
    const data = { ...fileItem.extractedData };
    Object.entries(fileItem.editedValues).forEach(([key, val]) => {
      if (["offenders", "violations", "seizures"].includes(key)) {
        try { data[key] = JSON.parse(val); } catch { /* keep original */ }
      } else {
        data[key] = val;
      }
    });

    setFiles((prev) =>
      prev.map((f) => (f.id === fileItem.id ? { ...f, status: "validated" } : f))
    );

    navigate("/pv/new", { state: { prefill: data, importId: fileItem.importId } });
  };

  const activeFile = files.find((f) => f.id === activeFileId);
  const queuedCount = files.filter((f) => f.status === "queued").length;
  const extractedCount = files.filter((f) => f.status === "extracted").length;
  const validatedCount = files.filter((f) => f.status === "validated").length;

  const statusIcon = (status: FileImportItem["status"]) => {
    switch (status) {
      case "queued": return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "uploading":
      case "processing": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "extracted": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "validated": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const statusLabel = (status: FileImportItem["status"]) => {
    switch (status) {
      case "queued": return "في الانتظار";
      case "uploading": return "جاري التحميل";
      case "processing": return "جاري التحليل";
      case "extracted": return "مستخرج — بانتظار المراجعة";
      case "validated": return "تم التحقق";
      case "error": return "خطأ";
    }
  };

  // If reviewing a specific file
  if (activeFile && activeFile.status === "extracted") {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setActiveFileId(null)}>
            <ChevronLeft className="h-4 w-4" />
            العودة للقائمة
          </Button>
          <span className="text-sm text-muted-foreground">
            مراجعة: <span className="font-medium text-foreground">{activeFile.fileName}</span>
          </span>
        </div>
        <PdfFileReview
          fileItem={activeFile}
          onEditedValuesChange={(values) => updateFileEditedValues(activeFile.id, values)}
          onPrefill={() => handlePrefill(activeFile)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          استخراج تلقائي ذكي — Smart Document Intake
        </h1>
        <p className="text-sm text-muted-foreground">
          قم بتحميل ملفات PDF أو صور محاضر لاستخراج البيانات المهيكلة تلقائيا عبر الذكاء الاصطناعي
        </p>
      </div>

      {/* Upload area */}
      <div className="surface-elevated p-8 flex flex-col items-center gap-4 border-2 border-dashed border-border">
        <div className="p-4 bg-primary/10 rounded-sm">
          <FileText className="h-10 w-10 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-medium">قم بتحميل وثائق محاضر</p>
          <p className="text-sm text-muted-foreground mt-1">
            PDF أو JPG أو PNG — يمكنك تحميل عدة ملفات في نفس الوقت
          </p>
        </div>
        <label className="cursor-pointer">
          <Button asChild>
            <span>
              <Plus className="h-4 w-4" />
              إضافة ملفات
            </span>
          </Button>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFilesSelect}
            className="hidden"
            multiple
          />
        </label>
      </div>

      {/* Files list */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium">الملفات المحملة ({files.length})</h2>
              <div className="flex gap-2">
                {queuedCount > 0 && (
                  <Badge variant="outline" className="text-xs">{queuedCount} في الانتظار</Badge>
                )}
                {extractedCount > 0 && (
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">{extractedCount} بانتظار المراجعة</Badge>
                )}
                {validatedCount > 0 && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">{validatedCount} تم التحقق</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="surface-elevated divide-y divide-border">
            {files.map((fileItem) => (
              <div
                key={fileItem.id}
                className={`flex items-center justify-between px-4 py-3 transition-colors ${
                  fileItem.status === "extracted" ? "hover:bg-accent/50 cursor-pointer" : ""
                }`}
                onClick={() => {
                  if (fileItem.status === "extracted") setActiveFileId(fileItem.id);
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {statusIcon(fileItem.status)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{fileItem.fileName}</p>
                    <p className="text-xs text-muted-foreground">{statusLabel(fileItem.status)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {fileItem.status === "extracted" && (
                    <>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          fileItem.overallConfidence >= 80
                            ? "border-primary/30 text-primary"
                            : fileItem.overallConfidence >= 50
                            ? "border-amber-500/30 text-amber-600"
                            : "border-destructive/30 text-destructive"
                        }`}
                      >
                        <Shield className="h-3 w-3 me-1" />
                        {fileItem.overallConfidence}%
                      </Badge>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setActiveFileId(fileItem.id); }}>
                        <Eye className="h-4 w-4" />
                        مراجعة
                      </Button>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePrefill(fileItem); }}>
                        <ArrowRight className="h-4 w-4" />
                        ملء المحضر
                      </Button>
                    </>
                  )}

                  {fileItem.status === "queued" && (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  )}

                  {fileItem.status === "error" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); retryFile(fileItem); }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      إعادة
                    </Button>
                  )}

                  {fileItem.status === "validated" && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      <CheckCircle2 className="h-3 w-3 me-1" />
                      تم
                    </Badge>
                  )}

                  {(fileItem.status === "uploading" || fileItem.status === "processing") && (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); removeFile(fileItem.id); }}
                    disabled={fileItem.status === "uploading" || fileItem.status === "processing"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent imports */}
      {recentImports && recentImports.length > 0 && (
        <div className="surface-elevated">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-medium">عمليات الاستيراد الأخيرة</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الملف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الثقة</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentImports.map((imp: any) => (
                <TableRow key={imp.id}>
                  <TableCell className="text-sm">{imp.source_file_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      imp.status === "extracted" ? "border-primary/30 text-primary" :
                      imp.status === "error" ? "border-destructive/30 text-destructive" :
                      "border-border"
                    }>
                      {imp.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono-data text-sm">
                    {imp.confidence_score ? `${imp.confidence_score}%` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {imp.created_at ? new Date(imp.created_at).toLocaleDateString("ar-TN") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default PdfImportPage;
