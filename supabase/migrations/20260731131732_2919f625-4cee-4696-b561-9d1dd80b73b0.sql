
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
