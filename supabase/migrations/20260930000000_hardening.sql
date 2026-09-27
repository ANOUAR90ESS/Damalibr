-- handle_new_user() only runs as the auth.users trigger; it must not be callable through the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
