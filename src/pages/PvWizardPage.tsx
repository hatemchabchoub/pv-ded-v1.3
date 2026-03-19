import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { Plus, Trash2, ArrowLeft, ArrowRight, Save, Check, AlertCircle } from "lucide-react";
import ParentPvSelector from "@/components/pv/ParentPvSelector";
import { AutocompleteWithAdd, AutocompleteOption } from "@/components/ui/autocomplete-with-add";
import { toast } from "sonner";

const steps = [
  "المعلومات العامة",
  "المخالفون",
  "المخالفات",
  "المحجوزات",
  "المراجعة والتصديق",
];

interface Offender {
  name_or_company: string;
  identifier: string;
  person_type: string;
  city: string;
  address: string;
}

interface Violation {
  violation_label: string;
  violation_category: string;
  legal_basis: string;
  severity_level: string;
}

interface Seizure {
  goods_category: string;
  goods_type: string;
  quantity: string;
  unit: string;
  estimated_value: string;
  seizure_type: string;
}

const emptyOffender = (): Offender => ({ name_or_company: "", identifier: "", person_type: "physical", city: "", address: "" });
const emptyViolation = (): Violation => ({ violation_label: "", violation_category: "", legal_basis: "", severity_level: "" });
const emptySeizure = (): Seizure => ({ goods_category: "", goods_type: "", quantity: "", unit: "", estimated_value: "", seizure_type: "actual" });

const PvWizardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [sourceImportId, setSourceImportId] = useState<string | null>(null);

  const [pvNumber, setPvNumber] = useState("");
  const [pvDate, setPvDate] = useState(new Date().toISOString().split("T")[0]);
  const [departmentId, setDepartmentId] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [referralType, setReferralType] = useState("");
  const [referralSourceId, setReferralSourceId] = useState("");
  const [pvType, setPvType] = useState("");
  const [parentPvId, setParentPvId] = useState("");
  const [notes, setNotes] = useState("");

  const [offenders, setOffenders] = useState<Offender[]>([emptyOffender()]);
  const [violations, setViolations] = useState<Violation[]>([emptyViolation()]);
  const [seizures, setSeizures] = useState<Seizure[]>([emptySeizure()]);

  useEffect(() => {
    let p: any = null;
    let importId: string | null = null;

    // Check location.state first (normal navigation)
    const state = location.state as any;
    if (state?.prefill) {
      p = state.prefill;
      importId = state.importId || null;
    }
    
    // Check sessionStorage (opened from new tab via OCR page)
    if (!p) {
      const stored = localStorage.getItem("pv_prefill");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          p = parsed.prefill;
          importId = parsed.importId || null;
        } catch { /* ignore */ }
        localStorage.removeItem("pv_prefill");
      }
    }

    if (p) {
      if (p.pv_number) setPvNumber(p.pv_number);
      if (p.pv_date) setPvDate(p.pv_date);
      if (p.pv_type) setPvType(p.pv_type);
      if (p.referral_type) setReferralType(p.referral_type);
      if (p.notes) setNotes(p.notes);
      if (p.offenders?.length) {
        setOffenders(p.offenders.map((o: any) => ({
          name_or_company: o.name_or_company || "", identifier: o.identifier || "",
          person_type: o.person_type || "physical", city: o.city || "", address: o.address || "",
        })));
      }
      if (p.violations?.length) {
        setViolations(p.violations.map((v: any) => ({
          violation_label: v.violation_label || "", violation_category: v.violation_category || "",
          legal_basis: v.legal_basis || "", severity_level: v.severity_level || "",
        })));
      }
      if (p.seizures?.length) {
        setSeizures(p.seizures.map((s: any) => ({
          goods_category: s.goods_category || "", goods_type: s.goods_type || "",
          quantity: String(s.quantity || ""), unit: s.unit || "",
          estimated_value: String(s.estimated_value || ""), seizure_type: s.seizure_type || "actual",
        })));
      }
      if (importId) setSourceImportId(importId);
      toast.success("تم ملء البيانات تلقائيا من الاستخراج");
    }
  }, [location.state]);

  const { data: departments, refetch: refetchDepartments } = useQuery({
    queryKey: ["ref-departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name_fr, name_ar, code").eq("active", true).order("name_fr");
      return data || [];
    },
  });

  const { data: officers, refetch: refetchOfficers } = useQuery({
    queryKey: ["ref-officers", departmentId],
    queryFn: async () => {
      let q = supabase.from("officers").select("id, full_name, badge_number, rank_label, department_id").eq("active", true).order("full_name");
      if (departmentId) q = q.eq("department_id", departmentId);
      const { data } = await q;
      return data || [];
    },
  });

  // Refresh all reference lists to keep dropdowns in sync
  const refreshAllRefs = async () => {
    await Promise.all([
      refetchDepartments(),
      refetchOfficers(),
      refetchReferralSources(),
      refetchViolationRefs(),
      refetchGoodsRefs(),
    ]);
  };

  const { data: referralSources, refetch: refetchReferralSources } = useQuery({
    queryKey: ["ref-referral-sources"],
    queryFn: async () => {
      const { data } = await supabase.from("referral_sources").select("id, label_fr, label_ar").eq("active", true).order("label_fr");
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

  const referralOptions: AutocompleteOption[] = (referralSources || []).map(r => ({
    id: r.id, label: r.label_ar || r.label_fr,
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

  const [referralSourceLabel, setReferralSourceLabel] = useState("");

  const updateOffender = (i: number, field: keyof Offender, value: string) => {
    const updated = [...offenders]; updated[i] = { ...updated[i], [field]: value }; setOffenders(updated);
  };
  const updateViolation = (i: number, field: keyof Violation, value: string) => {
    setViolations(prev => { const updated = [...prev]; updated[i] = { ...updated[i], [field]: value }; return updated; });
  };
  const updateViolationMulti = (i: number, fields: Partial<Violation>) => {
    setViolations(prev => { const updated = [...prev]; updated[i] = { ...updated[i], ...fields }; return updated; });
  };
  const updateSeizure = (i: number, field: keyof Seizure, value: string) => {
    setSeizures(prev => { const updated = [...prev]; updated[i] = { ...updated[i], [field]: value }; return updated; });
  };
  const updateSeizureMulti = (i: number, fields: Partial<Seizure>) => {
    setSeizures(prev => { const updated = [...prev]; updated[i] = { ...updated[i], ...fields }; return updated; });
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(v);

  const totalByType = (type: string) =>
    seizures.filter(s => s.seizure_type === type).reduce((sum, s) => sum + (parseFloat(s.estimated_value) || 0), 0);
  const totalActual = totalByType("actual");
  const totalVirtual = totalByType("virtual");
  const totalPrecautionary = totalByType("precautionary");
  const totalSeizure = seizures.reduce((sum, s) => sum + (parseFloat(s.estimated_value) || 0), 0);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!pvNumber.trim()) errs.push("عدد المحضر مطلوب");
    if (!pvDate) errs.push("تاريخ المحضر مطلوب");
    if (!departmentId) errs.push("القسم مطلوب");
    if (!officerId) errs.push("الضابط مطلوب");
    if (offenders.filter(o => o.name_or_company.trim()).length === 0) errs.push("مخالف واحد على الأقل مطلوب");
    if (violations.filter(v => v.violation_label.trim()).length === 0) errs.push("مخالفة واحدة على الأقل مطلوبة");
    return errs;
  };

  const savePv = async (status: "draft" | "under_review") => {
    if (!user) return;
    if (status === "under_review") {
      const errs = validate();
      if (errs.length > 0) {
        setErrors(errs);
        toast.error("يرجى تصحيح الأخطاء قبل التصديق");
        return;
      }
    }
    setErrors([]);
    setSaving(true);

    try {
      // Check for duplicate pv_number
      const { data: existing } = await supabase
        .from("pv")
        .select("id")
        .eq("pv_number", pvNumber.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        setSaving(false);
        toast.error("هذا العدد موجود مسبقا — يرجى استخدام عدد محضر آخر");
        setErrors(["عدد المحضر موجود مسبقا في قاعدة البيانات"]);
        return;
      }

    try {
      const dept = departments?.find(d => d.id === departmentId);
      const deptCode = dept?.code || "UNK";
      const year = pvDate?.substring(0, 4) || new Date().getFullYear();
      const internalRef = `PV-${year}-${deptCode}-${pvNumber.replace(/\//g, "-")}`;

      const { data: pv, error: pvError } = await supabase.from("pv").insert({
        internal_reference: internalRef,
        pv_number: pvNumber,
        pv_date: pvDate,
        department_id: departmentId || null,
        officer_id: officerId || null,
        referral_type: referralType || null,
        referral_source_id: referralSourceId || null,
        pv_type: pvType || null,
        case_status: status,
        parent_pv_id: pvType === "ضلع" && parentPvId ? parentPvId : null,
        total_actual_seizure: totalActual,
        total_virtual_seizure: totalVirtual,
        total_precautionary_seizure: totalPrecautionary,
        notes: notes || null,
        source_import_type: sourceImportId ? "ocr" : "manual",
        created_by: user.id,
      }).select("id").single();

      if (pvError) throw pvError;

      const validOffenders = offenders.filter(o => o.name_or_company.trim());
      if (validOffenders.length > 0) {
        const { error: oErr } = await supabase.from("offenders").insert(
          validOffenders.map((o, i) => ({
            pv_id: pv.id, display_order: i + 1, name_or_company: o.name_or_company,
            identifier: o.identifier || null, person_type: o.person_type || "physical",
            city: o.city || null, address: o.address || null,
          }))
        );
        if (oErr) throw oErr;
      }

      const validViolations = violations.filter(v => v.violation_label.trim());
      if (validViolations.length > 0) {
        const { error: vErr } = await supabase.from("violations").insert(
          validViolations.map((v, i) => ({
            pv_id: pv.id, display_order: i + 1, violation_label: v.violation_label,
            violation_category: v.violation_category || null,
            legal_basis: v.legal_basis || null, severity_level: v.severity_level || null,
          }))
        );
        if (vErr) throw vErr;
      }

      const validSeizures = seizures.filter(s => parseFloat(s.estimated_value) > 0 || s.goods_type.trim());
      if (validSeizures.length > 0) {
        const { error: sErr } = await supabase.from("seizures").insert(
          validSeizures.map((s, i) => ({
            pv_id: pv.id, display_order: i + 1, seizure_type: s.seizure_type || "actual",
            goods_category: s.goods_category || null, goods_type: s.goods_type || null,
            quantity: parseFloat(s.quantity) || 0, unit: s.unit || null,
            estimated_value: parseFloat(s.estimated_value) || 0,
          }))
        );
        if (sErr) throw sErr;
      }

      if (sourceImportId) {
        const { error: importLinkError } = await supabase
          .from("document_imports")
          .update({ pv_id: pv.id })
          .eq("id", sourceImportId)
          .eq("uploaded_by", user.id);

        if (importLinkError) {
          toast.error("تم إنشاء المحضر لكن تعذر ربطه بسجل الاستيراد");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["pv-list"] });
      toast.success(status === "draft" ? "تم حفظ المحضر كمسودة" : "تم إنشاء المحضر وتقديمه للمراجعة");
      navigate(`/pv/${pv.id}`);
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || "خطأ غير معروف"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">محضر جديد</h1>

      {/* Steps */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <button
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                i === currentStep ? "bg-primary text-primary-foreground"
                  : i < currentStep ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="font-mono">{i + 1}</span>
              <span className="hidden sm:inline">{step}</span>
            </button>
            {i < steps.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{e}
            </p>
          ))}
        </div>
      )}

      {/* Step 0: General */}
      {currentStep === 0 && (
        <div className="surface-elevated p-6 space-y-4">
          <h2 className="text-sm font-medium">{steps[0]}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>عدد المحضر *</Label>
              <Input value={pvNumber} onChange={(e) => setPvNumber(e.target.value)} placeholder="142/2025" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ المحضر *</Label>
              <Input type="date" value={pvDate} onChange={(e) => setPvDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>القسم *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {departments?.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name_ar || d.name_fr} — {d.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الضابط المسؤول *</Label>
              <Select value={officerId} onValueChange={setOfficerId}>
                <SelectTrigger><SelectValue placeholder="اختر الضابط" /></SelectTrigger>
                <SelectContent>
                  {officers?.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.rank_label ? `${o.rank_label} ` : ""}{o.full_name} {o.badge_number ? `(${o.badge_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>طبيعة الإحالة</Label>
              <Select value={referralType || "_none"} onValueChange={(v) => setReferralType(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— فارغ —</SelectItem>
                  <SelectItem value="internal">هياكل داخلية</SelectItem>
                  <SelectItem value="external">هياكل خارجية</SelectItem>
                  <SelectItem value="flagrante">مباشرة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>مصدر الإحالة</Label>
              <AutocompleteWithAdd
                value={referralSourceLabel}
                onChange={(val) => {
                  setReferralSourceLabel(val);
                  const match = referralSources?.find(r => (r.label_ar || r.label_fr) === val);
                  setReferralSourceId(match?.id || "");
                }}
                onSelect={(opt) => { setReferralSourceId(opt.id); setReferralSourceLabel(opt.label); }}
                options={referralOptions}
                placeholder="ابحث عن مصدر الإحالة..."
                addDialogTitle="إضافة مصدر إحالة جديد"
                addFields={[
                  { key: "label_ar", label: "الاسم بالعربية", required: true },
                  { key: "label_fr", label: "الاسم بالفرنسية", required: true },
                ]}
                onAddNew={async (vals) => {
                  const { data, error } = await supabase.from("referral_sources").insert({
                    label_fr: vals.label_fr, label_ar: vals.label_ar,
                  }).select("id, label_fr, label_ar").single();
                  if (error) { toast.error(error.message); throw error; }
                  await refreshAllRefs();
                  setReferralSourceId(data.id);
                  setReferralSourceLabel(data.label_ar || data.label_fr);
                  toast.success("تمت إضافة مصدر الإحالة");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>نوع الوثيقة</Label>
              <Select value={pvType} onValueChange={setPvType}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="محضر">محضر</SelectItem>
                  <SelectItem value="ضلع">ضلع</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Parent PV selector — shown only when type is ضلع */}
          {pvType === "ضلع" && (
            <ParentPvSelector parentPvId={parentPvId} onChangeParentPvId={setParentPvId} currentPvNumber={pvNumber} />
          )}


          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="ملاحظات..." />
          </div>
        </div>
      )}

      {/* Step 1: Offenders */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium">المخالفون</h2>
          {offenders.map((o, i) => (
            <div key={i} className="surface-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">المخالف {i + 1}</h3>
                {offenders.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setOffenders(offenders.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">الاسم أو الشركة *</Label>
                  <Input value={o.name_or_company} onChange={(e) => updateOffender(i, "name_or_company", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المعرف (ب.ت.و / سجل تجاري / جواز)</Label>
                  <Input value={o.identifier} onChange={(e) => updateOffender(i, "identifier", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نوع الشخص</Label>
                  <Select value={o.person_type} onValueChange={(v) => updateOffender(i, "person_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">شخص طبيعي</SelectItem>
                      <SelectItem value="legal">شخص معنوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المدينة</Label>
                  <Input value={o.city} onChange={(e) => updateOffender(i, "city", e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">العنوان</Label>
                  <Input value={o.address} onChange={(e) => updateOffender(i, "address", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setOffenders([...offenders, emptyOffender()])}>
            <Plus className="h-4 w-4" />
            إضافة مخالف
          </Button>
        </div>
      )}

      {/* Step 2: Violations */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium">المخالفات</h2>
          {violations.map((v, i) => (
            <div key={i} className="surface-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">المخالفة {i + 1}</h3>
                {violations.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setViolations(violations.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">وصف المخالفة *</Label>
                  <AutocompleteWithAdd
                    value={v.violation_label}
                    onChange={(val) => updateViolation(i, "violation_label", val)}
                    onSelect={(opt) => {
                      const ref = violationRefs?.find(r => r.id === opt.id);
                      if (ref) {
                        updateViolationMulti(i, {
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
                      updateViolationMulti(i, {
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
                  <Select value={v.violation_category} onValueChange={(val) => updateViolation(i, "violation_category", val)}>
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
                  <Input value={v.legal_basis} onChange={(e) => updateViolation(i, "legal_basis", e.target.value)} placeholder="الفصل XX من المجلة..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الخطورة</Label>
                  <Select value={v.severity_level} onValueChange={(val) => updateViolation(i, "severity_level", val)}>
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
          ))}
          <Button variant="outline" size="sm" onClick={() => setViolations([...violations, emptyViolation()])}>
            <Plus className="h-4 w-4" />
            إضافة مخالفة
          </Button>
        </div>
      )}

      {/* Step 3: Seizures */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium">المحجوزات</h2>
          {seizures.map((s, i) => (
            <div key={i} className="surface-elevated p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">البضاعة {i + 1}</h3>
                {seizures.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setSeizures(seizures.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">الصنف</Label>
                  <AutocompleteWithAdd
                    value={s.goods_category}
                    onChange={(val) => updateSeizureMulti(i, { goods_category: val, goods_type: "" })}
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
                      updateSeizure(i, "goods_category", vals.category_ar || vals.category_fr);
                      if (vals.type_ar) updateSeizure(i, "goods_type", vals.type_ar);
                      toast.success("تمت إضافة صنف البضاعة");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نوع البضاعة</Label>
                  <AutocompleteWithAdd
                    value={s.goods_type}
                    onChange={(val) => updateSeizure(i, "goods_type", val)}
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
                      updateSeizure(i, "goods_type", vals.type_ar || vals.type_fr);
                      if (vals.category_ar) updateSeizure(i, "goods_category", vals.category_ar);
                      toast.success("تمت إضافة نوع البضاعة");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نوع الحجز</Label>
                  <Select value={s.seizure_type} onValueChange={(v) => updateSeizure(i, "seizure_type", v)}>
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
                  <Input type="number" value={s.quantity} onChange={(e) => updateSeizure(i, "quantity", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الوحدة</Label>
                  <Input value={s.unit} onChange={(e) => updateSeizure(i, "unit", e.target.value)} placeholder="كغ، قطعة..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">القيمة التقديرية (د.ت)</Label>
                  <Input type="number" step="0.001" value={s.estimated_value} onChange={(e) => updateSeizure(i, "estimated_value", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setSeizures([...seizures, emptySeizure()])}>
              <Plus className="h-4 w-4" />
              إضافة بضاعة
            </Button>
            <div className="text-sm space-x-4 space-x-reverse">
              <span className="text-muted-foreground">فعلي: <span className="font-mono text-foreground">{formatCurrency(totalActual)}</span></span>
              <span className="text-muted-foreground">صوري: <span className="font-mono text-foreground">{formatCurrency(totalVirtual)}</span></span>
              <span className="text-muted-foreground">تحفظي: <span className="font-mono text-foreground">{formatCurrency(totalPrecautionary)}</span></span>
              <span className="font-medium">المجموع: <span className="font-mono">{formatCurrency(totalSeizure)}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="surface-elevated p-6 space-y-4">
            <h2 className="text-sm font-medium mb-3">ملخص المحضر</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div><span className="text-muted-foreground">عدد المحضر:</span> <span className="font-medium">{pvNumber || "—"}</span></div>
              <div><span className="text-muted-foreground">التاريخ:</span> <span className="font-medium">{pvDate || "—"}</span></div>
              <div><span className="text-muted-foreground">القسم:</span> <span className="font-medium">{departments?.find(d => d.id === departmentId)?.name_ar || "—"}</span></div>
              <div><span className="text-muted-foreground">الضابط:</span> <span className="font-medium">{officers?.find(o => o.id === officerId)?.full_name || "—"}</span></div>
              <div><span className="text-muted-foreground">الإحالة:</span> <span className="font-medium">{referralType || "—"}</span></div>
              <div><span className="text-muted-foreground">النوع:</span> <span className="font-medium">{pvType || "—"}</span></div>
            </div>

            <div className="border-t pt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">المخالفون:</span>{" "}
                <span className="font-medium">{offenders.filter(o => o.name_or_company.trim()).length}</span>
                <ul className="mt-1 text-xs text-muted-foreground">
                  {offenders.filter(o => o.name_or_company.trim()).map((o, i) => <li key={i}>• {o.name_or_company}</li>)}
                </ul>
              </div>
              <div>
                <span className="text-muted-foreground">المخالفات:</span>{" "}
                <span className="font-medium">{violations.filter(v => v.violation_label.trim()).length}</span>
                <ul className="mt-1 text-xs text-muted-foreground">
                  {violations.filter(v => v.violation_label.trim()).map((v, i) => <li key={i}>• {v.violation_label}</li>)}
                </ul>
              </div>
              <div>
                <span className="text-muted-foreground">المحجوزات:</span>{" "}
                <span className="font-medium">{seizures.filter(s => s.goods_type.trim() || parseFloat(s.estimated_value) > 0).length}</span>
                <div className="mt-1 text-xs space-y-0.5">
                  <div>فعلي: <span className="font-mono">{formatCurrency(totalActual)}</span></div>
                  <div>صوري: <span className="font-mono">{formatCurrency(totalVirtual)}</span></div>
                  <div>تحفظي: <span className="font-mono">{formatCurrency(totalPrecautionary)}</span></div>
                  <div className="font-medium pt-1 border-t">المجموع: <span className="font-mono">{formatCurrency(totalSeizure)}</span></div>
                </div>
              </div>
            </div>

            {notes && (
              <div className="border-t pt-3">
                <span className="text-sm text-muted-foreground">ملاحظات:</span>
                <p className="text-sm mt-1">{notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline" size="sm"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ArrowRight className="h-4 w-4" />
          السابق
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => savePv("draft")} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : "حفظ كمسودة"}
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)}>
              التالي
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => savePv("under_review")} disabled={saving}>
              <Check className="h-4 w-4" />
              {saving ? "جاري الحفظ..." : "تصديق وإنشاء"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PvWizardPage;
