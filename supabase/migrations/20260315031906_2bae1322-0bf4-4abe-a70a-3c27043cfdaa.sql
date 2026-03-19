
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text DEFAULT 'info',
  related_table text,
  related_id uuid,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for fast user queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can update (mark read) their own notifications
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- System/triggers can insert (via security definer functions)
CREATE POLICY "notifications_insert_system" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Delete own notifications
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification for admins/supervisors on PV status change
CREATE OR REPLACE FUNCTION public.notify_pv_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user record;
  _status_label text;
BEGIN
  IF OLD.case_status IS DISTINCT FROM NEW.case_status THEN
    _status_label := CASE NEW.case_status
      WHEN 'draft' THEN 'مسودة'
      WHEN 'under_review' THEN 'قيد المراجعة'
      WHEN 'validated' THEN 'مصادق'
      WHEN 'archived' THEN 'مؤرشف'
      ELSE NEW.case_status
    END;

    FOR _user IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'national_supervisor', 'department_supervisor')
      AND ur.user_id != COALESCE(NEW.updated_by, NEW.created_by)
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
      VALUES (
        _user.user_id,
        'تغيير حالة محضر',
        'المحضر ' || NEW.pv_number || ' أصبح: ' || _status_label,
        'status_change',
        'pv',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pv_status_notify
  AFTER UPDATE ON public.pv
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pv_status_change();

-- Function to notify on duplicate offender detection
CREATE OR REPLACE FUNCTION public.notify_duplicate_offender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_count integer;
  _user record;
BEGIN
  SELECT count(*) INTO _existing_count
  FROM public.offenders
  WHERE normalized_name = NEW.normalized_name
    AND id != NEW.id;

  IF _existing_count > 0 THEN
    FOR _user IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'national_supervisor')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
      VALUES (
        _user.user_id,
        'مخالف متكرر',
        'تم اكتشاف مخالف متكرر: ' || NEW.name_or_company || ' (' || (_existing_count + 1) || ' ظهور)',
        'anomaly',
        'offenders',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offender_duplicate_notify
  AFTER INSERT ON public.offenders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_duplicate_offender();
