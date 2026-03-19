
-- Add admin CRUD policies for goods_reference
CREATE POLICY "ref_goods_reference_admin" ON public.goods_reference
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add admin CRUD policies for violation_reference
CREATE POLICY "ref_violation_reference_admin" ON public.violation_reference
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add admin CRUD policies for referral_sources
CREATE POLICY "ref_referral_sources_admin" ON public.referral_sources
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
