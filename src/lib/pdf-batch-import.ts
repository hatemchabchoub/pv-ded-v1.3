import { supabase } from "@/integrations/supabase/client";

export interface PdfFileEntry {
  file: File;
  id: string;
  status: "pending" | "uploading" | "processing" | "extracted" | "error";
  error?: string;
  importId?: string;
  extractedData?: ExtractedPvData;
  confidence?: number;
}

export interface ExtractedPvData {
  pv_number?: string;
  pv_date?: string;
  department_name?: string;
  officer_name?: string;
  officer_badge?: string;
  officer_rank?: string;
  referral_type?: string;
  referral_source?: string;
  pv_type?: string;
  customs_violation?: boolean;
  currency_violation?: boolean;
  public_law_violation?: boolean;
  seizure_renewal?: boolean;
  total_actual_seizure?: number;
  total_virtual_seizure?: number;
  total_precautionary_seizure?: number;
  notes?: string;
  offenders?: Array<{
    name_or_company: string;
    identifier?: string;
    person_type?: string;
    city?: string;
    address?: string;
  }>;
  violations?: Array<{
    violation_label: string;
    violation_category?: string;
    legal_basis?: string;
  }>;
  seizures?: Array<{
    goods_category?: string;
    goods_type?: string;
    quantity?: number;
    unit?: string;
    estimated_value?: number;
    seizure_type?: string;
  }>;
}

export async function uploadAndProcessPdf(
  file: File,
  userId: string,
  onStatusChange: (status: PdfFileEntry["status"], error?: string) => void
): Promise<{ importId: string; extracted: ExtractedPvData; confidence: number }> {
  onStatusChange("uploading");

  // Upload file to storage
  const storagePath = `pdf-imports/${userId}/${Date.now()}-${file.name}`;
  const { error: uploadErr } = await supabase.storage
    .from("pv-attachments")
    .upload(storagePath, file);
  if (uploadErr) throw new Error("فشل رفع الملف: " + uploadErr.message);

  // Create import record
  const { data: importRecord, error: insertErr } = await supabase
    .from("document_imports")
    .insert({
      source_file_name: file.name,
      storage_path: storagePath,
      import_type: "pdf_batch",
      status: "pending",
      uploaded_by: userId,
    })
    .select("id")
    .single();
  if (insertErr || !importRecord) throw new Error("فشل إنشاء سجل الاستيراد");

  onStatusChange("processing");

  // Call OCR edge function
  const { data, error: fnErr } = await supabase.functions.invoke("ocr-extract", {
    body: { import_id: importRecord.id },
  });

  if (fnErr) throw new Error("فشل التحليل: " + fnErr.message);
  if (data?.error) throw new Error(data.error);

  onStatusChange("extracted");

  return {
    importId: importRecord.id,
    extracted: data.extracted || {},
    confidence: data.overall_confidence || 50,
  };
}

export async function importExtractedPvs(
  entries: PdfFileEntry[],
  userId: string,
  onProgress: (current: number, total: number) => void
): Promise<Array<{ fileId: string; status: "success" | "skipped" | "error"; error?: string; pvId?: string }>> {
  const results: Array<{ fileId: string; status: "success" | "skipped" | "error"; error?: string; pvId?: string }> = [];

  const [{ data: departments }, { data: officers }, { data: referralSources }] = await Promise.all([
    supabase.from("departments").select("id, name_ar, code"),
    supabase.from("officers").select("id, full_name, badge_number, department_id"),
    supabase.from("referral_sources").select("id, label_ar"),
  ]);

  const REFERRAL_MAP: Record<string, string> = {
    "internal": "internal",
    "external": "external",
    "flagrante": "flagrante",
    "داخلي": "internal",
    "خارجي": "external",
    "تلبس": "flagrante",
  };

  const validEntries = entries.filter(e => e.status === "extracted" && e.extractedData);

  for (let i = 0; i < validEntries.length; i++) {
    const entry = validEntries[i];
    const d = entry.extractedData!;
    onProgress(i + 1, validEntries.length);

    try {
      if (!d.pv_number) {
        results.push({ fileId: entry.id, status: "skipped", error: "رقم المحضر غير موجود" });
        continue;
      }

      // Check duplicate
      const { data: existing } = await supabase
        .from("pv")
        .select("id")
        .eq("pv_number", d.pv_number)
        .maybeSingle();

      if (existing) {
        results.push({ fileId: entry.id, status: "skipped", error: "محضر موجود مسبقاً" });
        continue;
      }

      const dept = departments?.find(dep => dep.name_ar === d.department_name);
      const officer = officers?.find(o => o.badge_number === d.officer_badge || o.full_name === d.officer_name);
      const refSource = referralSources?.find(r => r.label_ar === d.referral_source);
      const referralType = d.referral_type ? REFERRAL_MAP[d.referral_type] || null : null;
      const pvDate = d.pv_date || new Date().toISOString().split("T")[0];
      const deptCode = dept?.code || "UNK";
      const internalRef = `PV-${pvDate.substring(0, 4)}-${deptCode}-${d.pv_number.replace(/\//g, "-")}`;

      const { data: pv, error: pvError } = await supabase
        .from("pv")
        .insert({
          internal_reference: internalRef,
          pv_number: d.pv_number,
          pv_date: pvDate,
          department_id: dept?.id || null,
          officer_id: officer?.id || null,
          referral_type: referralType,
          referral_source_id: refSource?.id || null,
          pv_type: d.pv_type || null,
          customs_violation: d.customs_violation || false,
          currency_violation: d.currency_violation || false,
          public_law_violation: d.public_law_violation || false,
          seizure_renewal: d.seizure_renewal || false,
          total_actual_seizure: d.total_actual_seizure || 0,
          total_virtual_seizure: d.total_virtual_seizure || 0,
          total_precautionary_seizure: d.total_precautionary_seizure || 0,
          notes: d.notes || null,
          source_import_type: "pdf_batch",
          created_by: userId,
          case_status: "draft",
        })
        .select("id")
        .single();

      if (pvError) throw pvError;

      // Insert offenders
      if (d.offenders?.length) {
        await supabase.from("offenders").insert(
          d.offenders.map((o, idx) => ({
            pv_id: pv.id,
            display_order: idx + 1,
            name_or_company: o.name_or_company,
            identifier: o.identifier || null,
            person_type: o.person_type || "physical",
            city: o.city || null,
            address: o.address || null,
          }))
        );
      }

      // Insert violations
      if (d.violations?.length) {
        await supabase.from("violations").insert(
          d.violations.map((v, idx) => ({
            pv_id: pv.id,
            display_order: idx + 1,
            violation_label: v.violation_label,
            violation_category: v.violation_category || null,
            legal_basis: v.legal_basis || null,
          }))
        );
      }

      // Insert seizures
      if (d.seizures?.length) {
        await supabase.from("seizures").insert(
          d.seizures.map((s, idx) => ({
            pv_id: pv.id,
            display_order: idx + 1,
            goods_category: s.goods_category || null,
            goods_type: s.goods_type || null,
            quantity: s.quantity || 0,
            unit: s.unit || null,
            estimated_value: s.estimated_value || 0,
            seizure_type: s.seizure_type || "actual",
          }))
        );
      }

      // Link document_import to pv
      if (entry.importId) {
        await supabase
          .from("document_imports")
          .update({ pv_id: pv.id, status: "imported" })
          .eq("id", entry.importId);
      }

      results.push({ fileId: entry.id, status: "success", pvId: pv.id });
    } catch (err: any) {
      results.push({ fileId: entry.id, status: "error", error: err.message || "خطأ غير معروف" });
    }
  }

  return results;
}
