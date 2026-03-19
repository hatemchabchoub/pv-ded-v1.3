import { supabase } from "@/integrations/supabase/client";
import type { ExcelPvRow, ImportResult, ColumnMapping } from "./excel-mapping";
import {
  parseBoolean,
  parseNumber,
  parseExcelDate,
  parseOfficer,
  autoDetectMappings,
  applyMappings,
  REFERRAL_TYPE_MAP,
} from "./excel-mapping";
import * as XLSX from "xlsx";

export interface ParsedExcelFile {
  headers: string[];
  rawRows: Record<string, any>[];
  mappings: ColumnMapping[];
  sheetName: string;
  sheetNames: string[];
}

export async function parseExcelFile(file: File, sheetIndex?: number): Promise<ParsedExcelFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  
  const idx = sheetIndex ?? (workbook.SheetNames.length > 1 ? 1 : 0);
  const sheetName = workbook.SheetNames[idx] || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

  // Extract headers from first row keys
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const mappings = autoDetectMappings(headers);

  return {
    headers,
    rawRows,
    mappings,
    sheetName,
    sheetNames: workbook.SheetNames,
  };
}

export function buildRows(rawRows: Record<string, any>[], mappings: ColumnMapping[]): ExcelPvRow[] {
  return applyMappings(rawRows, mappings);
}

export async function importPvRows(
  rows: ExcelPvRow[],
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  const [{ data: departments }, { data: officers }, { data: referralSources }] = await Promise.all([
    supabase.from('departments').select('id, name_ar, code'),
    supabase.from('officers').select('id, full_name, badge_number, department_id'),
    supabase.from('referral_sources').select('id, label_ar'),
  ]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.(i + 1, rows.length);

    try {
      if (!row.pv_number) {
        results.push({ row_index: i, pv_number: '', status: 'skipped' });
        continue;
      }

      const { data: existing } = await supabase
        .from('pv')
        .select('id')
        .eq('pv_number', row.pv_number)
        .maybeSingle();

      if (existing) {
        results.push({ row_index: i, pv_number: row.pv_number, status: 'skipped', error: 'PV déjà existant' });
        continue;
      }

      const dept = departments?.find(d => d.name_ar === row.department_name);
      const officerInfo = parseOfficer(row.officer_full);
      const officer = officers?.find(o => o.badge_number === officerInfo.badge);
      const refSource = referralSources?.find(r => r.label_ar === row.referral_source);
      const referralType = REFERRAL_TYPE_MAP[row.referral_type] || null;
      const pvDate = parseExcelDate(row.pv_date);

      const deptCode = dept?.code || 'UNK';
      const internalRef = `PV-${pvDate?.substring(0, 4) || '2025'}-${deptCode}-${row.pv_number.replace(/\//g, '-')}`;

      const { data: pv, error: pvError } = await supabase.from('pv').insert({
        internal_reference: internalRef,
        pv_number: row.pv_number,
        pv_date: pvDate || new Date().toISOString().split('T')[0],
        department_id: dept?.id || null,
        officer_id: officer?.id || null,
        referral_type: referralType,
        referral_source_id: refSource?.id || null,
        pv_type: row.pv_type || null,
        customs_violation: row.customs_violation,
        currency_violation: row.currency_violation,
        public_law_violation: row.public_law_violation,
        seizure_renewal: row.seizure_renewal,
        total_actual_seizure: row.total_actual_seizure,
        total_virtual_seizure: row.total_virtual_seizure,
        total_precautionary_seizure: row.total_precautionary_seizure,
        notes: row.notes || null,
        source_import_type: 'excel',
        created_by: userId,
        case_status: 'draft',
      }).select('id').single();

      if (pvError) throw pvError;

      const offendersToInsert = [];
      if (row.offender1_name) {
        offendersToInsert.push({
          pv_id: pv.id,
          display_order: 1,
          name_or_company: row.offender1_name,
          identifier: row.offender1_id || null,
          person_type: row.offender1_id?.match(/^\d{8}$/) ? 'physical' : 'legal',
        });
      }
      if (row.offender2_name) {
        offendersToInsert.push({
          pv_id: pv.id,
          display_order: 2,
          name_or_company: row.offender2_name,
          identifier: row.offender2_id || null,
          person_type: row.offender2_id?.match(/^\d{8}$/) ? 'physical' : 'legal',
        });
      }
      if (offendersToInsert.length > 0) {
        await supabase.from('offenders').insert(offendersToInsert);
      }

      if (row.violation1) {
        const violationCategory = row.customs_violation ? 'Douane' : 
          row.currency_violation ? 'Change' : 
          row.public_law_violation ? 'Droit commun' : null;

        await supabase.from('violations').insert({
          pv_id: pv.id,
          display_order: 1,
          violation_label: row.violation1,
          violation_category: violationCategory,
        });
      }

      results.push({ row_index: i, pv_number: row.pv_number, status: 'success' });
    } catch (err: any) {
      results.push({
        row_index: i,
        pv_number: row.pv_number,
        status: 'error',
        error: err.message || 'Erreur inconnue',
      });
    }
  }

  return results;
}
