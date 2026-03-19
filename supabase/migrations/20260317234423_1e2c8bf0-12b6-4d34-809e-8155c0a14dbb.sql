
ALTER TABLE public.pv ADD COLUMN parent_pv_id uuid REFERENCES public.pv(id) ON DELETE SET NULL DEFAULT NULL;

CREATE INDEX idx_pv_parent_pv_id ON public.pv(parent_pv_id);

COMMENT ON COLUMN public.pv.parent_pv_id IS 'References the parent PV (محضر) for sub-PVs (ضلع)';
