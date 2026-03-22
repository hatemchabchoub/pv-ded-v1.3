import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, Image } from "lucide-react";

interface Props {
  code: string;
}

const ENTITY_LEGEND = [
  { key: "person", label: "أشخاص طبيعيون", color: "#3b82f6", icon: "👤", shape: "rectangle" },
  { key: "company", label: "شركات / أشخاص معنويون", color: "#8b5cf6", icon: "🏢", shape: "rectangle" },
  { key: "vehicle", label: "وسائل نقل", color: "#f59e0b", icon: "🚗", shape: "stadium" },
  { key: "goods", label: "بضائع / محجوزات", color: "#ef4444", icon: "📦", shape: "trapezoid" },
  { key: "location", label: "أماكن", color: "#10b981", icon: "📍", shape: "hexagon" },
  { key: "document", label: "وثائق / مراجع", color: "#06b6d4", icon: "📄", shape: "parallelogram" },
  { key: "violation", label: "مخالفات", color: "#e11d48", icon: "⚠️", shape: "diamond" },
  { key: "officer", label: "أعوان / إطارات", color: "#0d9488", icon: "🛡️", shape: "rectangle" },
];

/** Strip HTML tags, fix special chars, and clean node labels for valid Mermaid syntax */
function sanitizeMermaidCode(raw: string): string {
  let cleaned = raw;
  cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*\/?>/g, " ");
  cleaned = cleaned.replace(/ {2,}/g, " ");

  const lines = cleaned.split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%") || trimmed === "end" || trimmed.startsWith("classDef") || trimmed.startsWith("class ") || trimmed.startsWith("graph") || trimmed.startsWith("flowchart")) return line;

    // Sanitize edge labels: |text with (parens)| → |"text with (parens)"|
    let sanitized = line.replace(/\|([^|"]+)\|/g, (_match, label) => {
      if (/[(){}[\]:|,،/\\<>]/.test(label)) {
        const safeLabel = label.replace(/"/g, "'").trim();
        return `|"${safeLabel}"|`;
      }
      return _match;
    });

    // Sanitize node labels
    sanitized = sanitized.replace(/(\w+)\[([^\]"]+)\]/g, (_match, id, label) => {
      const safeLabel = label.replace(/"/g, "'").trim();
      return `${id}["${safeLabel}"]`;
    }).replace(/(\w+)\{([^}"]+)\}/g, (_match, id, label) => {
      const safeLabel = label.replace(/"/g, "'").trim();
      return `${id}{"${safeLabel}"}`;
    }).replace(/(\w+)\(([^)"]+)\)/g, (_match, id, label) => {
      if (/[:|,،/\\]/.test(label)) {
        const safeLabel = label.replace(/"/g, "'").trim();
        return `${id}("${safeLabel}")`;
      }
      return _match;
    });
    return sanitized;
  });
  return lines.join("\n");
}

/** Inject classDef styles if not already present */
function injectStyles(code: string): string {
  const hasClassDef = /classDef\s/.test(code);
  if (hasClassDef) return code;

  const classDefs = `
  classDef person fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f,font-weight:bold
  classDef company fill:#ede9fe,stroke:#8b5cf6,stroke-width:2px,color:#3b1f7a,font-weight:bold
  classDef vehicle fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#78350f,font-weight:bold
  classDef goods fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#7f1d1d,font-weight:bold
  classDef location fill:#d1fae5,stroke:#10b981,stroke-width:2px,color:#064e3b,font-weight:bold
  classDef document fill:#cffafe,stroke:#06b6d4,stroke-width:2px,color:#164e63,font-weight:bold
  classDef violation fill:#ffe4e6,stroke:#e11d48,stroke-width:2px,color:#881337,font-weight:bold
  classDef officer fill:#ccfbf1,stroke:#0d9488,stroke-width:2px,color:#134e4a,font-weight:bold
  classDef default fill:#f8fafc,stroke:#94a3b8,stroke-width:1px,color:#334155`;

  // Insert after the first line (graph TD or flowchart TD)
  const firstNewline = code.indexOf("\n");
  if (firstNewline === -1) return code + "\n" + classDefs;
  return code.slice(0, firstNewline) + "\n" + classDefs + code.slice(firstNewline);
}

export default function MermaidGraph({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          themeVariables: {
            primaryColor: "#dbeafe",
            primaryTextColor: "#1e3a5f",
            primaryBorderColor: "#3b82f6",
            lineColor: "#64748b",
            secondaryColor: "#f1f5f9",
            tertiaryColor: "#f8fafc",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "14px",
            edgeLabelBackground: "#ffffff",
          },
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: "basis",
            padding: 20,
            nodeSpacing: 50,
            rankSpacing: 60,
          },
        });

        const sanitized = sanitizeMermaidCode(code);
        const styled = injectStyles(sanitized);
        const id = `mermaid-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, styled);
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

  const downloadPng = useCallback(() => {
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const scaleFactor = 2;
      canvas.width = img.width * scaleFactor;
      canvas.height = img.height * scaleFactor;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scaleFactor, scaleFactor);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `مخطط_العلاقات_${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [svg]);

  if (!code.trim()) return null;

  const graphContent = (
    <>
      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border/40">
        <span className="text-xs font-semibold text-muted-foreground ml-2 self-center">دليل الألوان:</span>
        {ENTITY_LEGEND.map(item => (
          <Badge
            key={item.key}
            variant="outline"
            className="text-[11px] gap-1 px-2 py-0.5 border-2 font-medium"
            style={{ borderColor: item.color, backgroundColor: item.color + "15", color: item.color }}
          >
            <span>{item.icon}</span>
            {item.label}
          </Badge>
        ))}
      </div>

      {/* Graph */}
      {error ? (
        <div className="text-sm text-destructive bg-destructive/10 p-4 rounded-md">
          {error}
          <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{code}</pre>
        </div>
      ) : svg ? (
        <div
          className="overflow-auto border rounded-lg bg-gradient-to-br from-background to-muted/30 p-6"
          style={{ direction: "ltr", maxHeight: fullscreen ? "calc(100vh - 200px)" : "600px" }}
        >
          <div
            ref={containerRef}
            className="mermaid-container"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
              transition: "transform 0.3s ease",
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          جاري عرض المخطط...
        </div>
      )}
    </>
  );

  return (
    <Card className={`border-border/50 shadow-sm ${fullscreen ? "fixed inset-4 z-50 overflow-auto" : ""}`}>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
            <span className="text-lg">🔗</span>
          </span>
          مخطط العلاقات
          {svg && (
            <Badge variant="secondary" className="text-[10px]">تفاعلي</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.max(0.3, s - 0.2))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(1)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFullscreen(f => !f)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          {svg && (
            <div className="flex gap-1 mr-2">
              <Button variant="outline" size="sm" onClick={downloadSvg} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                SVG
              </Button>
              <Button variant="outline" size="sm" onClick={downloadPng} className="gap-1.5 text-xs">
                <Image className="h-3.5 w-3.5" />
                PNG
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {graphContent}
      </CardContent>
      {fullscreen && (
        <div className="fixed inset-0 bg-black/30 -z-10" onClick={() => setFullscreen(false)} />
      )}
    </Card>
  );
}
