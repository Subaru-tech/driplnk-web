-- Migration: 20260913210000_storage_helper_identity_fix.sql
-- Follow-up to 20260913200000: that migration dropped every storage/RLS
-- policy that called can_upload_to_storage_folder(), but left the function
-- itself returning TRUE for any existing profile id — a one-copy-paste-away
-- vulnerability (and the regression suite caught exactly that).
--
-- The function is rewritten to be identity-safe: it only grants access to
-- the CALLER's own folder. Any future policy that references it is safe by
-- construction instead of safe by audit. EXECUTE is revoked from client
-- roles; nothing calls it anymore.

CREATE OR REPLACE FUNCTION public.can_upload_to_storage_folder(folder_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  -- Identity-safe: a session may only ever address its own storage folder.
  -- (The old body — "profile id exists" — granted every user access to every
  -- other user's folder and is the vulnerability this migration closes.)
  -- IS NOT DISTINCT FROM keeps the result a strict boolean: with no user
  -- claims auth.uid() is NULL and the comparison is simply FALSE — unknown
  -- must mean deny.
  SELECT folder_id IS NOT DISTINCT FROM auth.uid()::text;
$function$;

REVOKE EXECUTE ON FUNCTION public.can_upload_to_storage_folder(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_to_storage_folder(text) TO service_role;
