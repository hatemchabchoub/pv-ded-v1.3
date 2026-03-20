
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id uuid NOT NULL REFERENCES public.pv(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text DEFAULT 'application/pdf',
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read attachments"
  ON public.attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert attachments"
  ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Creators and admins can delete attachments"
  ON public.attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));

-- Storage RLS for pv-attachments bucket
CREATE POLICY "Authenticated can upload to pv-attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pv-attachments');

CREATE POLICY "Authenticated can read pv-attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pv-attachments');

CREATE POLICY "Owners and admins can delete pv-attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pv-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));
