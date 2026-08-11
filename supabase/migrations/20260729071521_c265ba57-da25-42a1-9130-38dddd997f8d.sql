
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
