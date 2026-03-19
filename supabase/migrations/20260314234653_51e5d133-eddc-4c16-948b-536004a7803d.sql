
-- Storage policies already exist, just verify doc_imports_update was created
-- If not, create it (use IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'doc_imports_update' AND tablename = 'document_imports'
  ) THEN
    EXECUTE 'CREATE POLICY "doc_imports_update" ON public.document_imports FOR UPDATE TO authenticated USING (has_role(auth.uid(), ''admin'') OR uploaded_by = auth.uid())';
  END IF;
END $$;
