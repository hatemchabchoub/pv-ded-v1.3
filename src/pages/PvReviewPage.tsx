import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Save, Plus, Trash2, CheckCircle, SkipForward, ListChecks } from "lucide-react";
import { toast } from "sonner";
import ParentPvSelector from "@/components/pv/ParentPvSelector";
import { AutocompleteWithAdd, AutocompleteOption } from "@/components/ui/autocomplete-with-add";

interface OffenderRow {
  id?: string;
  name_or_company: string;
  identifier: string;
  person_type: string;
  city: string;
  address: string;
  _deleted?: boolean;
}

interface ViolationRow {
  id?: string;
  violation_label: string;
  violation_category: string;
  legal_basis: string;
  severity_level: string;
  _deleted?: boolean;
}

interface SeizureRow {
  id?: string;
  goods_category: string;
  goods_type: string;
  quantity: string;
  unit: string;
  estimated_value: string;
  seizure_type: string;
  _deleted?: boolean;
}

const PvReviewPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [pvNumber, setPvNumber] = useState("");
  const [pvDate, setPvDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [referralType, setReferralType] = useState("");
  const [referralSourceId, setReferralSourceId] = useState("");
  const [pvType, setPvType] = useState("");
  const [parentPvId, setParentPvId] = useState("");
  const [notes, setNotes] = useState("");
  const [offenders, setOffenders] = useState<OffenderRow[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [seizures, setSeizures] = useState<SeizureRow[]>([]);

  // Load all draft PVs
  const { data: draftPvs = [], isLoading: loadingPvs } = useQuery({
    queryKey: ["pv-review-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pv")
        .select("id, pv_number, pv_type, parent_pv_id, case_status, pv_date, department_id, officer_id, referral_type, referral_source_id, notes, internal_reference, total_actual_seizure, total_virtual_seizure, total_precautionary_seizure")
        .eq("case_status", "draft")
        .order("pv_number");
      if (error) throw error;
      return data || [];
    },
  });

  const currentPv = draftPvs[currentIndex];
  const currentId = currentPv?.id;

  // Lookups
  const { data: departments } = useQuery({
    queryKey: ["ref-departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name_fr, name_ar, code").eq("active", true).order("name_fr");
      return data || [];
    },
  });
  const { data: officers } = useQuery({
    queryKey: ["ref-officers-all"],
    queryFn: async () => {
      const { data } = await supabase.from("officers").select("id, full_name, badge_number, rank_label").eq("active", true).order("full_name");
      return data || [];
    },
  });
  const { data: referralSources } = useQuery({
    queryKey: ["ref-referral-sources"],
    queryFn: async () => {
      const { data } = await supabase.from("referral_sources").select("id, label_fr, label_ar").eq("active", true);
      return data || [];
    },
  });
  const { data: violationRefs, refetch: refetchViolationRefs } = useQuery({
    queryKey: ["ref-violation-reference"],
    queryFn: async () => {
      const { data } = await supabase.from("violation_reference").select("id, label_fr, label_ar, category, legal_basis").eq("active", true).order("label_fr");
      return data || [];
    },
  });
  const { data: goodsRefs, refetch: refetchGoodsRefs } = useQuery({
    queryKey: ["ref-goods-reference"],
    queryFn: async () => {
      const { data } = await supabase.from("goods_reference").select("id, category_fr, category_ar, type_fr, type_ar").eq("active", true).order("category_fr");
      return data || [];
    },
  });

  const violationOptions: AutocompleteOption[] = (violationRefs || []).map(v => ({
    id: v.id, label: v.label_ar || v.label_fr, sublabel: v.category || undefined,
  }));
  const goodsCategoryOptions: AutocompleteOption[] = Array.from(
    new Map((goodsRefs || []).map(g => [g.category_ar || g.category_fr, { category: g.category_ar || g.category_fr }])).values()
  ).map((g, idx) => ({ id: `cat-${idx}`, label: g.category }));
  const getGoodsTypeOptions = (categoryLabel: string): AutocompleteOption[] => {
    if (!categoryLabel.trim()) return (goodsRefs || []).filter(g => g.type_ar || g.type_fr).map(g => ({
      id: g.id, label: g.type_ar || g.type_fr || '', sublabel: g.category_ar || g.category_fr,
    }));
    return (goodsRefs || [])
      .filter(g => (g.category_ar === categoryLabel || g.category_fr === categoryLabel) && (g.type_ar || g.type_fr))
      .map(g => ({ id: g.id, label: g.type_ar || g.type_fr || '', sublabel: g.category_ar || g.category_fr }));
  };
  const refreshAllRefs = async () => { await Promise.all([refetchViolationRefs(), refetchGoodsRefs()]); };

  // Load sub-records for current PV
  const { data: existingOffenders } = useQuery({
    queryKey: ["pv-offenders-review", currentId],
    queryFn: async () => {
      const { data } = await supabase.from("offenders").select("*").eq("pv_id", currentId!).order("display_order");
      return data || [];
    },
    enabled: !!currentId,
  });
  const { data: existingViolations } = useQuery({
    queryKey: ["pv-violations-review", currentId],
    queryFn: async () => {
      const { data } = await supabase.from("violations").select("*").eq("pv_id", currentId!).order("display_order");
      return data || [];
    },
    enabled: !!currentId,
  });
  const { data: existingSeizures } = useQuery({
    queryKey: ["pv-seizures-review", currentId],
    queryFn: async () => {
      const { data } = await supabase.from("seizures").select("*").eq("pv_id", currentId!).order("display_order");
      return data || [];
    },
    enabled: !!currentId,
  });

  // Populate form when currentPv or sub-records change
  const populateForm = useCallback(() => {
    if (!currentPv) return;
    setPvNumber(currentPv.pv_number || "");
    setPvDate(currentPv.pv_date || "");
    setDepartmentId(currentPv.department_id || "");
    setOfficerId(currentPv.officer_id || "");
    setReferralType(currentPv.referral_type || "");
    setReferralSourceId(currentPv.referral_source_id || "");
    setPvType(currentPv.pv_type || "");
    setParentPvId(currentPv.parent_pv_id || "");
    setNotes(currentPv.notes || "");
  }, [currentPv]);

  useEffect(() => { populateForm(); }, [populateForm]);

  useEffect(() => {
    if (existingOffenders) {
      setOffenders(existingOffenders.map(o => ({
        id: o.id, name_or_company: o.name_or_company, identifier: o.identifier || "",
        person_type: o.person_type || "physical", city: o.city || "", address: o.address || "",
      })));
    } else { setOffenders([]); }
  }, [existingOffenders]);

  useEffect(() => {
    if (existingViolations) {
      setViolations(existingViolations.map(v => ({
        id: v.id, violation_label: v.violation_label, violation_category: v.violation_category || "",
        legal_basis: v.legal_basis || "", severity_level: v.severity_level || "",
      })));
    } else { setViolations([]); }
  }, [existingViolations]);

  useEffect(() => {
    if (existingSeizures) {
      setSeizures(existingSeizures.map(s => ({
        id: s.id, goods_category: s.goods_category || "", goods_type: s.goods_type || "",
        quantity: String(s.quantity || 0), unit: s.unit || "",
        estimated_value: String(s.estimated_value || 0), seizure_type: s.seizure_type || "actual",
      })));
    } else { setSeizures([]); }
  }, [existingSeizures]);

  // Helpers
  const updateOffender = (i: number, field: keyof OffenderRow, value: string) => {
    const u = [...offenders]; u[i] = { ...u[i], [field]: value }; setOffenders(u);
  };
  const updateViolation = (i: number, field: keyof ViolationRow, value: string) => {
    const u = [...violations]; u[i] = { ...u[i], [field]: value }; setViolations(u);
  };
  const updateViolationMulti = (i: number, fields: Partial<ViolationRow>) => {
    const u = [...violations]; u[i] = { ...u[i], ...fields }; setViolations(u);
  };
  const updateSeizure = (i: number, field: keyof SeizureRow, value: string) => {
    const u = [...seizures]; u[i] = { ...u[i], [field]: value }; setSeizures(u);
  };
  const updateSeizureMulti = (i: number, fields: Partial<SeizureRow>) => {
    const u = [...seizures]; u[i] = { ...u[i], ...fields }; setSeizures(u);
  };
  const markDeletedOffender = (i: number) => {
    if (offenders[i].id) { const u = [...offenders]; u[i] = { ...u[i], _deleted: true }; setOffenders(u); }
    else setOffenders(offenders.filter((_, idx) => idx !== i));
  };
  const markDeletedViolation = (i: number) => {
    if (violations[i].id) { const u = [...violations]; u[i] = { ...u[i], _deleted: true }; setViolations(u); }
    else setViolations(violations.filter((_, idx) => idx !== i));
  };
  const markDeletedSeizure = (i: number) => {
    if (seizures[i].id) { const u = [...seizures]; u[i] = { ...u[i], _deleted: true }; setSeizures(u); }
    else setSeizures(seizures.filter((_, idx) => idx !== i));
  };

  const totalActual = seizures.filter(s => !s._deleted && s.seizure_type === "actual").reduce((s, r) => s + (parseFloat(r.estimated_value) || 0), 0);
  const totalVirtual = seizures.filter(s => !s._deleted && s.seizure_type === "virtual").reduce((s, r) => s + (parseFloat(r.estimated_value) || 0), 0);
  const totalPrecautionary = seizures.filter(s => !s._deleted && s.seizure_type === "precautionary").reduce((s, r) => s + (parseFloat(r.estimated_value) || 0), 0);
  const formatCurrency = (v: number) => new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(v);

  // Save current PV
  const handleSave = async (andValidate = false) => {
    if (!user || !currentId) return;
    setSaving(true);
    try {
      const { error: pvErr } = await supabase.from("pv").update({
        pv_number: pvNumber,
        pv_date: pvDate,
        department_id: departmentId || null,
        officer_id: officerId || null,
        referral_type: referralType || null,
        referral_source_id: referralSourceId || null,
        pv_type: pvType || null,
        parent_pv_id: pvType === "ضلع" && parentPvId ? parentPvId : null,
        total_actual_seizure: totalActual,
        total_virtual_seizure: totalVirtual,
        total_precautionary_seizure: totalPrecautionary,
        notes: notes || null,
        ...(andValidate ? { case_status: "under_review" } : {}),
      }).eq("id", currentId);
      if (pvErr) throw pvErr;

      // Offenders
      for (const o of offenders.filter(o => o._deleted && o.id)) {
        await supabase.from("offenders").delete().eq("id", o.id!);
      }
      const activeOffenders = offenders.filter(o => !o._deleted);
      for (let i = 0; i < activeOffenders.length; i++) {
        const o = activeOffenders[i];
        const payload = { name_or_company: o.name_or_company, identifier: o.identifier || null, person_type: o.person_type, city: o.city || null, address: o.address || null, display_order: i + 1 };
        if (o.id) { await supabase.from("offenders").update(payload).eq("id", o.id); }
        else if (o.name_or_company.trim()) { await supabase.from("offenders").insert({ ...payload, pv_id: currentId }); }
      }

      // Violations
      for (const v of violations.filter(v => v._deleted && v.id)) {
        await supabase.from("violations").delete().eq("id", v.id!);
      }
      const activeViolations = violations.filter(v => !v._deleted);
      for (let i = 0; i < activeViolations.length; i++) {
        const v = activeViolations[i];
        const payload = { violation_label: v.violation_label, violation_category: v.violation_category || null, legal_basis: v.legal_basis || null, severity_level: v.severity_level || null, display_order: i + 1 };
        if (v.id) { await supabase.from("violations").update(payload).eq("id", v.id); }
        else if (v.violation_label.trim()) { await supabase.from("violations").insert({ ...payload, pv_id: currentId }); }
      }

      // Seizures
      for (const s of seizures.filter(s => s._deleted && s.id)) {
        await supabase.from("seizures").delete().eq("id", s.id!);
      }
      const activeSeizures = seizures.filter(s => !s._deleted);
      for (let i = 0; i < activeSeizures.length; i++) {
        const s = activeSeizures[i];
        const payload = { goods_category: s.goods_category || null, goods_type: s.goods_type || null, quantity: parseFloat(s.quantity) || 0, unit: s.unit || null, estimated_value: parseFloat(s.estimated_value) || 0, seizure_type: s.seizure_type || "actual", display_order: i + 1 };
        if (s.id) { await supabase.from("seizures").update(payload).eq("id", s.id); }
        else if (s.goods_type?.trim() || parseFloat(s.estimated_value) > 0) { await supabase.from("seizures").insert({ ...payload, pv_id: currentId }); }
      }

      queryClient.invalidateQueries({ queryKey: ["pv-review-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["pv-list"] });
      queryClient.invalidateQueries({ queryKey: ["pv-detail", currentId] });

      if (andValidate) {
        toast.success("تم حفظ المحضر وإرساله للمراجعة");
        // Move to next or stay if was last
        if (currentIndex >= draftPvs.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1));
        }
      } else {
        toast.success("تم حفظ التعديلات");
      }
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || "خطأ غير معروف"));
    } finally {
      setSaving(false);
    }
  };

  const goToNext = () => {
    if (currentIndex < draftPvs.length - 1) setCurrentIndex(currentIndex + 1);
  };
  const goToPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  if (loadingPvs) {
    return <div className="p-6 text-center text-muted-foreground">جاري تحميل المحاضر...</div>;
  }

  if (draftPvs.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ListChecks className="h-16 w-16 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold text-muted-foreground">لا توجد محاضر مسودة للمراجعة</h2>
        <p className="text-sm text-muted-foreground">جميع المحاضر تمت مراجعتها</p>
        <Button variant="outline" onClick={() => navigate("/pv")}>العودة لقائمة المحاضر</Button>
      </div>
    );
  }

  const progressPercent = ((currentIndex + 1) / draftPvs.length) * 100;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Header with navigation */}
      <div className="surface-elevated p-4 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListChecks className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">مراجعة المحاضر المسودة</h1>
              <p className="text-xs text-muted-foreground">{draftPvs.length} محضر في الانتظار</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {currentIndex + 1} / {draftPvs.length}
            </Badge>
          </div>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={goToPrev} disabled={currentIndex === 0}>
            <ChevronRight className="h-4 w-4" />
            السابق
          </Button>
          <div className="text-center">
            <span className="text-sm font-medium font-mono">{currentPv?.pv_number}</span>
            {currentPv?.pv_type === "ضلع" && (
              <Badge variant="secondary" className="mr-2 text-[10px]">ضلع</Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={goToNext} disabled={currentIndex >= draftPvs.length - 1}>
            التالي
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* General Info */}
      <div className="surface-elevated p-6 space-y-4">
        <h2 className="text-sm font-medium">المعلومات العامة</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>عدد المحضر</Label>
            <Input value={pvNumber} onChange={(e) => setPvNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>تاريخ المحضر</Label>
            <Input type="date" value={pvDate} onChange={(e) => setPvDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>القسم</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="اختيار" /></SelectTrigger>
              <SelectContent>
                {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name_ar || d.name_fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الضابط</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger><SelectValue placeholder="اختيار" /></SelectTrigger>
              <SelectContent>
                {officers?.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>طبيعة الإحالة</Label>
            <Select value={referralType || "_none"} onValueChange={(v) => setReferralType(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="اختيار" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— فارغ —</SelectItem>
                <SelectItem value="internal">هياكل داخلية</SelectItem>
                <SelectItem value="external">هياكل خارجية</SelectItem>
                <SelectItem value="flagrante">مباشرة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المصدر</Label>
            <Select value={referralSourceId} onValueChange={setReferralSourceId}>
              <SelectTrigger><SelectValue placeholder="اختيار" /></SelectTrigger>
              <SelectContent>
                {referralSources?.map(r => <SelectItem key={r.id} value={r.id}>{r.label_ar || r.label_fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نوع الوثيقة</Label>
            <Select value={pvType} onValueChange={setPvType}>
              <SelectTrigger><SelectValue placeholder="اختيار" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="محضر">محضر</SelectItem>
                <SelectItem value="ضلع">ضلع</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {pvType === "ضلع" && (
          <ParentPvSelector parentPvId={parentPvId} onChangeParentPvId={setParentPvId} />
        )}
        <div className="space-y-2">
          <Label>ملاحظات</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>

      {/* Offenders */}
      <div className="surface-elevated p-6 space-y-4">
        <h2 className="text-sm font-medium">المخالفون</h2>
        {offenders.filter(o => !o._deleted).map((o, i) => {
          const realIndex = offenders.indexOf(o);
          return (
            <div key={realIndex} className="border border-border rounded-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">#{i + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => markDeletedOffender(realIndex)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={o.name_or_company} onChange={(e) => updateOffender(realIndex, "name_or_company", e.target.value)} placeholder="الإسم / الشركة" />
                <Input value={o.identifier} onChange={(e) => updateOffender(realIndex, "identifier", e.target.value)} placeholder="المعرف" />
                <Select value={o.person_type} onValueChange={(v) => updateOffender(realIndex, "person_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">شخص طبيعي</SelectItem>
                    <SelectItem value="legal">شخص معنوي</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={o.city} onChange={(e) => updateOffender(realIndex, "city", e.target.value)} placeholder="المدينة" />
              </div>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={() => setOffenders([...offenders, { name_or_company: "", identifier: "", person_type: "physical", city: "", address: "" }])}>
          <Plus className="h-4 w-4" />إضافة
        </Button>
      </div>

      {/* Violations */}
      <div className="surface-elevated p-6 space-y-4">
        <h2 className="text-sm font-medium">المخالفات</h2>
        {violations.filter(v => !v._deleted).map((v, i) => {
          const realIndex = violations.indexOf(v);
          return (
            <div key={realIndex} className="border border-border rounded-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">#{i + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => markDeletedViolation(realIndex)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">وصف المخالفة *</Label>
                  <AutocompleteWithAdd
                    value={v.violation_label}
                    onChange={(val) => updateViolation(realIndex, "violation_label", val)}
                    onSelect={(opt) => {
                      const ref = violationRefs?.find(r => r.id === opt.id);
                      if (ref) {
                        updateViolationMulti(realIndex, {
                          violation_label: ref.label_ar || ref.label_fr,
                          ...(ref.category ? { violation_category: ref.category } : {}),
                          ...(ref.legal_basis ? { legal_basis: ref.legal_basis } : {}),
                        });
                      }
                    }}
                    options={violationOptions}
                    placeholder="ابحث عن المخالفة..."
                    addDialogTitle="إضافة مخالفة جديدة للمرجع"
                    addFields={[
                      { key: "label_ar", label: "الوصف بالعربية", required: true },
                      { key: "label_fr", label: "الوصف بالفرنسية", required: true },
                      { key: "category", label: "الصنف" },
                      { key: "legal_basis", label: "الأساس القانوني" },
                    ]}
                    onAddNew={async (vals) => {
                      const { data, error } = await supabase.from("violation_reference").insert({
                        label_fr: vals.label_fr, label_ar: vals.label_ar,
                        category: vals.category || null, legal_basis: vals.legal_basis || null,
                      }).select("id, label_ar, label_fr, category, legal_basis").single();
                      if (error) { toast.error(error.message); throw error; }
                      await refreshAllRefs();
                      updateViolationMulti(realIndex, {
                        violation_label: data.label_ar || data.label_fr,
                        ...(data.category ? { violation_category: data.category } : {}),
                        ...(data.legal_basis ? { legal_basis: data.legal_basis } : {}),
                      });
                      toast.success("تمت إضافة المخالفة للمرجع");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الصنف</Label>
                  <Select value={v.violation_category} onValueChange={(val) => updateViolation(realIndex, "violation_category", val)}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Douane">ديوانية</SelectItem>
                      <SelectItem value="Change">صرفية</SelectItem>
                      <SelectItem value="Commerce">تجارية</SelectItem>
                      <SelectItem value="Droit commun">حق عام</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الأساس القانوني</Label>
                  <Input value={v.legal_basis} onChange={(e) => updateViolation(realIndex, "legal_basis", e.target.value)} placeholder="الفصل XX من المجلة..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الخطورة</Label>
                  <Select value={v.severity_level} onValueChange={(val) => updateViolation(realIndex, "severity_level", val)}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mineur">بسيطة</SelectItem>
                      <SelectItem value="Moyen">متوسطة</SelectItem>
                      <SelectItem value="Grave">خطيرة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={() => setViolations([...violations, { violation_label: "", violation_category: "", legal_basis: "", severity_level: "" }])}>
          <Plus className="h-4 w-4" />إضافة مخالفة
        </Button>
      </div>

      {/* Seizures */}
      <div className="surface-elevated p-6 space-y-4">
        <h2 className="text-sm font-medium">المحجوزات</h2>
        {seizures.filter(s => !s._deleted).map((s, i) => {
          const realIndex = seizures.indexOf(s);
          return (
            <div key={realIndex} className="border border-border rounded-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">#{i + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => markDeletedSeizure(realIndex)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">الصنف</Label>
                  <AutocompleteWithAdd
                    value={s.goods_category}
                    onChange={(val) => updateSeizureMulti(realIndex, { goods_category: val, goods_type: "" })}
                    options={goodsCategoryOptions}
                    placeholder="ابحث عن صنف البضاعة..."
                    addDialogTitle="إضافة صنف بضاعة جديد"
                    addFields={[
                      { key: "category_ar", label: "الصنف بالعربية", required: true },
                      { key: "category_fr", label: "الصنف بالفرنسية", required: true },
                      { key: "type_ar", label: "النوع بالعربية" },
                      { key: "type_fr", label: "النوع بالفرنسية" },
                    ]}
                    onAddNew={async (vals) => {
                      const { error } = await supabase.from("goods_reference").insert({
                        category_fr: vals.category_fr, category_ar: vals.category_ar,
                        type_fr: vals.type_fr || null, type_ar: vals.type_ar || null,
                      });
                      if (error) { toast.error(error.message); throw error; }
                      await refreshAllRefs();
                      updateSeizure(realIndex, "goods_category", vals.category_ar || vals.category_fr);
                      if (vals.type_ar) updateSeizure(realIndex, "goods_type", vals.type_ar);
                      toast.success("تمت إضافة صنف البضاعة");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نوع البضاعة</Label>
                  <AutocompleteWithAdd
                    value={s.goods_type}
                    onChange={(val) => updateSeizure(realIndex, "goods_type", val)}
                    options={getGoodsTypeOptions(s.goods_category)}
                    placeholder="ابحث عن نوع البضاعة..."
                    addDialogTitle="إضافة نوع بضاعة جديد"
                    addFields={[
                      { key: "category_ar", label: "الصنف بالعربية", required: true },
                      { key: "category_fr", label: "الصنف بالفرنسية", required: true },
                      { key: "type_ar", label: "النوع بالعربية", required: true },
                      { key: "type_fr", label: "النوع بالفرنسية", required: true },
                    ]}
                    onAddNew={async (vals) => {
                      const { error } = await supabase.from("goods_reference").insert({
                        category_fr: vals.category_fr, category_ar: vals.category_ar,
                        type_fr: vals.type_fr, type_ar: vals.type_ar,
                      });
                      if (error) { toast.error(error.message); throw error; }
                      await refreshAllRefs();
                      updateSeizure(realIndex, "goods_type", vals.type_ar || vals.type_fr);
                      if (vals.category_ar) updateSeizure(realIndex, "goods_category", vals.category_ar);
                      toast.success("تمت إضافة نوع البضاعة");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نوع الحجز</Label>
                  <Select value={s.seizure_type} onValueChange={(v) => updateSeizure(realIndex, "seizure_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actual">فعلي</SelectItem>
                      <SelectItem value="virtual">صوري</SelectItem>
                      <SelectItem value="precautionary">تحفظي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الكمية</Label>
                  <Input type="number" value={s.quantity} onChange={(e) => updateSeizure(realIndex, "quantity", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الوحدة</Label>
                  <Input value={s.unit} onChange={(e) => updateSeizure(realIndex, "unit", e.target.value)} placeholder="كغ، قطعة..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">القيمة التقديرية (د.ت)</Label>
                  <Input type="number" step="0.001" value={s.estimated_value} onChange={(e) => updateSeizure(realIndex, "estimated_value", e.target.value)} />
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSeizures([...seizures, { goods_category: "", goods_type: "", quantity: "", unit: "", estimated_value: "", seizure_type: "actual" }])}>
            <Plus className="h-4 w-4" />إضافة بضاعة
          </Button>
          <div className="text-sm space-x-4 space-x-reverse">
            <span className="text-muted-foreground">فعلي: <span className="font-mono text-foreground">{formatCurrency(totalActual)}</span></span>
            <span className="text-muted-foreground">صوري: <span className="font-mono text-foreground">{formatCurrency(totalVirtual)}</span></span>
            <span className="text-muted-foreground">تحفظي: <span className="font-mono text-foreground">{formatCurrency(totalPrecautionary)}</span></span>
            <span className="font-medium">المجموع: <span className="font-mono">{formatCurrency(totalActual + totalVirtual + totalPrecautionary)}</span></span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="surface-elevated p-4 rounded-lg flex items-center justify-between gap-2 sticky bottom-4">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "جاري الحفظ..." : "حفظ"}
        </Button>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" disabled={saving} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4" />
                حفظ وإرسال للمراجعة
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>تأكيد الإرسال للمراجعة</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم حفظ التعديلات وتغيير حالة المحضر {currentPv?.pv_number} من "مسودة" إلى "قيد المراجعة". هل تريد المتابعة؟
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleSave(true)}>تأكيد</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {currentIndex < draftPvs.length - 1 && (
            <Button variant="outline" onClick={goToNext}>
              <SkipForward className="h-4 w-4" />
              تخطي للتالي
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PvReviewPage;
