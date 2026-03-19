
-- Update check constraint to include all statuses used by the edge function
ALTER TABLE public.document_imports DROP CONSTRAINT document_imports_status_check;
ALTER TABLE public.document_imports ADD CONSTRAINT document_imports_status_check 
  CHECK (status = ANY (ARRAY['pending', 'processing', 'extracted', 'completed', 'failed', 'error']));

-- Create the document_field_candidates table used by the OCR edge function
CREATE TABLE public.document_field_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.document_imports(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  extracted_value text,
  normalized_value text,
  confidence numeric DEFAULT 50,
  validated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_field_candidates ENABLE ROW LEVEL SECURITY;

-- RLS: users can read their own import's candidates
CREATE POLICY "field_candidates_select" ON public.document_field_candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.document_imports di
      WHERE di.id = document_field_candidates.import_id
        AND (di.uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- RLS: edge function inserts via service role, users can read
CREATE POLICY "field_candidates_insert" ON public.document_field_candidates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_imports di
      WHERE di.id = document_field_candidates.import_id
        AND (di.uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
