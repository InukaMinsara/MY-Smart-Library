-- 1. pending role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pending';

-- 2. account status on profiles
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('pending','active','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.account_status NOT NULL DEFAULT 'pending';

UPDATE public.profiles SET status = 'active'
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role IN ('super_admin','admin','librarian','manager'));

-- 3. audit log extras
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS ip_address text;

-- 4. FINES
CREATE TABLE IF NOT EXISTS public.fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'overdue',
  late_days integer NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'outstanding',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fines TO authenticated;
GRANT ALL ON public.fines TO service_role;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
CREATE POLICY fines_select ON public.fines FOR SELECT TO authenticated
  USING (public.has_permission('fine_management') OR public.has_permission('loans') OR public.has_permission('returns'));
CREATE POLICY fines_write ON public.fines FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('fine_management') OR public.has_permission('return_books'));
CREATE POLICY fines_update ON public.fines FOR UPDATE TO authenticated
  USING (public.has_permission('fine_management')) WITH CHECK (public.has_permission('fine_management'));
CREATE POLICY fines_delete ON public.fines FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE TRIGGER fines_updated BEFORE UPDATE ON public.fines FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fine_id uuid NOT NULL REFERENCES public.fines(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  reference text,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING (public.has_permission('fine_management') OR public.has_permission('reports'));
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('fine_management'));
CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 6. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  type text NOT NULL,
  recipient_email text,
  subject text NOT NULL,
  body text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (public.has_permission('notification_management') OR public.has_permission('loans') OR public.has_permission('reservations'));
CREATE POLICY notifications_write ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('issue_books') OR public.has_permission('reservations') OR public.has_permission('notification_management'));
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING (public.has_permission('notification_management') OR public.has_permission('return_books'))
  WITH CHECK (public.has_permission('notification_management') OR public.has_permission('return_books'));
CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS notifications_sched_idx ON public.notifications (status, scheduled_for);

-- 7. new signups are pending with no permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF lower(NEW.email) = 'immaster2024@gmail.com' THEN
    INSERT INTO public.profiles (id, full_name, email, job_title, status)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, 'Super Admin', 'active')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.profiles (id, full_name, email, job_title, status)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, 'Pending User', 'pending')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

-- 8. protect status from self-edit
CREATE OR REPLACE FUNCTION public.tg_protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    NEW.job_title := OLD.job_title;
    NEW.job_name := OLD.job_name;
    NEW.email := OLD.email;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $function$;