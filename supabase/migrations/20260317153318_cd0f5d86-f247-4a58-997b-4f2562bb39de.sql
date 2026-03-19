
-- =============================================
-- NICM Phase 1 Schema (consolidated)
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

-- Reference Tables
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
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
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

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'officer',
  UNIQUE(user_id, role)
);

-- User Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Core PV Table
CREATE TABLE public.pv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_reference TEXT UNIQUE NOT NULL,
  pv_number TEXT NOT NULL,
  pv_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
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

CREATE TABLE public.document_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT DEFAULT 'pdf',
  source_file_name TEXT,
  storage_path TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'processing', 'extracted', 'completed', 'failed', 'error'])),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_text TEXT,
  extracted_json JSONB,
  confidence_score NUMERIC(3,2),
  validation_errors JSONB,
  created_pv_id UUID REFERENCES public.pv(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.document_field_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.document_imports(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  extracted_value text,
  normalized_value text,
  confidence numeric DEFAULT 50,
  validated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text DEFAULT 'info',
  related_table text,
  related_id uuid,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
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
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- Triggers
CREATE TRIGGER update_pv_updated_at BEFORE UPDATE ON public.pv FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offenders_updated_at BEFORE UPDATE ON public.offenders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security Definer Functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE auth_user_id = _user_id LIMIT 1
$$;

-- RLS
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
ALTER TABLE public.document_field_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "ref_goods_reference_admin" ON public.goods_reference FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ref_violation_reference_admin" ON public.violation_reference FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ref_referral_sources_admin" ON public.referral_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User Roles
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (auth_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid()
    AND department_id IS NOT DISTINCT FROM (SELECT p.department_id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
    AND unit_id IS NOT DISTINCT FROM (SELECT p.unit_id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
    AND active IS NOT DISTINCT FROM (SELECT p.active FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  );
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());

-- *** REFINED PV SELECT: officer sees only own PVs ***
CREATE POLICY "pv_select" ON public.pv FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'national_supervisor')
  OR (public.has_role(auth.uid(), 'department_supervisor') AND department_id = public.get_user_department(auth.uid()))
  OR (public.has_role(auth.uid(), 'viewer') AND department_id = public.get_user_department(auth.uid()))
  OR (public.has_role(auth.uid(), 'officer') AND created_by = auth.uid())
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
CREATE POLICY "pv_delete_admin" ON public.pv FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Child tables follow PV access
CREATE POLICY "offenders_select" ON public.offenders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR (public.has_role(auth.uid(), 'department_supervisor') AND pv.department_id = public.get_user_department(auth.uid())) OR (public.has_role(auth.uid(), 'viewer') AND pv.department_id = public.get_user_department(auth.uid())) OR (public.has_role(auth.uid(), 'officer') AND pv.created_by = auth.uid())))
);
CREATE POLICY "offenders_modify" ON public.offenders FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);
CREATE POLICY "offenders_delete" ON public.offenders FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM pv WHERE pv.id = offenders.pv_id AND (has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);

CREATE POLICY "violations_select" ON public.violations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR (public.has_role(auth.uid(), 'department_supervisor') AND pv.department_id = public.get_user_department(auth.uid())) OR (public.has_role(auth.uid(), 'viewer') AND pv.department_id = public.get_user_department(auth.uid())) OR (public.has_role(auth.uid(), 'officer') AND pv.created_by = auth.uid())))
);
CREATE POLICY "violations_modify" ON public.violations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);
CREATE POLICY "violations_delete" ON public.violations FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM pv WHERE pv.id = violations.pv_id AND (has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);

CREATE POLICY "seizures_select" ON public.seizures FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR (public.has_role(auth.uid(), 'department_supervisor') AND pv.department_id = public.get_user_department(auth.uid())) OR (public.has_role(auth.uid(), 'viewer') AND pv.department_id = public.get_user_department(auth.uid())) OR (public.has_role(auth.uid(), 'officer') AND pv.created_by = auth.uid())))
);
CREATE POLICY "seizures_modify" ON public.seizures FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);
CREATE POLICY "seizures_delete" ON public.seizures FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM pv WHERE pv.id = seizures.pv_id AND (has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);

CREATE POLICY "attachments_select" ON public.attachments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR (public.has_role(auth.uid(), 'department_supervisor') AND pv.department_id = public.get_user_department(auth.uid())) OR (public.has_role(auth.uid(), 'viewer') AND pv.department_id = public.get_user_department(auth.uid())) OR (public.has_role(auth.uid(), 'officer') AND pv.created_by = auth.uid())))
);
CREATE POLICY "attachments_modify" ON public.attachments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pv WHERE pv.id = pv_id AND (public.has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);
CREATE POLICY "attachments_delete" ON public.attachments FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM pv WHERE pv.id = attachments.pv_id AND (has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid()))
);

-- Audit logs
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor') OR user_id = auth.uid()
);

-- Document imports
CREATE POLICY "doc_imports_select" ON public.document_imports FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR uploaded_by = auth.uid()
);
CREATE POLICY "doc_imports_insert" ON public.document_imports FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "doc_imports_update" ON public.document_imports FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR uploaded_by = auth.uid());

-- Document field candidates
CREATE POLICY "field_candidates_select" ON public.document_field_candidates FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.document_imports di WHERE di.id = document_field_candidates.import_id AND (di.uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "field_candidates_insert" ON public.document_field_candidates FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.document_imports di WHERE di.id = document_field_candidates.import_id AND (di.uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

-- Notifications
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- Audit PV changes trigger
CREATE OR REPLACE FUNCTION public.audit_pv_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, table_name, action, record_id, new_value)
    VALUES (auth.uid(), 'pv', 'create', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, table_name, action, record_id, old_value, new_value)
    VALUES (auth.uid(), 'pv', 'update', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, table_name, action, record_id, old_value)
    VALUES (auth.uid(), 'pv', 'delete', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_pv
  AFTER INSERT OR UPDATE OR DELETE ON public.pv
  FOR EACH ROW EXECUTE FUNCTION public.audit_pv_changes();

-- Notification triggers
CREATE OR REPLACE FUNCTION public.notify_pv_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user record;
  _status_label text;
BEGIN
  IF OLD.case_status IS DISTINCT FROM NEW.case_status THEN
    _status_label := CASE NEW.case_status
      WHEN 'draft' THEN 'مسودة'
      WHEN 'under_review' THEN 'قيد المراجعة'
      WHEN 'validated' THEN 'مصادق'
      WHEN 'archived' THEN 'مؤرشف'
      ELSE NEW.case_status
    END;
    FOR _user IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'national_supervisor', 'department_supervisor')
      AND ur.user_id != COALESCE(NEW.updated_by, NEW.created_by)
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
      VALUES (_user.user_id, 'تغيير حالة محضر', 'المحضر ' || NEW.pv_number || ' أصبح: ' || _status_label, 'status_change', 'pv', NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pv_status_notify
  AFTER UPDATE ON public.pv
  FOR EACH ROW EXECUTE FUNCTION public.notify_pv_status_change();

CREATE OR REPLACE FUNCTION public.notify_duplicate_offender()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _existing_count integer;
  _user record;
BEGIN
  SELECT count(*) INTO _existing_count FROM public.offenders WHERE normalized_name = NEW.normalized_name AND id != NEW.id;
  IF _existing_count > 0 THEN
    FOR _user IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'national_supervisor')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
      VALUES (_user.user_id, 'مخالف متكرر', 'تم اكتشاف مخالف متكرر: ' || NEW.name_or_company || ' (' || (_existing_count + 1) || ' ظهور)', 'anomaly', 'offenders', NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offender_duplicate_notify
  AFTER INSERT ON public.offenders
  FOR EACH ROW EXECUTE FUNCTION public.notify_duplicate_offender();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('pv-attachments', 'pv-attachments', false);
CREATE POLICY "pv_attachments_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pv-attachments');
CREATE POLICY "pv_attachments_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pv-attachments');
