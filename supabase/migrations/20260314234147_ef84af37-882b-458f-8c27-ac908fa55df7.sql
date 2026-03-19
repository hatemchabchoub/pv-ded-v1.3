
-- Allow admins to delete PV records
CREATE POLICY "pv_delete_admin" ON public.pv
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow admins to delete offenders, violations, seizures directly
CREATE POLICY "offenders_delete" ON public.offenders
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pv WHERE pv.id = offenders.pv_id
    AND (has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid())
  ));

CREATE POLICY "violations_delete" ON public.violations
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pv WHERE pv.id = violations.pv_id
    AND (has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid())
  ));

CREATE POLICY "seizures_delete" ON public.seizures
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pv WHERE pv.id = seizures.pv_id
    AND (has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid())
  ));

CREATE POLICY "attachments_delete" ON public.attachments
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pv WHERE pv.id = attachments.pv_id
    AND (has_role(auth.uid(), 'admin') OR pv.created_by = auth.uid())
  ));
