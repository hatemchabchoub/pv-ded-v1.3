import { useParams, Link, useNavigate } from "react-router-dom";
import PvPrintTemplate from "@/components/print/PvPrintTemplate";
import PvRecapSummary from "@/components/pv/PvRecapSummary";
import PvAttachments from "@/components/pv/PvAttachments";
import PvAiReportTab from "@/components/pv/PvAiReportTab";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Printer, Pencil, FileDown, Trash2, CheckCircle, Clock, Archive, Eye } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(v);

type CaseStatus = "draft" | "under_review" | "validated" | "archived";

const STATUS_TRANSITIONS: Record<CaseStatus, { label: string; next: CaseStatus; icon: React.ComponentType<any> }[]> = {
  draft: [{ label: "إرسال للمراجعة", next: "under_review", icon: Clock }],
  under_review: [
    { label: "المصادقة", next: "validated", icon: CheckCircle },
    { label: "إرجاع كمسودة", next: "draft", icon: Clock },
  ],
  validated: [{ label: "أرشفة", next: "archived", icon: Archive }],
  archived: [],
};

const PvDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isSupervisor } = useAuth();
  const queryClient = useQueryClient();

  const { data: pv, isLoading } = useQuery({
    queryKey: ["pv-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pv")
        .select(`*, departments (id, name_fr, name_ar, code), officers (id, full_name, badge_number, rank_label)`)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: offenders } = useQuery({
    queryKey: ["pv-offenders", id],
    queryFn: async () => {
      const { data } = await supabase.from("offenders").select("*").eq("pv_id", id!).order("display_order");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: violations } = useQuery({
    queryKey: ["pv-violations", id],
    queryFn: async () => {
      const { data } = await supabase.from("violations").select("*").eq("pv_id", id!).order("display_order");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: seizures } = useQuery({
    queryKey: ["pv-seizures", id],
    queryFn: async () => {
      const { data } = await supabase.from("seizures").select("*").eq("pv_id", id!).order("display_order");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["pv-audit", id],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").eq("record_id", id!).eq("table_name", "pv").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  // Child PVs (sub-PVs / أضلع)
  const { data: childPvs } = useQuery({
    queryKey: ["pv-children", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pv")
        .select("id, pv_number, pv_type, pv_date, case_status, total_actual_seizure, total_virtual_seizure, total_precautionary_seizure, total_seizure")
        .eq("parent_pv_id", id!)
        .order("pv_number");
      return data || [];
    },
    enabled: !!id,
  });

  const isParentPv = !!(pv && !(pv as any).parent_pv_id && (childPvs?.length || 0) > 0);

  const changeStatus = async (newStatus: CaseStatus) => {
    if (!user || !id) return;
    try {
      const { error } = await supabase.from("pv").update({
        case_status: newStatus,
        updated_by: user.id,
      }).eq("id", id);
      if (error) throw error;
      // Audit log is now handled by server-side trigger
      queryClient.invalidateQueries({ queryKey: ["pv-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["pv-list"] });
      toast.success(`تم تحديث الحالة: ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!user || !id) return;
    try {
      // Delete child records first
      await Promise.all([
        supabase.from("offenders").delete().eq("pv_id", id),
        supabase.from("violations").delete().eq("pv_id", id),
        supabase.from("seizures").delete().eq("pv_id", id),
        // attachments table doesn't exist yet, skip
      ]);
      const { error } = await supabase.from("pv").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["pv-list"] });
      toast.success("تم حذف المحضر");
      navigate("/pv");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading || !pv) {
    return <div className="p-6 text-center text-muted-foreground">جاري التحميل...</div>;
  }

  const status = pv.case_status as CaseStatus;
  const transitions = STATUS_TRANSITIONS[status] || [];
  const canEdit = isAdmin || pv.created_by === user?.id || isSupervisor;
  const canDelete = isAdmin;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-row-reverse items-center justify-between gap-4">
        <div className="flex flex-row-reverse items-center gap-3">
          <Link to="/pv">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="text-start">
            <div className="flex flex-row-reverse items-center gap-2">
              <h1 className="text-xl font-semibold font-mono-data">{pv.internal_reference}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground">عدد المحضر: {pv.pv_number} — {pv.pv_date}</p>
          </div>
        </div>
        <div className="flex flex-row-reverse flex-wrap items-center gap-2">
          {/* Status transitions */}
          {transitions.length > 0 && canEdit && (
            <Select onValueChange={(v) => changeStatus(v as CaseStatus)}>
              <SelectTrigger className="h-8 w-auto text-xs">
                <SelectValue placeholder="تغيير الحالة" />
              </SelectTrigger>
              <SelectContent>
                {transitions.map(t => (
                  <SelectItem key={t.next} value={t.next}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canEdit && (
            <Link to={`/pv/${id}/edit`}>
              <Button variant="outline" size="sm"><Pencil className="h-4 w-4" />تعديل</Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />طباعة
          </Button>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" />حذف</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                  <AlertDialogDescription>
                    هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المحضر {pv.pv_number} وجميع السجلات المرتبطة به.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="no-print">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="offenders">المخالفون ({offenders?.length || 0})</TabsTrigger>
          <TabsTrigger value="violations">المخالفات ({violations?.length || 0})</TabsTrigger>
          <TabsTrigger value="seizures">المحجوزات ({seizures?.length || 0})</TabsTrigger>
          {(childPvs?.length || 0) > 0 && (
            <TabsTrigger value="sub-pvs">الأضلع ({childPvs?.length || 0})</TabsTrigger>
          )}
          {isParentPv && (
            <TabsTrigger value="recap">الفهرس التجميعي</TabsTrigger>
          )}
          <TabsTrigger value="attachments">المرفقات</TabsTrigger>
          {pv.ai_analysis_report && (
            <TabsTrigger value="ai-report">التقرير الذكي</TabsTrigger>
          )}
          <TabsTrigger value="audit">السجل ({auditLogs?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 [direction:rtl] lg:grid-cols-4">
             {([
              ["القسم", (pv as any).departments?.name_ar || (pv as any).departments?.name_fr || "—"],
              ["الضابط", (pv as any).officers?.full_name || "—"],
              ["الرتبة", (pv as any).officers?.rank_label || "—"],
              ["طبيعة الإحالة", pv.referral_type || "—"],
              ["نوع المحضر", pv.pv_type || "—"],
              ["مصدر الاستيراد", pv.source_import_type === "manual" ? "يدوي" : pv.source_import_type || "يدوي"],
              ["الأولوية", pv.priority_level === "normal" ? "عادي" : pv.priority_level === "high" ? "مرتفع" : pv.priority_level || "عادي"],
              ["تاريخ الإنشاء", pv.created_at ? new Date(pv.created_at).toLocaleDateString("ar-TN") : "—"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="surface-elevated p-3 text-start">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>


          <div className="surface-elevated p-4">
            <h2 className="mb-3 text-sm font-medium">ملخص المحجوزات</h2>
            <div className="grid grid-cols-2 gap-4 [direction:rtl] lg:grid-cols-4">
              {([
                ["المحجوز الفعلي", pv.total_actual_seizure],
                ["المحجوز الصوري", pv.total_virtual_seizure],
                ["المحجوز التحفظي", pv.total_precautionary_seizure],
                ["المجموع الكلي", pv.total_seizure],
              ] as [string, number | null][]).map(([label, val]) => (
                <div key={label} className="text-start">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold font-mono-data">{formatCurrency(Number(val) || 0)}</p>
                </div>
              ))}
            </div>
          </div>

          {pv.notes && (
            <div className="surface-elevated p-4">
              <h2 className="text-sm font-medium mb-2">ملاحظات</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pv.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="offenders" className="mt-4">
          <div className="surface-elevated">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                   <TableHead>الإسم / الشركة</TableHead>
                   <TableHead>المعرف</TableHead>
                   <TableHead>النوع</TableHead>
                   <TableHead>المدينة</TableHead>
                   <TableHead>العنوان</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offenders?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا يوجد مخالفون</TableCell></TableRow>
                ) : offenders?.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono-data">{o.display_order}</TableCell>
                    <TableCell className="font-medium">{o.name_or_company}</TableCell>
                    <TableCell className="font-mono-data text-sm">{o.identifier || "—"}</TableCell>
                    <TableCell>{o.person_type === "physical" ? "شخص طبيعي" : "شخص معنوي"}</TableCell>
                    <TableCell>{o.city || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{o.address || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="violations" className="mt-4">
          <div className="surface-elevated">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                   <TableHead>المخالفة</TableHead>
                   <TableHead>الصنف</TableHead>
                   <TableHead>الأساس القانوني</TableHead>
                   <TableHead>الخطورة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا توجد مخالفات</TableCell></TableRow>
                ) : violations?.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono-data">{v.display_order}</TableCell>
                    <TableCell className="font-medium text-sm">{v.violation_label}</TableCell>
                    <TableCell>{v.violation_category || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.legal_basis || "—"}</TableCell>
                    <TableCell>
                       {v.severity_level ? (
                         <span className={`text-xs px-2 py-0.5 rounded-sm ${
                           v.severity_level === "Grave" ? "bg-destructive/10 text-destructive" :
                           v.severity_level === "Moyen" ? "bg-accent/10 text-accent-foreground" :
                           "bg-muted text-muted-foreground"
                         }`}>{v.severity_level === "Grave" ? "خطيرة" : v.severity_level === "Moyen" ? "متوسطة" : v.severity_level === "Mineur" ? "بسيطة" : v.severity_level}</span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="seizures" className="mt-4">
          <div className="surface-elevated">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>الصنف</TableHead>
                   <TableHead>النوع</TableHead>
                   <TableHead className="text-end">الكمية</TableHead>
                   <TableHead>الوحدة</TableHead>
                   <TableHead className="text-end">القيمة</TableHead>
                   <TableHead>نوع الحجز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seizures?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد محجوزات</TableCell></TableRow>
                ) : seizures?.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.goods_category || "—"}</TableCell>
                    <TableCell className="font-medium">{s.goods_type || "—"}</TableCell>
                    <TableCell className="text-end font-mono-data">{Number(s.quantity).toLocaleString()}</TableCell>
                    <TableCell>{s.unit || "—"}</TableCell>
                    <TableCell className="text-end font-mono-data">{formatCurrency(Number(s.estimated_value) || 0)}</TableCell>
                    <TableCell className="text-xs">{s.seizure_type === "actual" ? "فعلي" : s.seizure_type === "virtual" ? "صوري" : s.seizure_type === "precautionary" ? "تحفظي" : s.seizure_type || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Sub-PVs tab */}
        {(childPvs?.length || 0) > 0 && (
          <TabsContent value="sub-pvs" className="mt-4">
            <div className="surface-elevated">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>عدد المحضر</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead className="text-end">حجز فعلي</TableHead>
                    <TableHead className="text-end">حجز صوري</TableHead>
                    <TableHead className="text-end">حجز تحفظي</TableHead>
                    <TableHead className="text-end">المجموع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-16">عرض</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {childPvs?.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell><span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent-foreground">ضلع</span></TableCell>
                      <TableCell className="font-mono-data">{c.pv_number}</TableCell>
                      <TableCell>{c.pv_date}</TableCell>
                      <TableCell className="text-end font-mono-data">{formatCurrency(Number(c.total_actual_seizure) || 0)}</TableCell>
                      <TableCell className="text-end font-mono-data">{formatCurrency(Number(c.total_virtual_seizure) || 0)}</TableCell>
                      <TableCell className="text-end font-mono-data">{formatCurrency(Number(c.total_precautionary_seizure) || 0)}</TableCell>
                      <TableCell className="text-end font-mono-data font-semibold">{formatCurrency(Number(c.total_seizure) || 0)}</TableCell>
                      <TableCell><StatusBadge status={c.case_status} /></TableCell>
                      <TableCell>
                        <Link to={`/pv/${c.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button></Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* Recap tab */}
        {isParentPv && (
          <TabsContent value="recap" className="mt-4">
            <PvRecapSummary parentPvId={id!} />
          </TabsContent>
        )}

        <TabsContent value="attachments" className="mt-4">
          <PvAttachments pvId={id!} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="surface-elevated">
            {auditLogs?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">لا يوجد سجل</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>التاريخ</TableHead>
                     <TableHead>الإجراء</TableHead>
                     <TableHead>التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs?.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono-data">{new Date(log.created_at).toLocaleString("ar-TN")}</TableCell>
                      <TableCell className="text-sm">{log.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {log.new_value ? JSON.stringify(log.new_value) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Print template — hidden on screen, shown on print */}
      <PvPrintTemplate
        pv={pv}
        offenders={offenders || []}
        violations={violations || []}
        seizures={seizures || []}
      />
    </div>
  );
};

export default PvDetailPage;
