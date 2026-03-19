
CREATE TABLE public.fonctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_ar text NOT NULL,
  label_fr text,
  mapped_role text DEFAULT 'officer',
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.fonctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_fonctions_select" ON public.fonctions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_fonctions_admin" ON public.fonctions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with existing fonctions
INSERT INTO public.fonctions (label_ar, label_fr, mapped_role) VALUES
  ('رئيس فرقة', 'Chef de brigade', 'department_supervisor'),
  ('مفتش', 'Inspecteur', 'national_supervisor'),
  ('عون', 'Agent', 'officer'),
  ('رئيس مكتب', 'Chef de bureau', 'department_supervisor'),
  ('رئيس قسم', 'Chef de division', 'department_supervisor'),
  ('مراقب', 'Contrôleur', 'national_supervisor'),
  ('ضابط صف', 'Sous-officier', 'officer');
