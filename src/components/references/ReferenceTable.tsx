import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export interface ColumnDef {
  key: string;
  label: string;
  type?: "text" | "boolean" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  hidden?: boolean; // hide from table but show in form
}

interface ReferenceTableProps {
  data: any[];
  columns: ColumnDef[];
  loading: boolean;
  onAdd: (item: Record<string, any>) => Promise<void>;
  onUpdate: (id: string, item: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  idField?: string;
}

export function ReferenceTable({
  data,
  columns,
  loading,
  onAdd,
  onUpdate,
  onDelete,
  idField = "id",
}: ReferenceTableProps) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const visibleColumns = columns.filter((c) => !c.hidden);

  const filtered = data.filter((row) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return columns.some((col) => {
      const val = row[col.key];
      return typeof val === "string" && val.toLowerCase().includes(s);
    });
  });

  const openAdd = () => {
    setEditingItem(null);
    const defaults: Record<string, any> = {};
    columns.forEach((c) => {
      if (c.type === "boolean") defaults[c.key] = true;
      else defaults[c.key] = "";
    });
    setFormData(defaults);
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    const vals: Record<string, any> = {};
    columns.forEach((c) => (vals[c.key] = item[c.key] ?? (c.type === "boolean" ? true : "")));
    setFormData(vals);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const missing = columns.filter((c) => c.required && !formData[c.key] && formData[c.key] !== false);
    if (missing.length > 0) {
      toast.error(`الحقول المطلوبة: ${missing.map((c) => c.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await onUpdate(editingItem[idField], formData);
        toast.success("تم التحديث بنجاح");
      } else {
        await onAdd(formData);
        toast.success("تمت الإضافة بنجاح");
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await onDelete(id);
      toast.success("تم الحذف بنجاح");
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("violates foreign key") || msg.includes("foreign key constraint")) {
        toast.error("لا يمكن حذف هذا العنصر لأنه مرتبط ببيانات أخرى");
      } else {
        toast.error(msg || "خطأ في الحذف");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9"
          />
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 ms-1" />
          إضافة
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((col) => (
                <TableHead key={col.key} className="text-right">{col.label}</TableHead>
              ))}
              <TableHead className="w-24 text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                  جارٍ التحميل...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                  لا توجد بيانات
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row[idField]}>
                  {visibleColumns.map((col) => (
                    <TableCell key={col.key} className="text-right">
                      {col.type === "boolean" ? (
                        <Badge variant={row[col.key] ? "default" : "secondary"}>
                          {row[col.key] ? "نشط" : "معطل"}
                        </Badge>
                      ) : col.type === "select" && col.options ? (
                        col.options.find((o) => o.value === row[col.key])?.label || row[col.key] || "—"
                      ) : (
                        row[col.key] || "—"
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(row[idField])}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "تعديل" : "إضافة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {columns.map((col) => (
              <div key={col.key} className="space-y-1.5">
                <Label>{col.label} {col.required && <span className="text-destructive">*</span>}</Label>
                {col.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!formData[col.key]}
                      onCheckedChange={(v) => setFormData((p) => ({ ...p, [col.key]: v }))}
                    />
                    <span className="text-sm text-muted-foreground">{formData[col.key] ? "نشط" : "معطل"}</span>
                  </div>
                ) : col.type === "select" ? (
                  <Select
                    value={formData[col.key] || ""}
                    onValueChange={(v) => setFormData((p) => ({ ...p, [col.key]: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      {col.options?.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData[col.key] || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, [col.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete}>حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
