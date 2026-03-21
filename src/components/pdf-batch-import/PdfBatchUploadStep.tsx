import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Upload, X } from "lucide-react";

interface Props {
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onStartProcessing: () => void;
  loading: boolean;
}

export default function PdfBatchUploadStep({ files, onFilesSelected, onRemoveFile, onStartProcessing, loading }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      const pdfFiles = Array.from(newFiles).filter(f => f.name.toLowerCase().endsWith(".pdf"));
      if (pdfFiles.length > 0) onFilesSelected(pdfFiles);
    },
    [onFilesSelected]
  );

  return (
    <div className="space-y-4">
      <div
        className={`surface-elevated p-12 flex flex-col items-center gap-4 border-2 border-dashed transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <div className="p-4 bg-muted rounded-sm">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium">اسحب ملفات PDF أو انقر للاختيار</p>
          <p className="text-sm text-muted-foreground mt-1">يمكنك اختيار عدة ملفات PDF دفعة واحدة</p>
        </div>
        <label className="cursor-pointer">
          <Button asChild disabled={loading}>
            <span><Upload className="h-4 w-4" />{loading ? "جاري المعالجة…" : "اختيار ملفات"}</span>
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
            className="hidden"
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="surface-elevated p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{files.length} ملف(ات) محددة</p>
            <Button size="sm" onClick={onStartProcessing} disabled={loading}>
              بدء التحليل
            </Button>
          </div>
          <div className="space-y-1 max-h-[300px] overflow-auto">
            {files.map((file, i) => (
              <div key={i} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-sm hover:bg-muted/50">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onRemoveFile(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
