import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileDown, Trash2, FileText, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

interface PvAttachmentsProps {
  pvId: string;
  canEdit: boolean;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const PvAttachments = ({ pvId, canEdit }: PvAttachmentsProps) => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  const { data: attachments, isLoading } = useQuery({
    queryKey: ["pv-attachments", pvId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("pv_id", pvId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type !== "application/pdf") {
      toast.error("يُسمح فقط بملفات PDF");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("الحد الأقصى لحجم الملف هو 20 ميغابايت");
      return;
    }

    setUploading(true);
    try {
      const storagePath = `${user.id}/${pvId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pv-attachments")
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("attachments").insert({
        pv_id: pvId,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["pv-attachments", pvId] });
      toast.success("تم رفع الملف بنجاح");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePreview = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("pv-attachments")
        .download(storagePath);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setPreviewName(fileName);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName("");
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("pv-attachments")
        .download(storagePath);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string, storagePath: string) => {
    try {
      await supabase.storage.from("pv-attachments").remove([storagePath]);
      const { error } = await supabase.from("attachments").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["pv-attachments", pvId] });
      toast.success("تم حذف المرفق");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "جاري الرفع..." : "رفع ملف PDF"}
          </Button>
        </div>
      )}

      {(!attachments || attachments.length === 0) ? (
        <div className="surface-elevated p-8 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          لا توجد مرفقات
        </div>
      ) : (
        <div className="surface-elevated">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم الملف</TableHead>
                <TableHead>الحجم</TableHead>
                <TableHead>تاريخ الرفع</TableHead>
                <TableHead className="w-32">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((att: any) => (
                <TableRow key={att.id}>
                  <TableCell className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-destructive/70" />
                    {att.file_name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {att.file_size ? formatFileSize(att.file_size) : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono-data">
                    {new Date(att.created_at).toLocaleDateString("ar-TN")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="معاينة"
                        onClick={() => handlePreview(att.storage_path, att.file_name)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="تحميل"
                        onClick={() => handleDownload(att.storage_path, att.file_name)}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      {(isAdmin || att.uploaded_by === user?.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="حذف"
                          onClick={() => handleDelete(att.id, att.storage_path)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-destructive/70" />
              {previewName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-md border border-border"
                title={previewName}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PvAttachments;
