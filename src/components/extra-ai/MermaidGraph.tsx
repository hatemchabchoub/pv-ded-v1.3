import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface Props {
  code: string;
}

/** Strip HTML tags, fix special chars, and clean node labels for valid Mermaid syntax */
function sanitizeMermaidCode(raw: string): string {
  let cleaned = raw;
  // Remove HTML tags like <b>, </b>, <i>, </i>, <br>, <br/>, etc.
  cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*\/?>/g, " ");
  // Collapse multiple spaces
  cleaned = cleaned.replace(/ {2,}/g, " ");
  // Remove problematic characters inside node labels: replace content in [...] and {...} to remove special chars
  // Fix lines: wrap unquoted labels containing special chars in quotes
  const lines = cleaned.split("\n").map(line => {
    // Skip empty/comment lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%") || trimmed === "end") return line;
    // For node definitions with brackets: A[label] or A{label} or A(label)
    // Wrap labels in quotes if they contain colons, parentheses, or other specials
    return line.replace(/(\w+)\[([^\]"]+)\]/g, (_match, id, label) => {
      const safeLabel = label.replace(/"/g, "'").trim();
      return `${id}["${safeLabel}"]`;
    }).replace(/(\w+)\{([^}"]+)\}/g, (_match, id, label) => {
      const safeLabel = label.replace(/"/g, "'").trim();
      return `${id}{"${safeLabel}"}`;
    }).replace(/(\w+)\(([^)"]+)\)/g, (_match, id, label) => {
      // Only wrap if label has special characters
      if (/[:|,،/\\]/.test(label)) {
        const safeLabel = label.replace(/"/g, "'").trim();
        return `${id}("${safeLabel}")`;
      }
      return _match;
    });
  });
  return lines.join("\n");
}

export default function MermaidGraph({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
        });

        const id = `mermaid-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError("");
        }
      } catch (e: any) {
        console.error("Mermaid render error:", e);
        if (!cancelled) setError(e?.message || "خطأ في عرض المخطط");
      }
    };

    if (code.trim()) renderMermaid();
    return () => { cancelled = true; };
  }, [code]);

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `مخطط_العلاقات_${new Date().toISOString().slice(0, 10)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!code.trim()) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          📊 مخطط العلاقات
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.max(0.3, s - 0.2))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(1)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          {svg && (
            <Button variant="outline" size="sm" onClick={downloadSvg} className="gap-1.5 mr-2">
              <Download className="h-3.5 w-3.5" />
              SVG
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-destructive bg-destructive/10 p-4 rounded-md">
            {error}
            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{code}</pre>
          </div>
        ) : svg ? (
          <div
            className="overflow-auto max-h-[600px] border rounded-md bg-background p-4"
            style={{ direction: "ltr" }}
          >
            <div
              ref={containerRef}
              style={{ transform: `scale(${scale})`, transformOrigin: "top center", transition: "transform 0.2s" }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            جاري عرض المخطط...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
