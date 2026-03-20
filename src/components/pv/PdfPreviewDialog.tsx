import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ChevronRight, ChevronLeft, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  fileName: string;
}

const PDFJS_VERSION = "3.11.174";

const PdfPreviewDialog = ({ open, onOpenChange, pdfUrl, fileName }: PdfPreviewDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1.5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pdfUrl) return;

    setLoading(true);
    setError(null);

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/standard_fonts/`,
      disableFontFace: true,
      useSystemFonts: false,
      isOffscreenCanvasSupported: false,
    });

    loadingTask.promise
      .then((doc) => {
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      })
      .catch((err) => {
        console.error("PDF preview load error", err);
        setError("تعذرت معاينة هذا الملف حالياً");
      })
      .finally(() => setLoading(false));

    return () => {
      loadingTask.destroy();
    };
  }, [open, pdfUrl]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return;

    setLoading(true);
    setError(null);

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;

      if (!canvas) {
        throw new Error("Canvas unavailable");
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas context unavailable");
      }

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;
    } catch (err) {
      console.error("PDF preview render error", err);
      setError("تعذر عرض الصفحة بشكل صحيح");
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, scale]);

  useEffect(() => {
    if (pdfDoc) {
      void renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  useEffect(() => {
    if (!open) {
      setPdfDoc(null);
      setCurrentPage(1);
      setTotalPages(0);
      setScale(1.5);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-destructive/70" />
            {fileName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 px-6 pb-2 flex-shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span dir="ltr" className="text-xs text-muted-foreground font-mono-data">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={currentPage >= totalPages || loading}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="border-s border-border ps-3 flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={loading}
              onClick={() => setScale((s) => Math.max(0.75, s - 0.25))}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span dir="ltr" className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={loading}
              onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
          <div className="relative flex min-h-full justify-center">
            <canvas
              ref={canvasRef}
              className="rounded border border-border bg-background shadow-md"
            />

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive bg-background/90">
                {error}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfPreviewDialog;
