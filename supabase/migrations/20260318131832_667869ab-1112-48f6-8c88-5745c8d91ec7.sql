
CREATE OR REPLACE FUNCTION public.admin_update_user_roles(
  _target_user_id uuid,
  _roles app_role[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- Delete existing roles
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;

  -- Insert new roles
  INSERT INTO public.user_roles (user_id, role)
  SELECT _target_user_id, unnest(_roles);
END;
$$;
