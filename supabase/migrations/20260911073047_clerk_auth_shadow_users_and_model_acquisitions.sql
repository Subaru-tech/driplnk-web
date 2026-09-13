-- Migration: 20260911073047_clerk_auth_shadow_users_and_model_acquisitions
-- Purpose: Formalize Clerk-Supabase bridge, shadow auth.users syncing, models catalog extensions, and model acquisitions.

-- 1. Ensure clerk_id on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'clerk_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN clerk_id text UNIQUE;
  END IF;
END $$;

-- 2. Ensure marketplace extensions on public.models
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'seller_user_id') THEN
    ALTER TABLE public.models ADD COLUMN seller_user_id uuid REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'title') THEN
    ALTER TABLE public.models ADD COLUMN title text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'description') THEN
    ALTER TABLE public.models ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'category') THEN
    ALTER TABLE public.models ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'license_type') THEN
    ALTER TABLE public.models ADD COLUMN license_type text NOT NULL DEFAULT 'standard';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'price') THEN
    ALTER TABLE public.models ADD COLUMN price numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'preview_image_paths') THEN
    ALTER TABLE public.models ADD COLUMN preview_image_paths text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'file_path') THEN
    ALTER TABLE public.models ADD COLUMN file_path text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'models' AND column_name = 'status') THEN
    ALTER TABLE public.models ADD COLUMN status text DEFAULT 'published';
  END IF;
END $$;

-- 3. Model acquisitions table
CREATE TABLE IF NOT EXISTS public.model_acquisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  license_type text NOT NULL DEFAULT 'standard',
  acquired_at timestamptz DEFAULT now(),
  CONSTRAINT model_acquisitions_user_model_unique UNIQUE (user_id, model_id)
);

ALTER TABLE public.model_acquisitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_acquisitions' AND policyname = 'model_acquisitions: user select own') THEN
    CREATE POLICY "model_acquisitions: user select own" ON public.model_acquisitions
      FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_acquisitions' AND policyname = 'model_acquisitions: user insert own') THEN
    CREATE POLICY "model_acquisitions: user insert own" ON public.model_acquisitions
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 4. Sync Clerk Profile + Shadow auth.users
CREATE OR REPLACE FUNCTION public.sync_clerk_user_profile(
  p_clerk_id text,
  p_full_name text DEFAULT 'Creator',
  p_avatar_url text DEFAULT NULL
)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  -- Try to find existing profile by clerk_id
  SELECT * INTO v_profile FROM public.profiles WHERE clerk_id = p_clerk_id LIMIT 1;
  
  IF FOUND THEN
    -- Ensure shadow auth.users entry exists with matching UUID
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      v_profile.id,
      'authenticated',
      'authenticated',
      p_clerk_id || '@clerk.internal',
      '',
      now(),
      now(),
      now()
    ) ON CONFLICT (id) DO NOTHING;

    RETURN NEXT v_profile;
    RETURN;
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (
    id,
    clerk_id,
    full_name,
    avatar_url,
    role,
    credits_balance
  ) VALUES (
    gen_random_uuid(),
    p_clerk_id,
    COALESCE(NULLIF(TRIM(p_full_name), ''), 'Creator'),
    p_avatar_url,
    'creator',
    0
  )
  RETURNING * INTO v_profile;

  -- Ensure shadow auth.users entry exists
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    v_profile.id,
    'authenticated',
    'authenticated',
    p_clerk_id || '@clerk.internal',
    '',
    now(),
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;

  RETURN NEXT v_profile;
  RETURN;
END;
$$;

-- 5. Atomic Claim Function
CREATE OR REPLACE FUNCTION public.claim_model_acquisition(
  p_user_id uuid,
  p_model_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_model public.models%ROWTYPE;
  v_acquisition_id uuid;
BEGIN
  SELECT * INTO v_model FROM public.models WHERE id = p_model_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Model not found.');
  END IF;

  IF v_model.status <> 'published' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This model is not available for acquisition.');
  END IF;

  IF COALESCE(v_model.price, 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paid models cannot be claimed directly. Payment processing is coming soon.');
  END IF;

  SELECT id INTO v_acquisition_id 
  FROM public.model_acquisitions 
  WHERE user_id = p_user_id AND model_id = p_model_id;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_acquired', true, 'message', 'This model is already in your library.');
  END IF;

  BEGIN
    INSERT INTO public.model_acquisitions (user_id, model_id, license_type)
    VALUES (p_user_id, p_model_id, COALESCE(v_model.license_type, 'standard'))
    RETURNING id INTO v_acquisition_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_acquired', true, 'message', 'This model is already in your library.');
  END;

  RETURN jsonb_build_object('success', true, 'acquisition_id', v_acquisition_id);
END;
$$;

-- 6. Get User Model Acquisitions
CREATE OR REPLACE FUNCTION public.get_user_model_acquisitions(
  p_user_id uuid
)
RETURNS TABLE (
  acquisition_id uuid,
  acquired_at timestamptz,
  license_type text,
  model_id uuid,
  title text,
  description text,
  category text,
  price numeric,
  preview_image_paths text[],
  file_path text,
  seller_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ma.id AS acquisition_id,
    ma.acquired_at,
    ma.license_type,
    m.id AS model_id,
    COALESCE(m.title, m.name) AS title,
    m.description,
    m.category,
    m.price,
    m.preview_image_paths,
    COALESCE(m.file_path, m.storage_path) AS file_path,
    COALESCE(p.full_name, 'DripLnk Creator') AS seller_name
  FROM public.model_acquisitions ma
  JOIN public.models m ON m.id = ma.model_id
  LEFT JOIN public.profiles p ON p.id = m.seller_user_id
  WHERE ma.user_id = p_user_id
  ORDER BY ma.acquired_at DESC;
END;
$$;

-- 7. Access check for model files
CREATE OR REPLACE FUNCTION public.can_user_access_model_file(
  p_user_id uuid,
  p_model_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.model_acquisitions
    WHERE user_id = p_user_id AND model_id = p_model_id
  ) OR EXISTS (
    SELECT 1 FROM public.models
    WHERE id = p_model_id AND (seller_user_id = p_user_id OR owner_id = p_user_id)
  );
END;
$$;
