-- profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text NOT NULL DEFAULT 'Librarian',
  ADD COLUMN IF NOT EXISTS job_name text;

-- permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- helpers
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_perm text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _perm);
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text, uuid) TO authenticated;

-- seed super admin if the account already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users WHERE lower(email) = 'immaster2024@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles p SET job_title = 'Super Admin'
FROM auth.users u WHERE u.id = p.id AND lower(u.email) = 'immaster2024@gmail.com';

-- signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, job_title)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.email,
    CASE WHEN lower(NEW.email) = 'immaster2024@gmail.com' THEN 'Super Admin' ELSE 'Librarian' END
  )
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'immaster2024@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'librarian')
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_permissions (user_id, permission)
    SELECT NEW.id, p FROM unnest(ARRAY['dashboard','books','members','loans','returns','reservations','reports']) AS p
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- prevent employees from changing their own job title/name
CREATE OR REPLACE FUNCTION public.tg_protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    NEW.job_title := OLD.job_title;
    NEW.job_name := OLD.job_name;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_profile_fields();

-- ================= POLICIES =================
DROP POLICY IF EXISTS user_permissions_read ON public.user_permissions;
CREATE POLICY user_permissions_read ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS user_permissions_write ON public.user_permissions;
CREATE POLICY user_permissions_write ON public.user_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- user_roles
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY user_roles_write ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- profiles
DROP POLICY IF EXISTS profiles_select_self_or_staff ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_permission('user_management') OR public.has_permission('members'));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS profiles_delete_super ON public.profiles;
CREATE POLICY profiles_delete_super ON public.profiles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- books
DROP POLICY IF EXISTS books_read_staff ON public.books;
DROP POLICY IF EXISTS books_write_admin ON public.books;
CREATE POLICY books_select ON public.books FOR SELECT TO authenticated USING (public.has_permission('books'));
CREATE POLICY books_insert ON public.books FOR INSERT TO authenticated WITH CHECK (public.has_permission('add_book'));
CREATE POLICY books_update ON public.books FOR UPDATE TO authenticated
  USING (public.has_permission('edit_book')) WITH CHECK (public.has_permission('edit_book'));
CREATE POLICY books_delete ON public.books FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- book copies
DROP POLICY IF EXISTS copies_read_staff ON public.book_copies;
DROP POLICY IF EXISTS copies_write_staff ON public.book_copies;
CREATE POLICY copies_select ON public.book_copies FOR SELECT TO authenticated USING (public.has_permission('books'));
CREATE POLICY copies_insert ON public.book_copies FOR INSERT TO authenticated WITH CHECK (public.has_permission('add_book') OR public.has_permission('edit_book'));
CREATE POLICY copies_update ON public.book_copies FOR UPDATE TO authenticated
  USING (public.has_permission('edit_book') OR public.has_permission('issue_books') OR public.has_permission('return_books'))
  WITH CHECK (public.has_permission('edit_book') OR public.has_permission('issue_books') OR public.has_permission('return_books'));
CREATE POLICY copies_delete ON public.book_copies FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- categories
DROP POLICY IF EXISTS categories_read_staff ON public.categories;
DROP POLICY IF EXISTS categories_write_admin ON public.categories;
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (public.has_permission('books'));
CREATE POLICY categories_write ON public.categories FOR ALL TO authenticated
  USING (public.has_permission('add_book') OR public.has_permission('edit_book'))
  WITH CHECK (public.has_permission('add_book') OR public.has_permission('edit_book'));

-- members
DROP POLICY IF EXISTS members_read_staff ON public.members;
DROP POLICY IF EXISTS members_write_staff ON public.members;
CREATE POLICY members_select ON public.members FOR SELECT TO authenticated USING (public.has_permission('members'));
CREATE POLICY members_insert ON public.members FOR INSERT TO authenticated WITH CHECK (public.has_permission('register_members'));
CREATE POLICY members_update ON public.members FOR UPDATE TO authenticated
  USING (public.has_permission('register_members')) WITH CHECK (public.has_permission('register_members'));
CREATE POLICY members_delete ON public.members FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- loans
DROP POLICY IF EXISTS loans_read_staff ON public.loans;
DROP POLICY IF EXISTS loans_write_staff ON public.loans;
CREATE POLICY loans_select ON public.loans FOR SELECT TO authenticated
  USING (public.has_permission('loans') OR public.has_permission('returns'));
CREATE POLICY loans_insert ON public.loans FOR INSERT TO authenticated WITH CHECK (public.has_permission('issue_books'));
CREATE POLICY loans_update ON public.loans FOR UPDATE TO authenticated
  USING (public.has_permission('issue_books') OR public.has_permission('return_books'))
  WITH CHECK (public.has_permission('issue_books') OR public.has_permission('return_books'));
CREATE POLICY loans_delete ON public.loans FOR DELETE TO authenticated USING (public.has_permission('issue_books'));

-- reservations
DROP POLICY IF EXISTS reservations_read_staff ON public.reservations;
DROP POLICY IF EXISTS reservations_write_staff ON public.reservations;
CREATE POLICY reservations_select ON public.reservations FOR SELECT TO authenticated USING (public.has_permission('reservations'));
CREATE POLICY reservations_write ON public.reservations FOR ALL TO authenticated
  USING (public.has_permission('reservations')) WITH CHECK (public.has_permission('reservations'));

-- activity logs
DROP POLICY IF EXISTS logs_read_staff ON public.activity_logs;
DROP POLICY IF EXISTS logs_insert_staff ON public.activity_logs;
CREATE POLICY logs_select ON public.activity_logs FOR SELECT TO authenticated USING (public.has_permission('activity_logs'));
CREATE POLICY logs_insert ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- settings
DROP POLICY IF EXISTS settings_read_staff ON public.settings;
DROP POLICY IF EXISTS settings_write_admin ON public.settings;
CREATE POLICY settings_select ON public.settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY settings_write ON public.settings FOR ALL TO authenticated
  USING (public.has_permission('settings')) WITH CHECK (public.has_permission('settings'));
