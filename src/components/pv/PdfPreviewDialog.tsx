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

const PdfPreviewDialog = ({ open, onOpenChange, pdfUrl, fileName }: PdfPreviewDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1.5);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !pdfUrl) return;
    setLoading(true);
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise.then((doc) => {
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      loadingTask.destroy();
    };
  }, [open, pdfUrl]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }, [pdfDoc, scale]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage);
  }, [pdfDoc, currentPage, renderPage]);

  useEffect(() => {
    if (!open) {
      setPdfDoc(null);
      setCurrentPage(1);
      setTotalPages(0);
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

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 px-6 pb-2 flex-shrink-0">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono-data">
            {currentPage} / {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="border-s border-border ps-3 flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setScale((s) => Math.min(3, s + 0.25))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex justify-center">
              <canvas ref={canvasRef} className="shadow-md rounded" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfPreviewDialog;
