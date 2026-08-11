-- 1. Add 'member' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'member';

-- 2. Link public.members to auth.users
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_idx ON public.members (user_id);

-- 3. Update the handle_new_user trigger
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
    -- Any other sign up goes to members table by default
    INSERT INTO public.members (user_id, full_name, email, status)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, 'active');
    
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

-- 4. RLS for members to access their own data
-- Update policies on `public.members`
CREATE POLICY "members_read_own" ON public.members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "members_update_own" ON public.members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Update policies on `public.loans`
CREATE POLICY "loans_read_own" ON public.loans FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- Update policies on `public.reservations`
CREATE POLICY "reservations_read_own" ON public.reservations FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
CREATE POLICY "reservations_write_own" ON public.reservations FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- Update policies on `public.books` and `public.categories` so everyone can see them
CREATE POLICY "books_read_all" ON public.books FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_read_all" ON public.categories FOR SELECT TO authenticated USING (true);
