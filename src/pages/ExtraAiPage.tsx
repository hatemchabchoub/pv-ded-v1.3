import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Brain, FileText, Loader2, Download, Search, Sparkles,
  Upload, Save, X, FileUp, CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import MermaidGraph from "@/components/extra-ai/MermaidGraph";

interface PvRow {
  id: string;
  pv_number: string;
  pv_date: string;
  pv_type: string | null;
  case_status: string | null;
  parent_pv_id: string | null;
  departments: { name_ar: string | null; name_fr: string } | null;
}

interface UploadedPdf {
  id: string;
  fileName: string;
  text: string;
  status: "extracting" | "ready" | "error";
  errorMessage?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pv-ai-analysis`;

function extractMermaidCode(markdown: string): string {
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(markdown)) !== null) {
    matches.push(m[1].trim());
  }
  return matches.join("\n\n");
}

// Progress tracking: detect sections in streamed output
const SECTION_MARKERS = [
  { pattern: /القسم 1|بطاقة مختصرة|المرحلة الأولى/,  label: "بطاقة المحاضر", pct: 10 },
  { pattern: /القسم 2|جدول الكيانات|المرحلة الثانية/, label: "استخراج الكيانات", pct: 22 },
  { pattern: /القسم 3|التسلسل الزمني|المرحلة الثالثة/, label: "التسلسل الزمني", pct: 34 },
  { pattern: /القسم 4|التحليل الوقائعي|المرحلة الرابعة/, label: "التحليل الوقائعي", pct: 46 },
  { pattern: /القسم 5|التحليل المقارن|المرحلة الخامسة/, label: "التحليل المقارن", pct: 55 },
  { pattern: /القسم 6|التناقضات|المرحلة السادسة/, label: "التناقضات", pct: 64 },
  { pattern: /القسم 7|التقرير النهائي|المرحلة السابعة/, label: "التقرير النهائي", pct: 76 },
  { pattern: /القسم 8|مخطط العلاقات|المرحلة الثامنة|```mermaid/, label: "مخطط العلاقات", pct: 88 },
  { pattern: /القسم 9|التوصيات|المرحلة التاسعة/, label: "التوصيات", pct: 95 },
];

function computeProgress(text: string): { percent: number; label: string } {
  if (!text) return { percent: 2, label: "بدء التحليل..." };
  let best = { percent: 5, label: "قراءة المحاضر..." };
  for (const marker of SECTION_MARKERS) {
    if (marker.pattern.test(text)) {
      best = { percent: marker.pct, label: marker.label };
    }
  }
  return best;
}

export default function ExtraAiPage() {
  const [pvList, setPvList] = useState<PvRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState("");
  const [search, setSearch] = useState("");
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, label: "" });
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPvs = async () => {
      const { data, error } = await supabase
        .from("pv")
        .select("id, pv_number, pv_date, pv_type, case_status, parent_pv_id, departments(name_ar, name_fr)")
        .order("pv_date", { ascending: false })
        .limit(500);
      if (error) {
        toast.error("خطأ في تحميل المحاضر");
      } else {
        setPvList((data as unknown as PvRow[]) || []);
      }
      setLoading(false);
    };
    fetchPvs();
  }, []);

  const togglePv = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // PDF upload and OCR extraction
  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("يرجى تسجيل الدخول");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = crypto.randomUUID();

      setUploadedPdfs(prev => [...prev, { id, fileName: file.name, text: "", status: "extracting" }]);

      try {
        // Upload to storage
        const storagePath = `ocr-imports/${session.user.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("pv-attachments").upload(storagePath, file);
        if (uploadErr) throw uploadErr;

        // Create import record
        const { data: importRec, error: importErr } = await supabase
          .from("document_imports")
          .insert({
            import_type: "pdf",
            source_file_name: file.name,
            storage_path: storagePath,
            uploaded_by: session.user.id,
            status: "pending",
          })
          .select("id")
          .single();
        if (importErr) throw importErr;

        // OCR extract
        const { data: extractResult, error: extractErr } = await supabase.functions.invoke("ocr-extract", {
          body: { import_id: importRec.id },
        });
        if (extractErr) throw new Error(extractErr.message);
        if (extractResult?.error) throw new Error(extractResult.error);

        // Get the raw text from import record
        const { data: importData } = await supabase
          .from("document_imports")
          .select("raw_text")
          .eq("id", importRec.id)
          .single();

        const rawText = importData?.raw_text || JSON.stringify(extractResult?.extracted || {}, null, 2);

        setUploadedPdfs(prev =>
          prev.map(p => p.id === id ? { ...p, text: rawText, status: "ready" } : p)
        );
        toast.success(`${file.name} — تم الاستخراج بنجاح`);
      } catch (err: any) {
        setUploadedPdfs(prev =>
          prev.map(p => p.id === id ? { ...p, status: "error", errorMessage: err.message } : p)
        );
        toast.error(`${file.name}: ${err.message}`);
      }
    }

    e.target.value = "";
  }, []);

  const removePdf = (id: string) => {
    setUploadedPdfs(prev => prev.filter(p => p.id !== id));
  };

  const startAnalysis = useCallback(async () => {
    const readyPdfs = uploadedPdfs.filter(p => p.status === "ready");
    if (selectedIds.size === 0 && readyPdfs.length === 0) {
      toast.warning("يرجى اختيار محضر أو تحميل وثيقة PDF");
      return;
    }

    setAnalyzing(true);
    setResult("");
    setProgress({ percent: 2, label: "بدء التحليل..." });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("يرجى تسجيل الدخول");
        setAnalyzing(false);
        return;
      }

      const requestBody: any = {};
      if (selectedIds.size > 0) requestBody.pvIds = Array.from(selectedIds);
      if (readyPdfs.length > 0) requestBody.rawTexts = readyPdfs.map(p => p.text);

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || "خطأ في التحليل");
        setAnalyzing(false);
        return;
      }

      if (!resp.body) {
        toast.error("No response body");
        setAnalyzing(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setResult(accumulated);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("خطأ في الاتصال بخدمة التحليل");
    } finally {
      setAnalyzing(false);
    }
  }, [selectedIds, uploadedPdfs]);

  // Save report to selected PVs + parent PVs
  const saveReportToPv = useCallback(async () => {
    if (!result || selectedIds.size === 0) {
      toast.warning("لا يوجد تقرير أو محاضر محددة للحفظ");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("يرجى تسجيل الدخول"); return; }

      // Collect target PV ids + their parent PV ids
      const targetIds = new Set<string>(selectedIds);
      for (const id of selectedIds) {
        const pv = pvList.find(p => p.id === id);
        if (pv?.parent_pv_id) targetIds.add(pv.parent_pv_id);
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "save_report",
          reportText: result,
          targetPvIds: Array.from(targetIds),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown" }));
        toast.error(err.error || "خطأ في الحفظ");
        return;
      }

      toast.success(`تم حفظ التقرير في ${targetIds.size} محضر(محاضر) بنجاح`);
    } catch (e) {
      console.error(e);
      toast.error("خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  }, [result, selectedIds, pvList]);

  useEffect(() => {
    if (resultRef.current && analyzing) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result, analyzing]);

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير_تحليل_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = pvList.filter(
    (pv) =>
      pv.pv_number.toLowerCase().includes(search.toLowerCase()) ||
      (pv.departments?.name_ar || "").includes(search) ||
      (pv.departments?.name_fr || "").toLowerCase().includes(search.toLowerCase())
  );

  const mermaidCode = extractMermaidCode(result);
  const readyPdfs = uploadedPdfs.filter(p => p.status === "ready");
  const canAnalyze = selectedIds.size > 0 || readyPdfs.length > 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
          <Brain className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            التحليل الذكي للمحاضر
            <Sparkles className="h-5 w-5 text-accent animate-pulse" />
          </h1>
          <p className="text-sm text-muted-foreground">
            تحليل معمّق بالذكاء الاصطناعي — يمكنك اختيار محاضر أو تحميل وثائق PDF
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Input sources */}
        <Card className="lg:col-span-1 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              مصادر البيانات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="pvs" dir="rtl">
              <TabsList className="w-full">
                <TabsTrigger value="pvs" className="flex-1">
                  محاضر ({selectedIds.size})
                </TabsTrigger>
                <TabsTrigger value="pdfs" className="flex-1">
                  وثائق PDF ({readyPdfs.length})
                </TabsTrigger>
              </TabsList>

              {/* PV Selection Tab */}
              <TabsContent value="pvs" className="mt-0">
                <div className="px-3 py-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث برقم المحضر..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pr-9"
                    />
                  </div>
                </div>
                <ScrollArea className="h-[350px]">
                  {loading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-10">لا توجد محاضر</p>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {filtered.map((pv) => (
                        <label
                          key={pv.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedIds.has(pv.id)}
                            onCheckedChange={() => togglePv(pv.id)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{pv.pv_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {pv.pv_date} • {pv.departments?.name_ar || pv.departments?.name_fr || "—"}
                            </p>
                            <div className="flex gap-1 mt-1">
                              {pv.pv_type && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{pv.pv_type}</Badge>
                              )}
                              {pv.case_status && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{pv.case_status}</Badge>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* PDF Upload Tab */}
              <TabsContent value="pdfs" className="mt-0">
                <div className="px-3 py-3">
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:bg-muted/30 transition-colors">
                      <FileUp className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">تحميل ملفات PDF أو صور</p>
                      <p className="text-xs text-muted-foreground">PDF, JPG, PNG — عدة ملفات ممكنة</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handlePdfUpload}
                      className="hidden"
                      multiple
                    />
                  </label>
                </div>
                <ScrollArea className="h-[280px]">
                  {uploadedPdfs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-10">
                      لم يتم تحميل أي وثيقة بعد
                    </p>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {uploadedPdfs.map((pdf) => (
                        <div key={pdf.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {pdf.status === "extracting" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                            {pdf.status === "ready" && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            {pdf.status === "error" && <X className="h-4 w-4 text-destructive shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm truncate">{pdf.fileName}</p>
                              {pdf.status === "extracting" && <p className="text-xs text-muted-foreground">جاري الاستخراج...</p>}
                              {pdf.status === "error" && <p className="text-xs text-destructive">{pdf.errorMessage}</p>}
                              {pdf.status === "ready" && <p className="text-xs text-muted-foreground">{pdf.text.length} حرف</p>}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removePdf(pdf.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <Separator />
            <div className="p-3">
              <Button
                onClick={startAnalysis}
                disabled={analyzing || !canAnalyze}
                className="w-full gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري التحليل...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    بدء التحليل الذكي
                    {canAnalyze && (
                      <Badge variant="secondary" className="text-[10px] mr-1">
                        {selectedIds.size + readyPdfs.length}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel: Results */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">نتائج التحليل</CardTitle>
                <CardDescription>
                  {result ? `تقرير بـ ${result.length} حرف` : "اختر مصادر وابدأ التحليل"}
                </CardDescription>
              </div>
              {result && (
                <div className="flex gap-2">
                  {selectedIds.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveReportToPv}
                      disabled={saving}
                      className="gap-1.5"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      حفظ في المحضر
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={downloadReport} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    تحميل
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]" ref={resultRef}>
                {analyzing && !result && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">جاري تحليل المحاضر بالذكاء الاصطناعي...</p>
                  </div>
                )}
                {result && (
                  <div className="prose prose-sm max-w-none dark:prose-invert text-foreground" dir="rtl">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                )}
                {!result && !analyzing && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                    <Brain className="h-14 w-14 opacity-20" />
                    <p className="text-sm">اختر المحاضر أو حمّل وثائق ثم اضغط "بدء التحليل الذكي"</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Mermaid Graph */}
          {mermaidCode && !analyzing && <MermaidGraph code={mermaidCode} />}
        </div>
      </div>
    </div>
  );
}
