
-- Fix the permissive INSERT policy to only allow system inserts via the user's own id
DROP POLICY "notifications_insert_system" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
