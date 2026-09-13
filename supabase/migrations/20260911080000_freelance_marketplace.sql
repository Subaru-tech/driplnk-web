-- Migration: 20260911080000_freelance_marketplace
-- Purpose: Schema, RLS, Storage, and RPCs for DripLnk Freelancer Marketplace

-- 1. Create providers table (shared infrastructure for freelancers and vendors)
CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('vendor', 'seller', 'freelancer')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT providers_user_id_type_key UNIQUE (user_id, type)
);

-- 2. Create freelancer_profiles table
CREATE TABLE IF NOT EXISTS public.freelancer_profiles (
  provider_id uuid PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  bio text,
  skills text[] NOT NULL DEFAULT '{}',
  portfolio_urls text[] NOT NULL DEFAULT '{}',
  rate_type text NOT NULL CHECK (rate_type IN ('hourly', 'fixed')),
  base_rate numeric NOT NULL CHECK (base_rate >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create freelance_requests table
CREATE TABLE IF NOT EXISTS public.freelance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  freelancer_provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  brief text NOT NULL,
  reference_file_paths text[] NOT NULL DEFAULT '{}',
  agreed_price numeric,
  status text NOT NULL CHECK (
    status IN ('requested', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled')
  ) DEFAULT 'requested',
  final_file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable Row-Level Security
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelance_requests ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies on providers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'providers' AND policyname = 'providers: public select approved') THEN
    CREATE POLICY "providers: public select approved" ON public.providers
      FOR SELECT USING (status = 'approved');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'providers' AND policyname = 'providers: user select own') THEN
    CREATE POLICY "providers: user select own" ON public.providers
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'providers' AND policyname = 'providers: user insert own') THEN
    CREATE POLICY "providers: user insert own" ON public.providers
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'providers' AND policyname = 'providers: user update own') THEN
    CREATE POLICY "providers: user update own" ON public.providers
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 6. RLS Policies on freelancer_profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelancer_profiles' AND policyname = 'freelancer_profiles: public select approved') THEN
    CREATE POLICY "freelancer_profiles: public select approved" ON public.freelancer_profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelancer_profiles.provider_id
            AND p.status = 'approved'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelancer_profiles' AND policyname = 'freelancer_profiles: owner select') THEN
    CREATE POLICY "freelancer_profiles: owner select" ON public.freelancer_profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelancer_profiles.provider_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelancer_profiles' AND policyname = 'freelancer_profiles: owner insert') THEN
    CREATE POLICY "freelancer_profiles: owner insert" ON public.freelancer_profiles
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelancer_profiles.provider_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelancer_profiles' AND policyname = 'freelancer_profiles: owner update') THEN
    CREATE POLICY "freelancer_profiles: owner update" ON public.freelancer_profiles
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelancer_profiles.provider_id
            AND p.user_id = auth.uid()
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelancer_profiles.provider_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 7. RLS Policies on freelance_requests
DO $$
BEGIN
  -- Buyer selects own requests
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelance_requests' AND policyname = 'freelance_requests: buyer select own') THEN
    CREATE POLICY "freelance_requests: buyer select own" ON public.freelance_requests
      FOR SELECT USING (buyer_user_id = auth.uid());
  END IF;

  -- Freelancer selects incoming requests assigned to their provider row
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelance_requests' AND policyname = 'freelance_requests: freelancer select own') THEN
    CREATE POLICY "freelance_requests: freelancer select own" ON public.freelance_requests
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelance_requests.freelancer_provider_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;

  -- Buyer inserts request (cannot hire self)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelance_requests' AND policyname = 'freelance_requests: buyer insert own') THEN
    CREATE POLICY "freelance_requests: buyer insert own" ON public.freelance_requests
      FOR INSERT WITH CHECK (
        buyer_user_id = auth.uid()
        AND NOT EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelance_requests.freelancer_provider_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;

  -- Buyer updates own request (e.g. mark completed or cancel)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelance_requests' AND policyname = 'freelance_requests: buyer update own') THEN
    CREATE POLICY "freelance_requests: buyer update own" ON public.freelance_requests
      FOR UPDATE USING (
        buyer_user_id = auth.uid()
      ) WITH CHECK (
        buyer_user_id = auth.uid()
      );
  END IF;

  -- Freelancer updates assigned request (e.g. accept, deliver, cancel)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freelance_requests' AND policyname = 'freelance_requests: freelancer update own') THEN
    CREATE POLICY "freelance_requests: freelancer update own" ON public.freelance_requests
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelance_requests.freelancer_provider_id
            AND p.user_id = auth.uid()
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = freelance_requests.freelancer_provider_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 8. Storage bucket provision
INSERT INTO storage.buckets (id, name, public)
VALUES ('freelance-deliverables', 'freelance-deliverables', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'freelance-deliverables: upload') THEN
    CREATE POLICY "freelance-deliverables: upload" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'freelance-deliverables' AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR can_upload_to_storage_folder((storage.foldername(name))[1])
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'freelance-deliverables: update') THEN
    CREATE POLICY "freelance-deliverables: update" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'freelance-deliverables' AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR can_upload_to_storage_folder((storage.foldername(name))[1])
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'freelance-deliverables: delete') THEN
    CREATE POLICY "freelance-deliverables: delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'freelance-deliverables' AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR can_upload_to_storage_folder((storage.foldername(name))[1])
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'freelance-deliverables: select') THEN
    CREATE POLICY "freelance-deliverables: select" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'freelance-deliverables' AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR can_upload_to_storage_folder((storage.foldername(name))[1])
        )
      );
  END IF;
END $$;

-- 9. Atomic RPC: register_freelancer_profile
CREATE OR REPLACE FUNCTION public.register_freelancer_profile(
  p_user_id uuid,
  p_display_name text,
  p_bio text,
  p_skills text[],
  p_portfolio_urls text[],
  p_rate_type text,
  p_base_rate numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_existing_provider public.providers%ROWTYPE;
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
    UPDATE public.providers
    SET status = 'approved'
    WHERE id = v_provider_id;

    INSERT INTO public.freelancer_profiles (
      provider_id, display_name, bio, skills, portfolio_urls, rate_type, base_rate, updated_at
    ) VALUES (
      v_provider_id,
      TRIM(p_display_name),
      NULLIF(TRIM(p_bio), ''),
      COALESCE(p_skills, '{}'),
      COALESCE(p_portfolio_urls, '{}'),
      p_rate_type,
      p_base_rate,
      now()
    )
    ON CONFLICT (provider_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio,
      skills = EXCLUDED.skills,
      portfolio_urls = EXCLUDED.portfolio_urls,
      rate_type = EXCLUDED.rate_type,
      base_rate = EXCLUDED.base_rate,
      updated_at = now();
  ELSE
    INSERT INTO public.providers (user_id, type, status)
    VALUES (p_user_id, 'freelancer', 'approved')
    RETURNING id INTO v_provider_id;

    INSERT INTO public.freelancer_profiles (
      provider_id, display_name, bio, skills, portfolio_urls, rate_type, base_rate, updated_at
    ) VALUES (
      v_provider_id,
      TRIM(p_display_name),
      NULLIF(TRIM(p_bio), ''),
      COALESCE(p_skills, '{}'),
      COALESCE(p_portfolio_urls, '{}'),
      p_rate_type,
      p_base_rate,
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'provider_id', v_provider_id
  );
END;
$$;

-- 10. Atomic RPC: create_freelance_request
CREATE OR REPLACE FUNCTION public.create_freelance_request(
  p_buyer_user_id uuid,
  p_freelancer_provider_id uuid,
  p_brief text,
  p_reference_file_paths text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_provider public.providers%ROWTYPE;
  v_request_id uuid;
BEGIN
  IF p_buyer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Buyer user ID is required.');
  END IF;

  IF NULLIF(TRIM(p_brief), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project brief is required.');
  END IF;

  SELECT * INTO v_provider
  FROM public.providers
  WHERE id = p_freelancer_provider_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freelancer not found.');
  END IF;

  IF v_provider.status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freelancer is not currently available.');
  END IF;

  IF v_provider.user_id = p_buyer_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot hire yourself.');
  END IF;

  INSERT INTO public.freelance_requests (
    buyer_user_id,
    freelancer_provider_id,
    brief,
    reference_file_paths,
    status
  ) VALUES (
    p_buyer_user_id,
    p_freelancer_provider_id,
    TRIM(p_brief),
    COALESCE(p_reference_file_paths, '{}'),
    'requested'
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id
  );
END;
$$;

-- 11. Atomic RPC: respond_to_freelance_request
CREATE OR REPLACE FUNCTION public.respond_to_freelance_request(
  p_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_agreed_price numeric DEFAULT NULL,
  p_final_file_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_req public.freelance_requests%ROWTYPE;
  v_prov public.providers%ROWTYPE;
  v_is_freelancer boolean := false;
  v_is_buyer boolean := false;
BEGIN
  SELECT * INTO v_req
  FROM public.freelance_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found.');
  END IF;

  SELECT * INTO v_prov
  FROM public.providers
  WHERE id = v_req.freelancer_provider_id;

  IF v_prov.user_id = p_user_id THEN
    v_is_freelancer := true;
  END IF;

  IF v_req.buyer_user_id = p_user_id THEN
    v_is_buyer := true;
  END IF;

  IF NOT v_is_freelancer AND NOT v_is_buyer THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  -- Actions for freelancer
  IF p_action = 'accept' THEN
    IF NOT v_is_freelancer THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the freelancer can accept this request.');
    END IF;
    IF v_req.status <> 'requested' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Request cannot be accepted in its current status.');
    END IF;
    IF p_agreed_price IS NULL OR p_agreed_price <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'A valid agreed price is required to accept.');
    END IF;

    UPDATE public.freelance_requests
    SET status = 'accepted',
        agreed_price = p_agreed_price,
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'accepted');

  ELSIF p_action = 'start_work' THEN
    IF NOT v_is_freelancer THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the freelancer can start work.');
    END IF;
    IF v_req.status <> 'accepted' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Request must be accepted before starting work.');
    END IF;

    UPDATE public.freelance_requests
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'in_progress');

  ELSIF p_action = 'deliver' THEN
    IF NOT v_is_freelancer THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the freelancer can deliver files.');
    END IF;
    IF v_req.status NOT IN ('accepted', 'in_progress') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Request cannot be delivered in its current status.');
    END IF;
    IF NULLIF(TRIM(p_final_file_path), '') IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Deliverable file path is required.');
    END IF;

    UPDATE public.freelance_requests
    SET status = 'delivered',
        final_file_path = TRIM(p_final_file_path),
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'delivered');

  ELSIF p_action = 'complete' THEN
    IF NOT v_is_buyer THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the buyer can mark the job completed.');
    END IF;
    IF v_req.status <> 'delivered' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Request can only be completed once delivered.');
    END IF;

    UPDATE public.freelance_requests
    SET status = 'completed',
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'completed');

  ELSIF p_action = 'cancel' THEN
    IF v_req.status IN ('completed', 'cancelled') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Request is already finalized.');
    END IF;

    UPDATE public.freelance_requests
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'cancelled');

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown action.');
  END IF;
END;
$$;

-- 12. RPC: get_freelance_browse_profiles
CREATE OR REPLACE FUNCTION public.get_freelance_browse_profiles(
  p_search text DEFAULT NULL,
  p_skill text DEFAULT NULL,
  p_rate_type text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 12
)
RETURNS TABLE (
  provider_id uuid,
  user_id uuid,
  display_name text,
  bio text,
  skills text[],
  portfolio_urls text[],
  rate_type text,
  base_rate numeric,
  avatar_url text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_offset integer := (GREATEST(p_page, 1) - 1) * p_page_size;
  v_clean_search text := NULLIF(TRIM(p_search), '');
  v_clean_skill text := NULLIF(TRIM(p_skill), '');
  v_clean_rate_type text := NULLIF(TRIM(p_rate_type), '');
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT 
      fp.provider_id,
      p.user_id,
      fp.display_name,
      fp.bio,
      fp.skills,
      fp.portfolio_urls,
      fp.rate_type,
      fp.base_rate,
      prof.avatar_url,
      COUNT(*) OVER() AS full_count
    FROM public.freelancer_profiles fp
    JOIN public.providers p ON p.id = fp.provider_id
    LEFT JOIN public.profiles prof ON prof.id = p.user_id
    WHERE p.status = 'approved'
      AND (v_clean_rate_type IS NULL OR fp.rate_type = v_clean_rate_type)
      AND (
        v_clean_skill IS NULL 
        OR v_clean_skill = ANY(fp.skills)
        OR EXISTS (
          SELECT 1 FROM unnest(fp.skills) s WHERE s ILIKE '%' || v_clean_skill || '%'
        )
      )
      AND (
        v_clean_search IS NULL
        OR fp.display_name ILIKE '%' || v_clean_search || '%'
        OR fp.bio ILIKE '%' || v_clean_search || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(fp.skills) s WHERE s ILIKE '%' || v_clean_search || '%'
        )
      )
  )
  SELECT 
    f.provider_id,
    f.user_id,
    f.display_name,
    f.bio,
    f.skills,
    f.portfolio_urls,
    f.rate_type,
    f.base_rate,
    f.avatar_url,
    f.full_count
  FROM filtered f
  ORDER BY f.display_name ASC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

-- 13. RPC: get_freelance_requests_for_user
-- Only exposes counterparty email once status is accepted, in_progress, delivered, or completed.
CREATE OR REPLACE FUNCTION public.get_freelance_requests_for_user(
  p_user_id uuid,
  p_role text -- 'buyer' or 'freelancer'
)
RETURNS TABLE (
  request_id uuid,
  buyer_user_id uuid,
  freelancer_provider_id uuid,
  freelancer_user_id uuid,
  brief text,
  reference_file_paths text[],
  agreed_price numeric,
  status text,
  final_file_path text,
  created_at timestamptz,
  updated_at timestamptz,
  buyer_name text,
  buyer_avatar text,
  buyer_email text,
  freelancer_name text,
  freelancer_avatar text,
  freelancer_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF p_role = 'buyer' THEN
    RETURN QUERY
    SELECT 
      fr.id AS request_id,
      fr.buyer_user_id,
      fr.freelancer_provider_id,
      p.user_id AS freelancer_user_id,
      fr.brief,
      fr.reference_file_paths,
      fr.agreed_price,
      fr.status,
      fr.final_file_path,
      fr.created_at,
      fr.updated_at,
      COALESCE(buyer_prof.full_name, 'Buyer')::text AS buyer_name,
      buyer_prof.avatar_url::text AS buyer_avatar,
      CASE 
        WHEN fr.status IN ('accepted', 'in_progress', 'delivered', 'completed') THEN buyer_u.email::text
        ELSE NULL::text
      END AS buyer_email,
      COALESCE(fp.display_name, fl_prof.full_name, 'Freelancer')::text AS freelancer_name,
      fl_prof.avatar_url::text AS freelancer_avatar,
      CASE 
        WHEN fr.status IN ('accepted', 'in_progress', 'delivered', 'completed') THEN fl_u.email::text
        ELSE NULL::text
      END AS freelancer_email
    FROM public.freelance_requests fr
    JOIN public.providers p ON p.id = fr.freelancer_provider_id
    LEFT JOIN public.freelancer_profiles fp ON fp.provider_id = p.id
    LEFT JOIN public.profiles buyer_prof ON buyer_prof.id = fr.buyer_user_id
    LEFT JOIN auth.users buyer_u ON buyer_u.id = fr.buyer_user_id
    LEFT JOIN public.profiles fl_prof ON fl_prof.id = p.user_id
    LEFT JOIN auth.users fl_u ON fl_u.id = p.user_id
    WHERE fr.buyer_user_id = p_user_id
    ORDER BY fr.created_at DESC;

  ELSE -- 'freelancer'
    RETURN QUERY
    SELECT 
      fr.id AS request_id,
      fr.buyer_user_id,
      fr.freelancer_provider_id,
      p.user_id AS freelancer_user_id,
      fr.brief,
      fr.reference_file_paths,
      fr.agreed_price,
      fr.status,
      fr.final_file_path,
      fr.created_at,
      fr.updated_at,
      COALESCE(buyer_prof.full_name, 'Buyer')::text AS buyer_name,
      buyer_prof.avatar_url::text AS buyer_avatar,
      CASE 
        WHEN fr.status IN ('accepted', 'in_progress', 'delivered', 'completed') THEN buyer_u.email::text
        ELSE NULL::text
      END AS buyer_email,
      COALESCE(fp.display_name, fl_prof.full_name, 'Freelancer')::text AS freelancer_name,
      fl_prof.avatar_url::text AS freelancer_avatar,
      CASE 
        WHEN fr.status IN ('accepted', 'in_progress', 'delivered', 'completed') THEN fl_u.email::text
        ELSE NULL::text
      END AS freelancer_email
    FROM public.freelance_requests fr
    JOIN public.providers p ON p.id = fr.freelancer_provider_id
    LEFT JOIN public.freelancer_profiles fp ON fp.provider_id = p.id
    LEFT JOIN public.profiles buyer_prof ON buyer_prof.id = fr.buyer_user_id
    LEFT JOIN auth.users buyer_u ON buyer_u.id = fr.buyer_user_id
    LEFT JOIN public.profiles fl_prof ON fl_prof.id = p.user_id
    LEFT JOIN auth.users fl_u ON fl_u.id = p.user_id
    WHERE p.user_id = p_user_id
    ORDER BY fr.created_at DESC;
  END IF;
END;
$$;
