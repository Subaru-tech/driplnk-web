-- Migration: 20260915000000_trust_layer_and_request_changes.sql
-- Description: Trust layer unified verification with Request Changes flow

-- 1. Update status check constraints across providers, vendor_profiles, freelancer_profiles
ALTER TABLE public.providers DROP CONSTRAINT IF EXISTS providers_status_check;
ALTER TABLE public.providers ADD CONSTRAINT providers_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested'));

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_status_check;
ALTER TABLE public.vendor_profiles ADD CONSTRAINT vendor_profiles_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested'));

ALTER TABLE public.freelancer_profiles DROP CONSTRAINT IF EXISTS freelancer_profiles_status_check;
ALTER TABLE public.freelancer_profiles ADD CONSTRAINT freelancer_profiles_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested'));

-- 2. Add admin_notes column for actionable feedback during "Request Changes"
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT NULL;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT NULL;
ALTER TABLE public.freelancer_profiles ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT NULL;

-- 3. Update public.admin_review_provider RPC to handle 'changes_requested' and save admin notes
CREATE OR REPLACE FUNCTION public.admin_review_provider(
  p_provider_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_provider public.providers%ROWTYPE;
BEGIN
  IF p_status NOT IN ('approved', 'rejected', 'pending', 'changes_requested') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be approved, rejected, pending, or changes_requested.', p_status;
  END IF;

  SELECT * INTO v_provider FROM public.providers WHERE id = p_provider_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found with ID: %', p_provider_id;
  END IF;

  UPDATE public.providers
  SET status = p_status,
      admin_notes = p_notes
  WHERE id = p_provider_id;

  IF v_provider.type = 'vendor' THEN
    UPDATE public.vendor_profiles
    SET status = p_status,
        admin_notes = p_notes,
        updated_at = now()
    WHERE provider_id = p_provider_id;
  ELSIF v_provider.type = 'freelancer' THEN
    UPDATE public.freelancer_profiles
    SET status = p_status,
        admin_notes = p_notes,
        updated_at = now()
    WHERE provider_id = p_provider_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'provider_id', p_provider_id,
    'status', p_status,
    'notes', p_notes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_provider(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_provider(uuid, text, text) TO service_role;

-- 4. Update public.admin_get_pending_providers to return admin_notes in details
DROP FUNCTION IF EXISTS public.admin_get_pending_providers(text);
CREATE OR REPLACE FUNCTION public.admin_get_pending_providers(
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  provider_id uuid,
  user_id uuid,
  type text,
  status text,
  created_at timestamptz,
  applicant_name text,
  applicant_email text,
  admin_notes text,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id AS provider_id,
    pr.user_id,
    pr.type::text,
    pr.status::text,
    pr.created_at,
    COALESCE(prof.full_name, 'Unknown Applicant')::text AS applicant_name,
    COALESCE(u.email::text, prof.email::text, 'No email'::text) AS applicant_email,
    pr.admin_notes::text,
    CASE 
      WHEN pr.type = 'vendor' THEN
        jsonb_build_object(
          'business_name', vp.business_name,
          'location', vp.location,
          'materials_supported', vp.materials_supported,
          'capacity_notes', vp.capacity_notes,
          'profile_status', vp.status,
          'admin_notes', pr.admin_notes
        )
      WHEN pr.type = 'freelancer' THEN
        jsonb_build_object(
          'display_name', fp.display_name,
          'bio', fp.bio,
          'skills', fp.skills,
          'portfolio_urls', fp.portfolio_urls,
          'rate_type', fp.rate_type,
          'base_rate', fp.base_rate,
          'profile_status', fp.status,
          'admin_notes', pr.admin_notes
        )
      ELSE '{}'::jsonb
    END AS details
  FROM public.providers pr
  LEFT JOIN public.profiles prof ON prof.id = pr.user_id
  LEFT JOIN auth.users u ON u.id = pr.user_id
  LEFT JOIN public.vendor_profiles vp ON vp.provider_id = pr.id
  LEFT JOIN public.freelancer_profiles fp ON fp.provider_id = pr.id
  WHERE (p_type IS NULL OR pr.type = p_type)
  ORDER BY 
    CASE 
      WHEN pr.status = 'pending' THEN 0 
      WHEN pr.status = 'changes_requested' THEN 1
      ELSE 2 
    END,
    pr.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_pending_providers(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_pending_providers(text) TO service_role;
