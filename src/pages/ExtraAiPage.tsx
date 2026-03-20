import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Brain, FileText, Loader2, Download, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

interface PvRow {
  id: string;
  pv_number: string;
  pv_date: string;
  pv_type: string | null;
  case_status: string | null;
  departments: { name_ar: string | null; name_fr: string } | null;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pv-ai-analysis`;

export default function ExtraAiPage() {
  const [pvList, setPvList] = useState<PvRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState("");
  const [search, setSearch] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPvs = async () => {
      const { data, error } = await supabase
        .from("pv")
        .select("id, pv_number, pv_date, pv_type, case_status, departments(name_ar, name_fr)")
        .order("pv_date", { ascending: false })
        .limit(500);
      if (error) {
        toast.error("خطأ في تحميل المحاضر");
        console.error(error);
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

  const startAnalysis = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning("يرجى اختيار محضر واحد على الأقل");
      return;
    }

    setAnalyzing(true);
    setResult("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("يرجى تسجيل الدخول");
        setAnalyzing(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ pvIds: Array.from(selectedIds) }),
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
  }, [selectedIds]);

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
            تحليل معمّق بالذكاء الاصطناعي للمحاضر الديوانية
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PV Selection Panel */}
        <Card className="lg:col-span-1 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              اختيار المحاضر
            </CardTitle>
            <CardDescription>
              اختر محضرا واحدا أو أكثر للتحليل ({selectedIds.size} محددة)
            </CardDescription>
            <div className="relative mt-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم المحضر أو الإدارة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">
                  لا توجد محاضر
                </p>
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
                        <p className="text-sm font-medium text-foreground truncate">
                          {pv.pv_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pv.pv_date} • {pv.departments?.name_ar || pv.departments?.name_fr || "—"}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {pv.pv_type && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {pv.pv_type}
                            </Badge>
                          )}
                          {pv.case_status && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {pv.case_status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
            <Separator />
            <div className="p-3">
              <Button
                onClick={startAnalysis}
                disabled={analyzing || selectedIds.size === 0}
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
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">نتائج التحليل</CardTitle>
              <CardDescription>
                {result
                  ? `تقرير بـ ${result.length} حرف`
                  : "اختر محاضر وابدأ التحليل"}
              </CardDescription>
            </div>
            {result && (
              <Button variant="outline" size="sm" onClick={downloadReport} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                تحميل
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]" ref={resultRef}>
              {analyzing && !result && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    جاري تحليل المحاضر بالذكاء الاصطناعي...
                  </p>
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
                  <p className="text-sm">
                    اختر المحاضر من القائمة ثم اضغط على "بدء التحليل الذكي"
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
