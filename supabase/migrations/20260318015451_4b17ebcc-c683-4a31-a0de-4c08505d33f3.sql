
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS fonction text DEFAULT NULL;
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS auth_user_id uuid DEFAULT NULL;
