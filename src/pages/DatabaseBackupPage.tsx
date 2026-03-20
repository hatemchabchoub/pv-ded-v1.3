import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Database, Download, Loader2, ShieldCheck, Clock, FileJson } from "lucide-react";

interface BackupMetadata {
  exported_at: string;
  exported_by: string;
  tables: Record<string, number>;
  total_records: number;
}

export default function DatabaseBackupPage() {
  const [generating, setGenerating] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupMetadata | null>(null);
  const [backupBlob, setBackupBlob] = useState<Blob | null>(null);

  const generateBackup = async () => {
    setGenerating(true);
    setLastBackup(null);
    setBackupBlob(null);

    try {
      const { data, error } = await supabase.functions.invoke("database-backup");

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const metadata = data.metadata as BackupMetadata;
      setLastBackup(metadata);

      // Create downloadable blob
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      setBackupBlob(blob);

      toast.success(`تم إنشاء النسخة الاحتياطية بنجاح — ${metadata.total_records} سجل`);
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || "فشل في إنشاء النسخة الاحتياطية"));
    } finally {
      setGenerating(false);
    }
  };

  const downloadBackup = () => {
    if (!backupBlob || !lastBackup) return;

    const url = URL.createObjectURL(backupBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `database_backup_${lastBackup.exported_at.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("تم تحميل الملف بنجاح");
  };

  const formatSize = (blob: Blob) => {
    const bytes = blob.size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Database className="h-5 w-5" />
          النسخ الاحتياطي لقاعدة البيانات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          إنشاء وتحميل نسخة احتياطية كاملة لجميع بيانات النظام
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Generate Card */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              إنشاء نسخة احتياطية
            </CardTitle>
            <CardDescription>
              يتم تصدير جميع الجداول بصيغة JSON في ملف واحد
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={generateBackup}
              disabled={generating}
              size="lg"
              className="w-full gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ الإنشاء...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  إنشاء نسخة احتياطية جديدة
                </>
              )}
            </Button>

            {backupBlob && lastBackup && (
              <Button
                onClick={downloadBackup}
                variant="outline"
                size="lg"
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                تحميل النسخة الاحتياطية
                <Badge variant="secondary" className="ms-auto text-xs">
                  {formatSize(backupBlob)}
                </Badge>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        {lastBackup && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileJson className="h-4 w-4 text-primary" />
                معلومات النسخة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                <span className="font-medium">
                  {new Date(lastBackup.exported_at).toLocaleString("ar-TN")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">بواسطة:</span>
                <span className="font-medium font-mono text-xs">{lastBackup.exported_by}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">إجمالي السجلات:</span>
                <Badge variant="default">{lastBackup.total_records}</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tables detail */}
      {lastBackup && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">تفاصيل الجداول</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الجدول</TableHead>
                  <TableHead>عدد السجلات</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(lastBackup.tables).map(([table, count]) => (
                  <TableRow key={table}>
                    <TableCell className="font-mono text-xs">{table}</TableCell>
                    <TableCell>
                      <Badge variant={count > 0 ? "default" : "secondary"}>
                        {count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {count > 0 ? "✓ تم التصدير" : "فارغ"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
