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