// Excel column mapping for Tunisian customs PV Excel format

// Known Arabic column headers → internal field keys
export const EXCEL_COLUMN_MAP: Record<string, string> = {
  'عدد المحضر': 'pv_number',
  'تاريخ المحضر': 'pv_date',
  'القسم': 'department_name',
  'الضابط المكلف بالملف': 'officer_full',
  'طبيعة الإحالة': 'referral_type',
  'مصدر الإحالة': 'referral_source',
  'المخالف 1_الإسم واللقب أو الشركة': 'offender1_name',
  'المخالف 1_المعرف الوحيد': 'offender1_id',
  'المخالف 2_الإسم واللقب أو الشركة': 'offender2_name',
  'المخالف 2_المعرف الوحيد': 'offender2_id',
  'المخالفة 1': 'violation1',
  'مجموع المحجوز الفعلي': 'total_actual_seizure',
  'مجموع المحجوز الصوري': 'total_virtual_seizure',
  'مجموع المحجوز التحفظي': 'total_precautionary_seizure',
  'محضر أو ضلع': 'pv_type',
  'مخالفة ديوانية': 'customs_violation',
  'مخالفة صرفية': 'currency_violation',
  'مخالفة حق عام': 'public_law_violation',
  'تجديد حجز': 'seizure_renewal',
  'ملاحضات': 'notes',
  'مجموع المحجوز': 'total_seizure',
} as const;

// All DB target fields with labels for the mapping UI
export const DB_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: 'pv_number', label: 'N° PV (عدد المحضر)', required: true },
  { key: 'pv_date', label: 'Date PV (تاريخ المحضر)', required: true },
  { key: 'department_name', label: 'Département (القسم)', required: false },
  { key: 'officer_full', label: 'Officier (الضابط)', required: false },
  { key: 'referral_type', label: 'Type d\'envoi (طبيعة الإحالة)', required: false },
  { key: 'referral_source', label: 'Source d\'envoi (مصدر الإحالة)', required: false },
  { key: 'offender1_name', label: 'Contrevenant 1 — Nom', required: false },
  { key: 'offender1_id', label: 'Contrevenant 1 — Identifiant', required: false },
  { key: 'offender2_name', label: 'Contrevenant 2 — Nom', required: false },
  { key: 'offender2_id', label: 'Contrevenant 2 — Identifiant', required: false },
  { key: 'violation1', label: 'Infraction (المخالفة)', required: false },
  { key: 'total_actual_seizure', label: 'Saisie réelle', required: false },
  { key: 'total_virtual_seizure', label: 'Saisie fictive', required: false },
  { key: 'total_precautionary_seizure', label: 'Saisie conservatoire', required: false },
  { key: 'pv_type', label: 'Type PV (محضر/ضلع)', required: false },
  { key: 'customs_violation', label: 'Infraction douanière', required: false },
  { key: 'currency_violation', label: 'Infraction de change', required: false },
  { key: 'public_law_violation', label: 'Infraction droit commun', required: false },
  { key: 'seizure_renewal', label: 'Renouvellement saisie', required: false },
  { key: 'notes', label: 'Notes (ملاحضات)', required: false },
  { key: 'total_seizure', label: 'Total saisie', required: false },
];

export interface ColumnMapping {
  excelHeader: string;
  dbField: string | null; // null = skip/ignore
  autoDetected: boolean;
}

export interface ExcelPvRow {
  pv_number: string;
  pv_date: string;
  department_name: string;
  officer_full: string;
  referral_type: string;
  referral_source: string;
  offender1_name: string;
  offender1_id: string;
  offender2_name: string;
  offender2_id: string;
  violation1: string;
  total_actual_seizure: number;
  total_virtual_seizure: number;
  total_precautionary_seizure: number;
  pv_type: string;
  customs_violation: boolean;
  currency_violation: boolean;
  public_law_violation: boolean;
  seizure_renewal: boolean;
  notes: string;
  total_seizure: number;
}

export interface ImportResult {
  row_index: number;
  pv_number: string;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

export interface ValidationError {
  row_index: number;
  field: string;
  message: string;
}

// Referral type mapping from Arabic
export const REFERRAL_TYPE_MAP: Record<string, string> = {
  'إحالات هياكل داخلية ( ا ع د )': 'internal',
  'إحالات هياكل داخلية': 'internal',
  'إحالات هياكل خارجية': 'external',
  'إعلامات بالتحيل': 'external',
  'مباشرة': 'flagrante',
};

export const PV_TYPE_MAP: Record<string, string> = {
  'محضر': 'محضر',
  'ضلع': 'ضلع',
};

export function parseBoolean(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return s === 'نعم' || s === 'x' || s === 'oui' || s === 'true' || s === '1';
}

export function parseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/\s/g, '');
  const cleaned = s.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseExcelDate(val: any): string | null {
  if (!val) return null;

  // Excel serial number
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    return null;
  }

  const s = String(val).trim();

  // String that is purely numeric → treat as Excel serial number
  if (/^\d+$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial > 1 && serial < 200000) {
      const date = new Date((serial - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    }
    return null;
  }

  // Already ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Split by / or - or .
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let y: string, m: string, d: string;
    if (parts[0].length === 4) {
      [y, m, d] = parts;
    } else if (parts[2].length === 4) {
      [d, m, y] = parts;
    } else {
      [d, m, y] = parts;
      y = y.length === 2 ? `20${y}` : y;
    }
    const built = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const check = new Date(built);
    if (!isNaN(check.getTime()) && check.getFullYear() >= 1900 && check.getFullYear() <= 2100) return built;
  }

  // Last resort with year validation
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime()) && fallback.getFullYear() >= 1900 && fallback.getFullYear() <= 2100) {
    return fallback.toISOString().split('T')[0];
  }

  return null;
}

export function parseOfficer(officerStr: string): { name: string; badge: string; rank: string } {
  if (!officerStr) return { name: '', badge: '', rank: '' };
  const badgeMatch = officerStr.match(/\((\d+)\)/);
  const badge = badgeMatch ? badgeMatch[1] : '';
  const withoutBadge = officerStr.replace(/\(\d+\)/, '').trim();
  
  const ranks = [
    'ملازم أول للديوانة',
    'ملازم للديوانة', 
    'رائد للديوانة',
    'عقيد للديوانة',
    'نقيب للديوانة',
    'مقدم للديوانة',
    'وكيل أول للديوانة',
  ];
  
  let rank = '';
  let name = withoutBadge;
  for (const r of ranks) {
    if (withoutBadge.startsWith(r)) {
      rank = r;
      name = withoutBadge.replace(r, '').trim();
      break;
    }
  }
  
  return { name, badge, rank };
}

/**
 * Auto-detect column mappings by matching Excel headers against known Arabic headers
 */
export function autoDetectMappings(excelHeaders: string[]): ColumnMapping[] {
  return excelHeaders.map((header) => {
    const trimmed = header.trim();
    const match = EXCEL_COLUMN_MAP[trimmed] || null;
    
    // Also try partial/fuzzy matching for common variations
    let fuzzyMatch: string | null = null;
    if (!match) {
      for (const [arabicKey, dbField] of Object.entries(EXCEL_COLUMN_MAP)) {
        if (trimmed.includes(arabicKey) || arabicKey.includes(trimmed)) {
          fuzzyMatch = dbField;
          break;
        }
      }
    }
    
    return {
      excelHeader: header,
      dbField: match || fuzzyMatch,
      autoDetected: !!(match || fuzzyMatch),
    };
  });
}

/**
 * Apply column mappings to raw Excel rows to produce typed ExcelPvRow[]
 */
export function applyMappings(
  rawRows: Record<string, any>[],
  mappings: ColumnMapping[]
): ExcelPvRow[] {
  const headerToField = new Map<string, string>();
  for (const m of mappings) {
    if (m.dbField) headerToField.set(m.excelHeader, m.dbField);
  }

  return rawRows
    .map((raw) => {
      const mapped: Record<string, any> = {};
      for (const [header, value] of Object.entries(raw)) {
        const field = headerToField.get(header);
        if (field) mapped[field] = value;
      }

      return {
        pv_number: String(mapped.pv_number || '').trim(),
        pv_date: String(mapped.pv_date || '').trim(),
        department_name: String(mapped.department_name || '').trim(),
        officer_full: String(mapped.officer_full || '').trim(),
        referral_type: String(mapped.referral_type || '').trim(),
        referral_source: String(mapped.referral_source || '').trim(),
        offender1_name: String(mapped.offender1_name || '').trim(),
        offender1_id: String(mapped.offender1_id || '').trim(),
        offender2_name: String(mapped.offender2_name || '').trim(),
        offender2_id: String(mapped.offender2_id || '').trim(),
        violation1: String(mapped.violation1 || '').trim(),
        total_actual_seizure: parseNumber(mapped.total_actual_seizure),
        total_virtual_seizure: parseNumber(mapped.total_virtual_seizure),
        total_precautionary_seizure: parseNumber(mapped.total_precautionary_seizure),
        pv_type: String(mapped.pv_type || '').trim(),
        customs_violation: parseBoolean(mapped.customs_violation),
        currency_violation: parseBoolean(mapped.currency_violation),
        public_law_violation: parseBoolean(mapped.public_law_violation),
        seizure_renewal: parseBoolean(mapped.seizure_renewal),
        notes: String(mapped.notes || '').trim(),
        total_seizure: parseNumber(mapped.total_seizure),
      } as ExcelPvRow;
    })
    .filter((row) => row.pv_number);
}

/**
 * Validate rows and return errors
 */
export function validateRows(rows: ExcelPvRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenPvNumbers = new Set<string>();

  rows.forEach((row, i) => {
    if (!row.pv_number) {
      errors.push({ row_index: i, field: 'pv_number', message: 'N° PV requis' });
    } else if (seenPvNumbers.has(row.pv_number)) {
      errors.push({ row_index: i, field: 'pv_number', message: `Doublon dans le fichier: ${row.pv_number}` });
    } else {
      seenPvNumbers.add(row.pv_number);
    }

    if (!row.pv_date) {
      errors.push({ row_index: i, field: 'pv_date', message: 'Date PV requise' });
    }
  });

  return errors;
}
