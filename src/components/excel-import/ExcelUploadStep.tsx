import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Upload } from "lucide-react";

interface ExcelUploadStepProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
}

export default function ExcelUploadStep({ onFileSelected, loading }: ExcelUploadStepProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file && /\.(xlsx|xlsm|xls)$/i.test(file.name)) {
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  return (
    <div
      className={`surface-elevated p-12 flex flex-col items-center gap-4 border-2 border-dashed transition-colors ${
        dragOver ? "border-primary bg-primary/5" : "border-border"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      <div className="p-4 bg-muted rounded-sm">
        <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="font-medium">
          اسحب ملف Excel أو انقر للاختيار
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          الصيغة المتوقعة: أعمدة بالعربية (عدد المحضر، تاريخ المحضر، القسم، إلخ.)
        </p>
      </div>
      <label className="cursor-pointer">
        <Button asChild disabled={loading}>
          <span>
            <Upload className="h-4 w-4" />
            {loading ? "جاري القراءة…" : "اختيار ملف"}
          </span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />
      </label>
    </div>
  );
}
