
-- Fix 1: Prevent users from changing their own department_id or active status
-- Drop the existing permissive update policy
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Create a restricted update policy that prevents changing department_id, unit_id, and active
-- Users can only update full_name and email on their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid()
    AND department_id IS NOT DISTINCT FROM (SELECT p.department_id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
    AND unit_id IS NOT DISTINCT FROM (SELECT p.unit_id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
    AND active IS NOT DISTINCT FROM (SELECT p.active FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  );

-- Fix 2: Remove client-side INSERT on audit_logs and add server-side trigger
-- Drop the client insert policy
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;

-- Create audit trigger function for pv table
CREATE OR REPLACE FUNCTION public.audit_pv_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Create the trigger on pv table
DROP TRIGGER IF EXISTS trg_audit_pv ON public.pv;
CREATE TRIGGER trg_audit_pv
  AFTER INSERT OR UPDATE OR DELETE ON public.pv
  FOR EACH ROW EXECUTE FUNCTION public.audit_pv_changes();
