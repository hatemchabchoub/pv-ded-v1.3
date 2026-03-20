import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, GitGraph, Download, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import MermaidGraph from "@/components/extra-ai/MermaidGraph";

function extractMermaidCode(markdown: string): string {
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(markdown)) !== null) {
    matches.push(m[1].trim());
  }
  return matches.join("\n\n");
}

function stripMermaidBlocks(markdown: string): string {
  return markdown.replace(/```mermaid\s*\n[\s\S]*?```/g, "").trim();
}

interface PvAiReportTabProps {
  report: string;
  pvNumber: string;
}

export default function PvAiReportTab({ report, pvNumber }: PvAiReportTabProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const mermaidCode = extractMermaidCode(report);
  const reportText = stripMermaidBlocks(report);

  const downloadReport = () => {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير_${pvNumber}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-background p-6 overflow-auto" : ""}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">التقرير التحليلي الذكي</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="h-4 w-4" />
            تحميل
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Tabs defaultValue={mermaidCode ? "graph" : "report"} dir="rtl">
        <TabsList>
          <TabsTrigger value="report" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            التقرير
          </TabsTrigger>
          {mermaidCode && (
            <TabsTrigger value="graph" className="flex items-center gap-1.5">
              <GitGraph className="h-3.5 w-3.5" />
              مخطط العلاقات
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="report" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className={fullscreen ? "h-[calc(100vh-200px)]" : "h-[600px]"}>
                <div className="prose prose-sm max-w-none dark:prose-invert text-foreground [direction:rtl]">
                  <ReactMarkdown>{reportText}</ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {mermaidCode && (
          <TabsContent value="graph" className="mt-4">
            <MermaidGraph code={mermaidCode} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
