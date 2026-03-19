
-- ========================================
-- UTILITY FUNCTION: update timestamps
-- ========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ========================================
-- DEPARTMENTS
-- ========================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  region TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ========================================
-- UNITS
-- ========================================
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- ========================================
-- FONCTIONS (role mapping)
-- ========================================
CREATE TABLE public.fonctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_ar TEXT NOT NULL,
  label_fr TEXT,
  mapped_role TEXT DEFAULT 'officer',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.fonctions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PROFILES
-- ========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- USER_ROLES
-- ========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'national_supervisor', 'department_supervisor', 'officer', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- ========================================
-- RLS POLICIES (using has_role to avoid recursion)
-- ========================================

-- Departments
CREATE POLICY "Authenticated can read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Units
CREATE POLICY "Authenticated can read units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage units" ON public.units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fonctions
CREATE POLICY "Authenticated can read fonctions" ON public.fonctions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage fonctions" ON public.fonctions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin RPC to update roles atomically
CREATE OR REPLACE FUNCTION public.admin_update_user_roles(_target_user_id UUID, _roles TEXT[])
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  INSERT INTO public.user_roles (user_id, role)
  SELECT _target_user_id, r::app_role FROM unnest(_roles) AS r;
END;
$$;

-- ========================================
-- OFFICERS
-- ========================================
CREATE TABLE public.officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  badge_number TEXT,
  rank_label TEXT,
  fonction TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_email TEXT,
  initial_password TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read officers" ON public.officers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage officers" ON public.officers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- REFERRAL_SOURCES
-- ========================================
CREATE TABLE public.referral_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_fr TEXT NOT NULL,
  label_ar TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.referral_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read referral_sources" ON public.referral_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage referral_sources" ON public.referral_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- PV (Procès-Verbaux)
-- ========================================
CREATE TABLE public.pv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_reference TEXT,
  pv_number TEXT NOT NULL,
  pv_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pv_type TEXT,
  case_status TEXT DEFAULT 'draft',
  priority_level TEXT DEFAULT 'normal',
  parent_pv_id UUID REFERENCES public.pv(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  officer_id UUID REFERENCES public.officers(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  referral_type TEXT,
  referral_source_id UUID REFERENCES public.referral_sources(id) ON DELETE SET NULL,
  customs_violation BOOLEAN DEFAULT false,
  currency_violation BOOLEAN DEFAULT false,
  public_law_violation BOOLEAN DEFAULT false,
  seizure_renewal BOOLEAN DEFAULT false,
  total_actual_seizure NUMERIC DEFAULT 0,
  total_virtual_seizure NUMERIC DEFAULT 0,
  total_precautionary_seizure NUMERIC DEFAULT 0,
  total_seizure NUMERIC GENERATED ALWAYS AS (total_actual_seizure + total_virtual_seizure + total_precautionary_seizure) STORED,
  source_import_type TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read pv" ON public.pv FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create pv" ON public.pv FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can manage pv" ON public.pv FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creators can update own pv" ON public.pv FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete own pv" ON public.pv FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER update_pv_updated_at BEFORE UPDATE ON public.pv FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- OFFENDERS
-- ========================================
CREATE TABLE public.offenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID NOT NULL REFERENCES public.pv(id) ON DELETE CASCADE,
  display_order INT DEFAULT 1,
  name_or_company TEXT NOT NULL,
  identifier TEXT,
  person_type TEXT DEFAULT 'physical',
  city TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.offenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read offenders" ON public.offenders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage offenders" ON public.offenders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================================
-- VIOLATIONS
-- ========================================
CREATE TABLE public.violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID NOT NULL REFERENCES public.pv(id) ON DELETE CASCADE,
  display_order INT DEFAULT 1,
  violation_label TEXT NOT NULL,
  violation_category TEXT,
  legal_basis TEXT,
  severity_level TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read violations" ON public.violations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage violations" ON public.violations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================================
-- SEIZURES
-- ========================================
CREATE TABLE public.seizures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id UUID NOT NULL REFERENCES public.pv(id) ON DELETE CASCADE,
  display_order INT DEFAULT 1,
  goods_category TEXT,
  goods_type TEXT,
  quantity NUMERIC DEFAULT 0,
  unit TEXT,
  estimated_value NUMERIC DEFAULT 0,
  seizure_type TEXT DEFAULT 'actual',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.seizures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read seizures" ON public.seizures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage seizures" ON public.seizures FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================================
-- VIOLATION_REFERENCE
-- ========================================
CREATE TABLE public.violation_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  label_fr TEXT NOT NULL,
  label_ar TEXT,
  category TEXT,
  legal_basis TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.violation_reference ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read violation_reference" ON public.violation_reference FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage violation_reference" ON public.violation_reference FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- GOODS_REFERENCE
-- ========================================
CREATE TABLE public.goods_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_fr TEXT NOT NULL,
  category_ar TEXT,
  type_fr TEXT,
  type_ar TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.goods_reference ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read goods_reference" ON public.goods_reference FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage goods_reference" ON public.goods_reference FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- NOTIFICATIONS
-- ========================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  related_table TEXT,
  related_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ========================================
-- AUDIT_LOGS
-- ========================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and supervisors can read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'national_supervisor')
);

-- ========================================
-- DOCUMENT_IMPORTS (for OCR/PDF)
-- ========================================
CREATE TABLE public.document_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_file_name TEXT,
  storage_path TEXT,
  import_type TEXT,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_text TEXT,
  extracted_json JSONB,
  confidence_score INT,
  validation_errors JSONB,
  pv_id UUID REFERENCES public.pv(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.document_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own imports" ON public.document_imports FOR SELECT TO authenticated USING (auth.uid() = uploaded_by);
CREATE POLICY "Users can create imports" ON public.document_imports FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can update own imports" ON public.document_imports FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by);

-- ========================================
-- DOCUMENT_FIELD_CANDIDATES
-- ========================================
CREATE TABLE public.document_field_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.document_imports(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  extracted_value TEXT,
  normalized_value TEXT,
  confidence INT DEFAULT 50,
  validated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.document_field_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read field_candidates" ON public.document_field_candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage field_candidates" ON public.document_field_candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================================
-- STORAGE
-- ========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('pv-attachments', 'pv-attachments', false);
CREATE POLICY "Users can upload pv attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pv-attachments');
CREATE POLICY "Users can read pv attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pv-attachments');

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX idx_pv_pv_number ON public.pv(pv_number);
CREATE INDEX idx_pv_department_id ON public.pv(department_id);
CREATE INDEX idx_pv_officer_id ON public.pv(officer_id);
CREATE INDEX idx_pv_case_status ON public.pv(case_status);
CREATE INDEX idx_pv_pv_date ON public.pv(pv_date);
CREATE INDEX idx_pv_parent_pv_id ON public.pv(parent_pv_id);
CREATE INDEX idx_offenders_pv_id ON public.offenders(pv_id);
CREATE INDEX idx_violations_pv_id ON public.violations(pv_id);
CREATE INDEX idx_seizures_pv_id ON public.seizures(pv_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
