-- =============================================
-- NICM Phase 1 Schema
-- =============================================

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'national_supervisor', 'department_supervisor', 'officer', 'viewer');

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- Reference Tables
-- =============================================

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  region TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id),
  unit_id UUID REFERENCES public.units(id),
  full_name TEXT NOT NULL,
  badge_number TEXT,
  rank_label TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.referral_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_fr TEXT NOT NULL,
  label_ar TEXT,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public.violation_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  label_fr TEXT NOT NULL,
  label_ar TEXT,
  category TEXT,
  legal_basis TEXT,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public.goods_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_fr TEXT NOT NULL,
  category_ar TEXT,
  type_fr TEXT,
  type_ar TEXT,
  active BOOLEAN DEFAULT true
);

-- =============================================
-- User Roles (separate table per security rules)
-- =============================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'officer',
  UNIQUE(user_id, role)
);

-- =============================================
-- User Profiles
-- =============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE,
  department_id UUID REFERENCES public.departments(id),
  unit_id UUID REFERENCES public.units(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Core PV Table
-- =============================================

CREATE TABLE public.pv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_reference TEXT UNIQUE NOT NULL,
  pv_number TEXT NOT NULL,
  pv_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id UUID REFERENCES public.departments(id),
  unit_id UUID REFERENCES public.units(id),
  officer_id UUID REFERENCES public.officers(id),
  referral_type TEXT CHECK (referral_type IN ('internal', 'external', 'flagrante')),
  referral_source_id UUID REFERENCES public.referral_sources(id),
  pv_type TEXT,
  case_status TEXT DEFAULT 'draft' CHECK (case_status IN ('draft', 'under_review', 'validated', 'archived')),
  customs_violation BOOLEAN DEFAULT false,
  currency_violation BOOLEAN DEFAULT false,
  public_law_violation BOOLEAN DEFAULT false,
  seizure_renewal BOOLEAN DEFAULT false,
  priority_level TEXT DEFAULT 'normal',
  notes TEXT,
  total_actual_seizure NUMERIC(15,2) DEFAULT 0,
  total_virtual_seizure NUMERIC(15,2) DEFAULT 0,
  total_precautionary_seizure NUMERIC(15,2) DEFAULT 0,
  total_seizure NUMERIC(15,2) GENERATED ALWAYS AS (total_actual_seizure + total_virtual_seizure + total_precautionary_seizure) STORED,
  source_import_type TEXT DEFAULT 'manual',
  source_import_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.offenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID NOT NULL REFERENCES public.pv(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 1,
  name_or_company TEXT NOT NULL,
  normalized_name TEXT,
  identifier TEXT,
  identifier_issue_date DATE,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'MA',
  person_type TEXT DEFAULT 'physical' CHECK (person_type IN ('physical', 'legal')),
  risk_score NUMERIC(3,2) DEFAULT 0,
  duplicate_candidate BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID NOT NULL REFERENCES public.pv(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 1,
  violation_reference_id UUID REFERENCES public.violation_reference(id),
  violation_label TEXT NOT NULL,
  violation_category TEXT,
  legal_basis TEXT,
  severity_level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.seizures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID NOT NULL REFERENCES public.pv(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 1,
  seizure_type TEXT DEFAULT 'actual' CHECK (seizure_type IN ('actual', 'virtual', 'precautionary')),
  goods_reference_id UUID REFERENCES public.goods_reference(id),
  goods_category TEXT,
  goods_type TEXT,
  quantity NUMERIC DEFAULT 0,
  unit TEXT,
  estimated_value NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'MAD',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID NOT NULL REFERENCES public.pv(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Document Import Tables (Phase 2 prep)
-- =============================================

CREATE TABLE public.document_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT DEFAULT 'pdf',
  source_file_name TEXT,
  storage_path TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_text TEXT,
  extracted_json JSONB,
  confidence_score NUMERIC(3,2),
  validation_errors JSONB,
  created_pv_id UUID REFERENCES public.pv(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX idx_pv_number ON public.pv(pv_number);
CREATE INDEX idx_pv_department ON public.pv(department_id);
CREATE INDEX idx_pv_officer ON public.pv(officer_id);
CREATE INDEX idx_pv_status ON public.pv(case_status);
CREATE INDEX idx_pv_date ON public.pv(pv_date);
CREATE INDEX idx_pv_created_by ON public.pv(created_by);
CREATE INDEX idx_offenders_pv ON public.offenders(pv_id);
CREATE INDEX idx_offenders_name ON public.offenders USING gin(to_tsvector('french', name_or_company));
CREATE INDEX idx_violations_pv ON public.violations(pv_id);
CREATE INDEX idx_seizures_pv ON public.seizures(pv_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name, record_id);

-- =============================================
-- Triggers
-- =============================================

CREATE TRIGGER update_pv_updated_at BEFORE UPDATE ON public.pv FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offenders_updated_at BEFORE UPDATE ON public.offenders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Security Definer Functions (for RLS)
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE auth_user_id = _user_id LIMIT 1
$$;

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violation_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seizures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_imports ENABLE ROW LEVEL SECURITY;

-- Reference tables: read by all authenticated
CREATE POLICY "ref_departments_select" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_units_select" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_officers_select" ON public.officers FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_referral_sources_select" ON public.referral_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_violation_reference_select" ON public.violation_reference FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_goods_reference_select" ON public.goods_reference FOR SELECT TO authenticated USING (true);

-- Admin-only write on reference tables
CREATE POLICY "ref_departments_admin" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ref_units_admin" ON public.units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ref_officers_admin" ON public.officers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User Roles
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (auth_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());

-- PV policies
CREATE POLICY "pv_select" ON public.pv FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'national_supervisor')
  OR department_id = public.get_user_department(auth.uid())
);
CREATE POLICY "pv_insert" ON public.pv FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'officer')
  OR public.has_role(auth.uid(), 'department_supervisor')
);
CREATE POLICY "pv_update" ON public.pv FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR (public.has_role(auth.uid(), 'department_supervisor') AND department_id = public.get_user_department(auth.uid()))
);

-- Child tables follow PV access
CREATE POLICY "offenders_select" ON public.offenders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR pv.department_id = public.get_user_department(auth.uid())))
);
CREATE POLICY "offenders_modify" ON public.offenders FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);

CREATE POLICY "violations_select" ON public.violations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR pv.department_id = public.get_user_department(auth.uid())))
);
CREATE POLICY "violations_modify" ON public.violations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);

CREATE POLICY "seizures_select" ON public.seizures FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR pv.department_id = public.get_user_department(auth.uid())))
);
CREATE POLICY "seizures_modify" ON public.seizures FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);

CREATE POLICY "attachments_select" ON public.attachments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR pv.department_id = public.get_user_department(auth.uid())))
);
CREATE POLICY "attachments_modify" ON public.attachments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);

-- Audit logs
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR user_id = auth.uid()
);
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Document imports
CREATE POLICY "doc_imports_select" ON public.document_imports FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR uploaded_by = auth.uid()
);
CREATE POLICY "doc_imports_insert" ON public.document_imports FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- =============================================
-- Auto-create profile on signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'officer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Storage bucket for attachments
-- =============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('pv-attachments', 'pv-attachments', false);

CREATE POLICY "pv_attachments_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pv-attachments');
CREATE POLICY "pv_attachments_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pv-attachments');