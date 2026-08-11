
-- Fix infinite recursion: replace self-referential user_roles policy with security-definer function
DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;

CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Grant EXECUTE on helper functions (security definer functions still need EXECUTE grant)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_staff() TO authenticated, anon;
