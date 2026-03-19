import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  under_review: "قيد المراجعة",
  validated: "مصادق عليه",
  archived: "مؤرشف",
};

const REFERRAL_TYPE_REVERSE: Record<string, string> = {
  internal: "إحالات هياكل داخلية",
  external: "إحالات هياكل خارجية",
  flagrante: "مباشرة",
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: "عادي",
  high: "مرتفع",
  urgent: "عاجل",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "يدوي",
  excel: "Excel",
  pdf: "PDF",
};

// All export columns in order
const EXPORT_COLUMNS: { key: string; header: string }[] = [
  { key: "pv_number", header: "عدد المحضر" },
  { key: "internal_reference", header: "المرجع الداخلي" },
  { key: "pv_date", header: "تاريخ المحضر" },
  { key: "pv_type", header: "النوع (محضر/ضلع)" },
  { key: "case_status", header: "حالة الملف" },
  { key: "priority_level", header: "الأولوية" },
  { key: "parent_pv_number", header: "المحضر الأصلي" },
  { key: "department_name", header: "القسم" },
  { key: "unit_name", header: "الوحدة" },
  { key: "officer_full", header: "الضابط المكلف بالملف" },
  { key: "referral_type", header: "طبيعة الإحالة" },
  { key: "referral_source", header: "مصدر الإحالة" },
  { key: "offender1_name", header: "المخالف 1 - الإسم" },
  { key: "offender1_id", header: "المخالف 1 - المعرف" },
  { key: "offender1_address", header: "المخالف 1 - العنوان" },
  { key: "offender1_type", header: "المخالف 1 - النوع" },
  { key: "offender2_name", header: "المخالف 2 - الإسم" },
  { key: "offender2_id", header: "المخالف 2 - المعرف" },
  { key: "offender2_address", header: "المخالف 2 - العنوان" },
  { key: "offender2_type", header: "المخالف 2 - النوع" },
  { key: "offender3_name", header: "المخالف 3 - الإسم" },
  { key: "offender3_id", header: "المخالف 3 - المعرف" },
  { key: "violation1", header: "المخالفة 1" },
  { key: "violation1_category", header: "صنف المخالفة 1" },
  { key: "violation1_legal", header: "السند القانوني 1" },
  { key: "violation2", header: "المخالفة 2" },
  { key: "violation2_category", header: "صنف المخالفة 2" },
  { key: "customs_violation", header: "مخالفة ديوانية" },
  { key: "currency_violation", header: "مخالفة صرفية" },
  { key: "public_law_violation", header: "مخالفة حق عام" },
  { key: "total_actual_seizure", header: "مجموع المحجوز الفعلي" },
  { key: "total_virtual_seizure", header: "مجموع المحجوز الصوري" },
  { key: "total_precautionary_seizure", header: "مجموع المحجوز التحفظي" },
  { key: "total_seizure", header: "مجموع المحجوز الكلي" },
  { key: "seizure_renewal", header: "تجديد حجز" },
  { key: "seizure_details", header: "تفاصيل المحجوزات" },
  { key: "source_import_type", header: "مصدر الإدخال" },
  { key: "notes", header: "ملاحظات" },
  { key: "created_at", header: "تاريخ الإنشاء" },
  { key: "updated_at", header: "تاريخ التعديل" },
];

interface ExportOptions {
  statusFilter?: string;
  search?: string;
  typeFilter?: string;
  deptFilter?: string;
  officerFilter?: string;
}

export async function exportPvToExcel(options: ExportOptions = {}): Promise<void> {
  // Fetch all PVs
  let query = supabase
    .from("pv")
    .select(`
      id, pv_number, internal_reference, pv_date, pv_type, case_status,
      priority_level, parent_pv_id, referral_type,
      total_actual_seizure, total_virtual_seizure, total_precautionary_seizure, total_seizure,
      customs_violation, currency_violation, public_law_violation, seizure_renewal,
      notes, source_import_type, created_at, updated_at,
      departments (name_ar, name_fr),
      units (name_ar, name_fr),
      officers (full_name, badge_number, rank_label),
      referral_sources (label_ar)
    `)
    .order("pv_date", { ascending: false });

  if (options.statusFilter && options.statusFilter !== "all") {
    query = query.eq("case_status", options.statusFilter);
  }
  if (options.typeFilter && options.typeFilter !== "all") {
    query = query.eq("pv_type", options.typeFilter);
  }
  if (options.deptFilter && options.deptFilter !== "all") {
    query = query.eq("department_id", options.deptFilter);
  }
  if (options.officerFilter && options.officerFilter !== "all") {
    query = query.eq("officer_id", options.officerFilter);
  }
  if (options.search) {
    query = query.or(`pv_number.ilike.%${options.search}%,internal_reference.ilike.%${options.search}%`);
  }

  const { data: pvList, error } = await query;
  if (error) throw error;
  if (!pvList || pvList.length === 0) throw new Error("لا توجد بيانات للتصدير");

  const pvIds = pvList.map((p: any) => p.id);
  const parentIds = pvList.map((p: any) => p.parent_pv_id).filter(Boolean);

  // Fetch related data in parallel
  const [{ data: offenders }, { data: violations }, { data: seizures }, { data: parentPvs }] = await Promise.all([
    supabase.from("offenders").select("pv_id, display_order, name_or_company, identifier, address, city, person_type").in("pv_id", pvIds).order("display_order"),
    supabase.from("violations").select("pv_id, display_order, violation_label, violation_category, legal_basis").in("pv_id", pvIds).order("display_order"),
    supabase.from("seizures").select("pv_id, display_order, seizure_type, goods_category, goods_type, quantity, unit, estimated_value").in("pv_id", pvIds).order("display_order"),
    parentIds.length > 0
      ? supabase.from("pv").select("id, pv_number").in("id", parentIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Index by pv_id
  const offenderMap: Record<string, any[]> = {};
  offenders?.forEach((o) => { (offenderMap[o.pv_id] ??= []).push(o); });

  const violationMap: Record<string, any[]> = {};
  violations?.forEach((v) => { (violationMap[v.pv_id] ??= []).push(v); });

  const seizureMap: Record<string, any[]> = {};
  seizures?.forEach((s) => { (seizureMap[s.pv_id] ??= []).push(s); });

  const parentPvMap: Record<string, string> = {};
  parentPvs?.forEach((p: any) => { parentPvMap[p.id] = p.pv_number; });

  // Build rows
  const rows = pvList.map((pv: any) => {
    const offs = offenderMap[pv.id] || [];
    const off1 = offs.find((o: any) => o.display_order === 1);
    const off2 = offs.find((o: any) => o.display_order === 2);
    const off3 = offs.find((o: any) => o.display_order === 3);

    const viols = violationMap[pv.id] || [];
    const v1 = viols.find((v: any) => v.display_order === 1);
    const v2 = viols.find((v: any) => v.display_order === 2);

    const seiz = seizureMap[pv.id] || [];
    const seizureDetails = seiz.map((s: any) =>
      `${s.goods_category || ""} ${s.goods_type || ""} - ${s.quantity || 0} ${s.unit || ""} (${s.estimated_value || 0} د.ت) [${s.seizure_type === "actual" ? "فعلي" : s.seizure_type === "virtual" ? "صوري" : "تحفظي"}]`
    ).join(" | ");

    const officerParts = [
      pv.officers?.rank_label,
      pv.officers?.full_name,
      pv.officers?.badge_number ? `(${pv.officers.badge_number})` : null,
    ].filter(Boolean).join(" ");

    const personTypeLabel = (t: string | null) => t === "moral" ? "شركة" : "شخص طبيعي";

    const row: Record<string, any> = {};
    for (const col of EXPORT_COLUMNS) {
      switch (col.key) {
        case "pv_number": row[col.header] = pv.pv_number; break;
        case "internal_reference": row[col.header] = pv.internal_reference || ""; break;
        case "pv_date": row[col.header] = pv.pv_date; break;
        case "pv_type": row[col.header] = pv.pv_type || ""; break;
        case "case_status": row[col.header] = STATUS_LABELS[pv.case_status] || pv.case_status || ""; break;
        case "priority_level": row[col.header] = PRIORITY_LABELS[pv.priority_level] || pv.priority_level || ""; break;
        case "parent_pv_number": row[col.header] = pv.parent_pv_id ? (parentPvMap[pv.parent_pv_id] || "") : ""; break;
        case "department_name": row[col.header] = pv.departments?.name_ar || pv.departments?.name_fr || ""; break;
        case "unit_name": row[col.header] = pv.units?.name_ar || pv.units?.name_fr || ""; break;
        case "officer_full": row[col.header] = officerParts; break;
        case "referral_type": row[col.header] = REFERRAL_TYPE_REVERSE[pv.referral_type] || pv.referral_type || ""; break;
        case "referral_source": row[col.header] = pv.referral_sources?.label_ar || ""; break;
        case "offender1_name": row[col.header] = off1?.name_or_company || ""; break;
        case "offender1_id": row[col.header] = off1?.identifier || ""; break;
        case "offender1_address": row[col.header] = [off1?.address, off1?.city].filter(Boolean).join(", ") || ""; break;
        case "offender1_type": row[col.header] = off1 ? personTypeLabel(off1.person_type) : ""; break;
        case "offender2_name": row[col.header] = off2?.name_or_company || ""; break;
        case "offender2_id": row[col.header] = off2?.identifier || ""; break;
        case "offender2_address": row[col.header] = [off2?.address, off2?.city].filter(Boolean).join(", ") || ""; break;
        case "offender2_type": row[col.header] = off2 ? personTypeLabel(off2.person_type) : ""; break;
        case "offender3_name": row[col.header] = off3?.name_or_company || ""; break;
        case "offender3_id": row[col.header] = off3?.identifier || ""; break;
        case "violation1": row[col.header] = v1?.violation_label || ""; break;
        case "violation1_category": row[col.header] = v1?.violation_category || ""; break;
        case "violation1_legal": row[col.header] = v1?.legal_basis || ""; break;
        case "violation2": row[col.header] = v2?.violation_label || ""; break;
        case "violation2_category": row[col.header] = v2?.violation_category || ""; break;
        case "customs_violation": row[col.header] = pv.customs_violation ? "نعم" : ""; break;
        case "currency_violation": row[col.header] = pv.currency_violation ? "نعم" : ""; break;
        case "public_law_violation": row[col.header] = pv.public_law_violation ? "نعم" : ""; break;
        case "total_actual_seizure": row[col.header] = pv.total_actual_seizure || 0; break;
        case "total_virtual_seizure": row[col.header] = pv.total_virtual_seizure || 0; break;
        case "total_precautionary_seizure": row[col.header] = pv.total_precautionary_seizure || 0; break;
        case "total_seizure": row[col.header] = pv.total_seizure || 0; break;
        case "seizure_renewal": row[col.header] = pv.seizure_renewal ? "نعم" : ""; break;
        case "seizure_details": row[col.header] = seizureDetails; break;
        case "source_import_type": row[col.header] = SOURCE_LABELS[pv.source_import_type] || pv.source_import_type || ""; break;
        case "notes": row[col.header] = pv.notes || ""; break;
        case "created_at": row[col.header] = pv.created_at ? new Date(pv.created_at).toLocaleDateString("fr-TN") : ""; break;
        case "updated_at": row[col.header] = pv.updated_at ? new Date(pv.updated_at).toLocaleDateString("fr-TN") : ""; break;
      }
    }
    return row;
  });

  // Generate workbook
  const headers = EXPORT_COLUMNS.map((c) => c.header);
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Column widths
  ws["!cols"] = EXPORT_COLUMNS.map((col) => {
    if (col.key === "seizure_details" || col.key === "notes") return { wch: 40 };
    if (col.key.includes("name") || col.key === "officer_full") return { wch: 28 };
    return { wch: 20 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المحاضر");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `محاضر_${today}.xlsx`);
}
