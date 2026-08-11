INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role FROM auth.users u
WHERE lower(u.email) = 'immaster2024@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles p SET job_title = 'Super Admin'
WHERE lower(p.email) = 'immaster2024@gmail.com';