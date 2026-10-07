-- Migration: 20260928000000_rich_application_fields.sql
-- Purpose:
--   1. Add structured columns to vendor_profiles (printer_fleet, gst_number, monthly_capacity_estimate)
--   2. Add structured columns to freelancer_profiles (software_proficiency, rate_expectation, specialization)
--   3. Create vendor_payout_details table (tighter RLS — only vendor owner + service_role)
--   4. Update apply_vendor_profile RPC to store new fields
--   5. Update register_freelancer_profile RPC to store new fields
--   6. Update admin_get_pending_providers to surface new fields

-- 1. vendor_profiles: add structured columns
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS printer_fleet             jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gst_number                text  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_capacity_estimate text  DEFAULT NULL;

-- 2. freelancer_profiles: add structured columns
ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS software_proficiency text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS rate_expectation     text   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS specialization       text   DEFAULT NULL;

-- 3. vendor_payout_details: separate table, tight RLS
--    Collected ONLY after approval. Bank/UPI must NOT sit in the table admins browse during review.
CREATE TABLE IF NOT EXISTS public.vendor_payout_details (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id      uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method    text NOT NULL CHECK (payout_method IN ('bank_transfer', 'upi')),
  beneficiary_name text,
  account_number   text,
  ifsc_code        text,
  upi_id           text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id)
);

ALTER TABLE public.vendor_payout_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_payout_owner_rw" ON public.vendor_payout_details;
CREATE POLICY "vendor_payout_owner_rw"
  ON public.vendor_payout_details
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Update apply_vendor_profile RPC (new params)
DROP FUNCTION IF EXISTS public.apply_vendor_profile(uuid, text, text, text[], text);

CREATE OR REPLACE FUNCTION public.apply_vendor_profile(
  p_user_id                   uuid,
  p_business_name             text,
  p_location                  text  DEFAULT NULL,
  p_materials_supported       text[] DEFAULT '{}'::text[],
  p_capacity_notes            text  DEFAULT NULL,
  p_printer_fleet             jsonb DEFAULT '[]'::jsonb,
  p_gst_number                text  DEFAULT NULL,
  p_monthly_capacity_estimate text  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_status      text := 'pending';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  SELECT id, status INTO v_provider_id, v_status
  FROM public.providers
  WHERE user_id = p_user_id AND type = 'vendor';

  IF v_provider_id IS NULL THEN
    INSERT INTO public.providers (user_id, type, status)
    VALUES (p_user_id, 'vendor', 'pending')
    RETURNING id INTO v_provider_id;
    v_status := 'pending';
  ELSIF v_status != 'approved' THEN
    v_status := 'pending';
    UPDATE public.providers SET status = 'pending' WHERE id = v_provider_id;
  END IF;

  INSERT INTO public.vendor_profiles (
    provider_id, business_name, location, materials_supported, capacity_notes,
    printer_fleet, gst_number, monthly_capacity_estimate, status, updated_at
  ) VALUES (
    v_provider_id, p_business_name, p_location, p_materials_supported, p_capacity_notes,
    p_printer_fleet, p_gst_number, p_monthly_capacity_estimate, v_status, now()
  )
  ON CONFLICT (provider_id) DO UPDATE SET
    business_name             = EXCLUDED.business_name,
    location                  = EXCLUDED.location,
    materials_supported       = EXCLUDED.materials_supported,
    capacity_notes            = EXCLUDED.capacity_notes,
    printer_fleet             = EXCLUDED.printer_fleet,
    gst_number                = EXCLUDED.gst_number,
    monthly_capacity_estimate = EXCLUDED.monthly_capacity_estimate,
    updated_at                = now();

  RETURN v_provider_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_vendor_profile(uuid, text, text, text[], text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_vendor_profile(uuid, text, text, text[], text, jsonb, text, text) TO service_role;

-- 5. Update register_freelancer_profile RPC (new params)
DROP FUNCTION IF EXISTS public.register_freelancer_profile(uuid, text, text, text[], text[], text, numeric);

CREATE OR REPLACE FUNCTION public.register_freelancer_profile(
  p_user_id              uuid,
  p_display_name         text,
  p_bio                  text,
  p_skills               text[],
  p_portfolio_urls       text[],
  p_rate_type            text,
  p_base_rate            numeric,
  p_software_proficiency text[]  DEFAULT '{}'::text[],
  p_rate_expectation     text    DEFAULT NULL,
  p_specialization       text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_provider_id       uuid;
  v_existing_provider public.providers%ROWTYPE;
  v_status            text := 'pending';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required.');
  END IF;
  IF NULLIF(TRIM(p_display_name), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Display name is required.');
  END IF;
  IF p_rate_type NOT IN ('hourly', 'fixed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rate type must be hourly or fixed.');
  END IF;
  IF p_base_rate IS NULL OR p_base_rate < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Base rate must be non-negative.');
  END IF;

  SELECT * INTO v_existing_provider
  FROM public.providers
  WHERE user_id = p_user_id AND type = 'freelancer';

  IF FOUND THEN
    v_provider_id := v_existing_provider.id;
    v_status := CASE WHEN v_existing_provider.status = 'approved' THEN 'approved' ELSE 'pending' END;
    UPDATE public.providers SET status = v_status WHERE id = v_provider_id;
  ELSE
    INSERT INTO public.providers (user_id, type, status)
    VALUES (p_user_id, 'freelancer', 'pending')
    RETURNING id INTO v_provider_id;
    v_status := 'pending';
  END IF;

  INSERT INTO public.freelancer_profiles (
    provider_id, user_id, display_name, bio, skills, portfolio_urls,
    rate_type, base_rate, software_proficiency, rate_expectation, specialization, status, updated_at
  ) VALUES (
    v_provider_id, p_user_id, p_display_name, p_bio, p_skills, p_portfolio_urls,
    p_rate_type, p_base_rate, p_software_proficiency, p_rate_expectation, p_specialization, v_status, now()
  )
  ON CONFLICT (provider_id) DO UPDATE SET
    display_name         = EXCLUDED.display_name,
    bio                  = EXCLUDED.bio,
    skills               = EXCLUDED.skills,
    portfolio_urls       = EXCLUDED.portfolio_urls,
    rate_type            = EXCLUDED.rate_type,
    base_rate            = EXCLUDED.base_rate,
    software_proficiency = EXCLUDED.software_proficiency,
    rate_expectation     = EXCLUDED.rate_expectation,
    specialization       = EXCLUDED.specialization,
    updated_at           = now();

  RETURN jsonb_build_object('success', true, 'provider_id', v_provider_id, 'status', v_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_freelancer_profile(uuid, text, text, text[], text[], text, numeric, text[], text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_freelancer_profile(uuid, text, text, text[], text[], text, numeric, text[], text, text) TO service_role;

-- 6. Update admin_get_pending_providers to surface new fields
DROP FUNCTION IF EXISTS public.admin_get_pending_providers(text);

CREATE OR REPLACE FUNCTION public.admin_get_pending_providers(
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  provider_id     uuid,
  user_id         uuid,
  type            text,
  status          text,
  created_at      timestamptz,
  applicant_name  text,
  applicant_email text,
  admin_notes     text,
  details         jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id                                                      AS provider_id,
    pr.user_id,
    pr.type::text,
    pr.status::text,
    pr.created_at,
    COALESCE(prof.full_name, 'Unknown Applicant')::text        AS applicant_name,
    COALESCE(u.email::text, prof.email::text, 'No email'::text) AS applicant_email,
    pr.admin_notes::text,
    CASE
      WHEN pr.type = 'vendor' THEN jsonb_build_object(
        'business_name',             vp.business_name,
        'location',                  vp.location,
        'materials_supported',       vp.materials_supported,
        'capacity_notes',            vp.capacity_notes,
        'printer_fleet',             vp.printer_fleet,
        'gst_number',                vp.gst_number,
        'monthly_capacity_estimate', vp.monthly_capacity_estimate,
        'profile_status',            vp.status,
        'admin_notes',               pr.admin_notes
      )
      WHEN pr.type = 'freelancer' THEN jsonb_build_object(
        'display_name',        fp.display_name,
        'bio',                 fp.bio,
        'skills',              fp.skills,
        'portfolio_urls',      fp.portfolio_urls,
        'rate_type',           fp.rate_type,
        'base_rate',           fp.base_rate,
        'software_proficiency', fp.software_proficiency,
        'rate_expectation',    fp.rate_expectation,
        'specialization',      fp.specialization,
        'profile_status',      fp.status,
        'admin_notes',         pr.admin_notes
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
      WHEN pr.status = 'pending'           THEN 0
      WHEN pr.status = 'changes_requested' THEN 1
      ELSE 2
    END,
    pr.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_pending_providers(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_pending_providers(text) TO service_role;
