-- Smart Library Management System — full schema export
-- Run this in the SQL Editor of your own Supabase project (tvoztnxvnzynezmksdxk).
-- Migrations are concatenated in chronological order.

-- ============================================================
-- 20260729071521_c265ba57-da25-42a1-9130-38dddd997f8d.sql
-- ============================================================

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','librarian');
CREATE TYPE public.member_status AS ENUM ('active','suspended','expired');
CREATE TYPE public.loan_status AS ENUM ('active','returned','overdue');
CREATE TYPE public.reservation_status AS ENUM ('waiting','ready','fulfilled','cancelled','expired');
CREATE TYPE public.copy_condition AS ENUM ('available','borrowed','damaged','lost','reserved');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES (staff) ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role='admin'));

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid());
$$;

-- Signup trigger: create profile + assign role (first user = admin, rest = librarian)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE role_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);

  SELECT COUNT(*) INTO role_count FROM public.user_roles;
  IF role_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'librarian'));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_read_staff" ON public.categories FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "categories_write_admin" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ BOOKS ============
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_number TEXT UNIQUE NOT NULL DEFAULT ('BK-' || lpad((floor(random()*1000000))::TEXT, 6, '0')),
  isbn TEXT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT,
  edition TEXT,
  publication_year INT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  shelf_number TEXT,
  classification TEXT,
  cover_url TEXT,
  reference_only BOOLEAN NOT NULL DEFAULT false,
  total_copies INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX books_title_idx ON public.books USING gin (to_tsvector('english', title || ' ' || author));
CREATE INDEX books_category_idx ON public.books (category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books_read_staff" ON public.books FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "books_write_admin" ON public.books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER books_updated BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ BOOK COPIES ============
CREATE TABLE public.book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  copy_number INT NOT NULL,
  barcode TEXT UNIQUE NOT NULL DEFAULT ('CP-' || lpad((floor(random()*10000000))::TEXT, 7, '0')),
  status copy_condition NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id, copy_number)
);
CREATE INDEX book_copies_book_idx ON public.book_copies (book_id);
CREATE INDEX book_copies_status_idx ON public.book_copies (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_copies TO authenticated;
GRANT ALL ON public.book_copies TO service_role;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copies_read_staff" ON public.book_copies FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "copies_write_staff" ON public.book_copies FOR ALL TO authenticated
  USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());

-- ============ MEMBERS (library patrons) ============
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number TEXT UNIQUE NOT NULL DEFAULT ('MB-' || lpad((floor(random()*1000000))::TEXT, 6, '0')),
  full_name TEXT NOT NULL,
  gender TEXT,
  nic TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status member_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX members_name_idx ON public.members (full_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_read_staff" ON public.members FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "members_write_staff" ON public.members FOR ALL TO authenticated
  USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
CREATE TRIGGER members_updated BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ LOANS ============
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT UNIQUE NOT NULL DEFAULT ('LN-' || lpad((floor(random()*10000000))::TEXT, 7, '0')),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  return_condition copy_condition,
  status loan_status NOT NULL DEFAULT 'active',
  fine_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  fine_paid BOOLEAN NOT NULL DEFAULT false,
  issued_by UUID REFERENCES auth.users(id),
  returned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX loans_member_idx ON public.loans (member_id);
CREATE INDEX loans_copy_idx ON public.loans (copy_id);
CREATE INDEX loans_status_idx ON public.loans (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_read_staff" ON public.loans FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "loans_write_staff" ON public.loans FOR ALL TO authenticated
  USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
CREATE TRIGGER loans_updated BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ RESERVATIONS ============
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT UNIQUE NOT NULL DEFAULT ('RS-' || lpad((floor(random()*10000000))::TEXT, 7, '0')),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  queue_position INT NOT NULL DEFAULT 1,
  status reservation_status NOT NULL DEFAULT 'waiting',
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reservations_book_idx ON public.reservations (book_id);
CREATE INDEX reservations_member_idx ON public.reservations (member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_read_staff" ON public.reservations FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "reservations_write_staff" ON public.reservations FOR ALL TO authenticated
  USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_created_idx ON public.activity_logs (created_at DESC);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_read_staff" ON public.activity_logs FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "logs_insert_staff" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());

-- ============ SETTINGS ============
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_staff" ON public.settings FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "settings_write_admin" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.settings(key,value) VALUES
  ('fine_per_day','25'),
  ('loan_duration_days','14'),
  ('max_books_per_member','5'),
  ('reservation_expiry_days','3'),
  ('library_name','"Smart Library"');

-- ============ SEED CATEGORIES ============
INSERT INTO public.categories(name, description) VALUES
  ('Fiction','Novels and short stories'),
  ('Non-Fiction','Biographies, essays, and factual works'),
  ('Science','Physics, biology, chemistry, and more'),
  ('Technology','Computers, engineering, and IT'),
  ('History','World and regional history'),
  ('Philosophy','Thought, ethics, logic'),
  ('Children','Picture books and young readers'),
  ('Reference','Encyclopedias and dictionaries');

-- ============ SEED BOOKS ============
WITH cats AS (SELECT id, name FROM public.categories)
INSERT INTO public.books (isbn, title, author, publisher, edition, publication_year, category_id, shelf_number, classification, reference_only, total_copies)
SELECT * FROM (VALUES
  ('978-0451524935','1984','George Orwell','Signet Classic','Reissue',1949,(SELECT id FROM cats WHERE name='Fiction'),'A-01','FIC-ORW',false,3),
  ('978-0061120084','To Kill a Mockingbird','Harper Lee','Harper Perennial','50th Anniv',1960,(SELECT id FROM cats WHERE name='Fiction'),'A-02','FIC-LEE',false,2),
  ('978-0743273565','The Great Gatsby','F. Scott Fitzgerald','Scribner','Reprint',1925,(SELECT id FROM cats WHERE name='Fiction'),'A-03','FIC-FIT',false,2),
  ('978-0132350884','Clean Code','Robert C. Martin','Prentice Hall','1st',2008,(SELECT id FROM cats WHERE name='Technology'),'T-01','TEC-MAR',false,4),
  ('978-0201633610','Design Patterns','Erich Gamma','Addison-Wesley','1st',1994,(SELECT id FROM cats WHERE name='Technology'),'T-02','TEC-GAM',false,2),
  ('978-1491950357','Building Microservices','Sam Newman','O''Reilly','2nd',2021,(SELECT id FROM cats WHERE name='Technology'),'T-03','TEC-NEW',false,3),
  ('978-0393317558','Guns, Germs, and Steel','Jared Diamond','W. W. Norton','1st',1997,(SELECT id FROM cats WHERE name='History'),'H-01','HIS-DIA',false,2),
  ('978-0062316097','Sapiens','Yuval Noah Harari','Harper','1st',2015,(SELECT id FROM cats WHERE name='History'),'H-02','HIS-HAR',false,3),
  ('978-0553380163','A Brief History of Time','Stephen Hawking','Bantam','10th Anniv',1998,(SELECT id FROM cats WHERE name='Science'),'S-01','SCI-HAW',false,2),
  ('978-0679760801','The Selfish Gene','Richard Dawkins','Oxford','30th Anniv',2006,(SELECT id FROM cats WHERE name='Science'),'S-02','SCI-DAW',false,2),
  ('978-0140449136','Meditations','Marcus Aurelius','Penguin Classics','Rev',2006,(SELECT id FROM cats WHERE name='Philosophy'),'P-01','PHI-AUR',false,2),
  ('978-0195050981','The Oxford English Dictionary','Oxford','Oxford Press','2nd',1989,(SELECT id FROM cats WHERE name='Reference'),'R-01','REF-OXF',true,1),
  ('978-0064430173','Charlotte''s Web','E. B. White','HarperCollins','Reissue',1952,(SELECT id FROM cats WHERE name='Children'),'C-01','CHI-WHI',false,3),
  ('978-0439554930','Harry Potter and the Sorcerer''s Stone','J. K. Rowling','Scholastic','1st',1998,(SELECT id FROM cats WHERE name='Children'),'C-02','CHI-ROW',false,4),
  ('978-0060935467','The Adventures of Huckleberry Finn','Mark Twain','Harper Perennial','Reprint',1884,(SELECT id FROM cats WHERE name='Fiction'),'A-04','FIC-TWA',false,2)
) AS v(isbn,title,author,publisher,edition,publication_year,category_id,shelf_number,classification,reference_only,total_copies);

-- Auto-generate copies for each seeded book
INSERT INTO public.book_copies (book_id, copy_number, status)
SELECT b.id, gs, 'available'
FROM public.books b, LATERAL generate_series(1, b.total_copies) gs;

-- ============ SEED MEMBERS ============
INSERT INTO public.members (full_name, gender, nic, address, phone, email) VALUES
  ('Amara Perera','Female','912345678V','12 Galle Rd, Colombo','+94 71 111 2222','amara@example.com'),
  ('Nuwan Silva','Male','892345678V','45 Kandy Rd, Kandy','+94 77 333 4444','nuwan@example.com'),
  ('Kavindi Fernando','Female','952345678V','8 Beach Rd, Galle','+94 76 555 6666','kavindi@example.com'),
  ('Rohan Jayasuriya','Male','872345678V','101 Lake Rd, Kurunegala','+94 70 777 8888','rohan@example.com'),
  ('Ishara Bandara','Female','982345678V','23 Hill St, Nuwara Eliya','+94 75 999 0000','ishara@example.com'),
  ('Dilan Wickrama','Male','902345678V','66 Main St, Matara','+94 71 222 3333','dilan@example.com');

-- ============================================================
-- 20260729071545_ff52acde-6e86-43ee-bd8e-5548da53da3d.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_is_staff() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260729075432_73e77ff9-72ae-4bc8-9620-dc90f5be3b80.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'librarian'::app_role)
  );
$$;

DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;

CREATE POLICY profiles_select_self_or_staff
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.current_user_is_staff());
-- ============================================================
-- 20260729080322_1965c61f-dd50-4b07-9c4b-a1c015d9c0b5.sql
-- ============================================================

-- Fix infinite recursion: replace self-referential user_roles policy with security-definer function
DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;

CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Grant EXECUTE on helper functions (security definer functions still need EXECUTE grant)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_staff() TO authenticated, anon;

-- ============================================================
-- 20260731125123_38ab5913-5e54-4c50-b54e-db92f76c8096.sql
-- ============================================================
-- 1. Role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'other';

-- ============================================================
-- 20260731125222_d9853d70-2d34-4d5a-965f-081839093508.sql
-- ============================================================
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

-- ============================================================
-- 20260731131732_2919f625-4cee-4696-b561-9d1dd80b73b0.sql
-- ============================================================

-- Remove blanket PUBLIC/anon execute on security definer helpers
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Keep the access the RLS policies actually need
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Trigger-only functions must not be callable from the API at all
REVOKE ALL ON FUNCTION public.tg_protect_profile_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260731133228_e92ffbf1-f56a-490c-be76-99d902918e75.sql
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role FROM auth.users u
WHERE lower(u.email) = 'immaster2024@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles p SET job_title = 'Super Admin'
WHERE lower(p.email) = 'immaster2024@gmail.com';
-- ============================================================
-- 20260805100145_b5a3e125-a709-4950-b5b6-d08b514003ae.sql
-- ============================================================
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
