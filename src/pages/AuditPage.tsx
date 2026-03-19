import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, Filter } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  INSERT: { label: "إنشاء", variant: "default" },
  UPDATE: { label: "تعديل", variant: "secondary" },
  DELETE: { label: "حذف", variant: "destructive" },
  LOGIN: { label: "تسجيل دخول", variant: "outline" },
};

const TABLE_LABELS: Record<string, string> = {
  pv: "محاضر",
  offenders: "مخالفين",
  seizures: "حجوزات",
  violations: "مخالفات",
  departments: "أقسام",
  units: "وحدات",
  officers: "ضباط",
  profiles: "ملفات شخصية",
  user_roles: "أدوار",
};

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (logs || []).filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (tableFilter !== "all" && log.table_name !== tableFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        log.action?.toLowerCase().includes(s) ||
        log.table_name?.toLowerCase().includes(s) ||
        log.record_id?.toLowerCase().includes(s) ||
        log.user_id?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const uniqueTables = [...new Set((logs || []).map((l) => l.table_name).filter(Boolean))];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          سجل المراجعة
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          السجل الكامل للإجراءات والتعديلات في النظام
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9 w-64"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-3.5 w-3.5 ms-1" />
            <SelectValue placeholder="الإجراء" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الإجراءات</SelectItem>
            <SelectItem value="INSERT">إنشاء</SelectItem>
            <SelectItem value="UPDATE">تعديل</SelectItem>
            <SelectItem value="DELETE">حذف</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-44">
            <Filter className="h-3.5 w-3.5 ms-1" />
            <SelectValue placeholder="الجدول" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الجداول</SelectItem>
            {uniqueTables.map((t) => (
              <SelectItem key={t} value={t!}>
                {TABLE_LABELS[t!] || t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">{filtered.length} سجل</span>
      </div>

      {isLoading ? (
        <div className="surface-elevated p-8 text-center text-sm text-muted-foreground">
          جاري التحميل...
        </div>
      ) : (
        <div className="surface-elevated rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>الجدول</TableHead>
                <TableHead>معرّف السجل</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>التفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    لا توجد سجلات
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => {
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, variant: "outline" as const };
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono-data whitespace-nowrap">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString("ar-MA", {
                              dateStyle: "short",
                              timeStyle: "medium",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionInfo.variant} className="text-[10px]">
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {TABLE_LABELS[log.table_name || ""] || log.table_name || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono-data max-w-[120px] truncate">
                        {log.record_id?.slice(0, 8) || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono-data max-w-[120px] truncate">
                        {log.user_id?.slice(0, 8) || "نظام"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {log.metadata ? JSON.stringify(log.metadata).slice(0, 60) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
