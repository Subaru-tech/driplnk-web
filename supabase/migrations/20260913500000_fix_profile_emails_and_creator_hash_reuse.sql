-- ==============================================================================
-- Migration: 20260913500000_fix_profile_emails_and_creator_hash_reuse.sql
-- Description: 
--   1. Add real email column to public.profiles and update sync_clerk_user_profile
--   2. Update notification triggers to pull real synced profile email, never @clerk.internal
--   3. Convert global SHA-256 unique index into cross-creator duplicate rejection trigger
--      (allows same creator to reuse their own STL across listings/kits)
--   4. Backfill real email addresses for active providers
-- ==============================================================================

-- 1. Add email column to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 2. Update sync_clerk_user_profile RPC to store real email
CREATE OR REPLACE FUNCTION public.sync_clerk_user_profile(
  p_clerk_id text,
  p_full_name text DEFAULT 'Creator'::text,
  p_avatar_url text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text
)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_effective_email text;
BEGIN
  v_effective_email := NULLIF(TRIM(p_email), '');

  -- Try to find existing profile by clerk_id
  SELECT * INTO v_profile FROM public.profiles WHERE clerk_id = p_clerk_id LIMIT 1;
  
  IF FOUND THEN
    -- Update email/name if provided
    UPDATE public.profiles
    SET 
      full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      email = COALESCE(v_effective_email, email),
      updated_at = now()
    WHERE id = v_profile.id
    RETURNING * INTO v_profile;

    -- Ensure shadow auth.users entry exists with real email (fallback to internal ID only if unset)
    BEGIN
      INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
      VALUES (
        v_profile.id,
        'authenticated',
        'authenticated',
        COALESCE(v_effective_email, p_clerk_id || '@clerk.internal'),
        '',
        now(),
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET 
        email = COALESCE(v_effective_email, auth.users.email),
        updated_at = now();
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;

    RETURN NEXT v_profile;
    RETURN;
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (
    id,
    clerk_id,
    full_name,
    avatar_url,
    email,
    role,
    credits_balance
  ) VALUES (
    gen_random_uuid(),
    p_clerk_id,
    COALESCE(NULLIF(TRIM(p_full_name), ''), 'Creator'),
    p_avatar_url,
    v_effective_email,
    'creator',
    0
  )
  RETURNING * INTO v_profile;

  -- Ensure shadow auth.users entry exists
  BEGIN
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      v_profile.id,
      'authenticated',
      'authenticated',
      COALESCE(v_effective_email, p_clerk_id || '@clerk.internal'),
      '',
      now(),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = COALESCE(v_effective_email, auth.users.email),
      updated_at = now();
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN NEXT v_profile;
  RETURN;
END;
$function$;

-- 3. Backfill real email addresses on public.profiles
UPDATE public.profiles
SET email = 'ramani.zero2@gmail.com'
WHERE id = '3345ed81-f953-4bff-b1f5-f32aca16fbff';

UPDATE public.profiles
SET email = 'atharvaramani350@gmail.com'
WHERE id = '44bf8558-2208-43c1-a032-a0bfc857afe2';

UPDATE public.profiles
SET email = 'rakshitshanbhag.22@gmail.com'
WHERE id = '13f5c142-d6a4-4b67-b151-9286ab852e9a';

UPDATE public.profiles
SET email = 'ramani.zero2@gmail.com'
WHERE id = 'e06bf8c3-6a8f-4724-9acc-d9c4e1b24506';

UPDATE public.profiles
SET email = 'atharvaramani350@gmail.com'
WHERE id = '4731bf91-6b5e-447a-b408-64a53ec9a3fd';

-- 4. Update notification triggers: Source email from profiles.email, never clerk.internal
CREATE OR REPLACE FUNCTION public.fn_notify_mart_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, auth, pg_temp
AS $$
DECLARE
  v_vendor_name text;
  v_vendor_phone text;
  v_vendor_email text;
  v_buyer_name text;
  v_buyer_email text;
  v_payload jsonb;
  v_service_key text;
BEGIN
  -- Read service role key if configured in settings (fallback to default)
  BEGIN
    v_service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_service_key := '';
  END;
  IF v_service_key IS NULL OR v_service_key = '' THEN
    BEGIN
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key'
      ORDER BY created_at DESC
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_service_key := '';
    END;
  END IF;

  -- Lookup vendor details: Priority on prof.email, never allow @clerk.internal
  SELECT 
    COALESCE(vp.business_name, prof.full_name, 'Print Hub'),
    COALESCE(u.phone, u.raw_user_meta_data->>'phone', null),
    COALESCE(
      NULLIF(prof.email, ''),
      CASE WHEN u.email NOT LIKE '%@clerk.internal' THEN u.email ELSE NULL END,
      'vendor@driplnk.in'
    )
  INTO v_vendor_name, v_vendor_phone, v_vendor_email
  FROM public.providers pr
  LEFT JOIN public.vendor_profiles vp ON vp.provider_id = pr.id
  LEFT JOIN public.profiles prof ON prof.id = pr.user_id
  LEFT JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.id = NEW.provider_id;

  -- Lookup buyer details: Priority on prof.email, never allow @clerk.internal
  SELECT 
    COALESCE(prof.full_name, 'Customer'),
    COALESCE(
      NULLIF(prof.email, ''),
      CASE WHEN u.email NOT LIKE '%@clerk.internal' THEN u.email ELSE NULL END,
      'buyer@driplnk.in'
    )
  INTO v_buyer_name, v_buyer_email
  FROM public.profiles prof
  FULL JOIN auth.users u ON u.id = prof.id
  WHERE COALESCE(prof.id, u.id) = NEW.buyer_user_id;

  -- Case A: INSERT - New mart order placed (status = 'pending_vendor_response')
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.status = 'pending_vendor_response') THEN
      v_payload := jsonb_build_object(
        'event_type', 'mart_order_created',
        'order_id', NEW.id,
        'provider_id', NEW.provider_id,
        'buyer_user_id', NEW.buyer_user_id,
        'recipient_email', v_vendor_email,
        'recipient_name', v_vendor_name,
        'recipient_phone', v_vendor_phone,
        'vendor_name', v_vendor_name,
        'vendor_email', v_vendor_email,
        'vendor_phone', v_vendor_phone,
        'buyer_name', v_buyer_name,
        'price', NEW.price,
        'material', NEW.material,
        'status', NEW.status,
        'created_at', NEW.created_at
      );

      PERFORM net.http_post(
        url := 'https://vjlsuadvxjmxrwnqytmu.supabase.co/functions/v1/vendor-order-notification'::text,
        body := v_payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Case B: UPDATE - Status transitions or vendor reassignment
  IF (TG_OP = 'UPDATE') THEN
    -- Check for SLA vendor reassignment (same order reassigned to next vendor)
    IF (NEW.status = 'pending_vendor_response' AND NEW.provider_id IS DISTINCT FROM OLD.provider_id) THEN
      -- 1. Notify new vendor of new order
      v_payload := jsonb_build_object(
        'event_type', 'mart_order_created',
        'order_id', NEW.id,
        'provider_id', NEW.provider_id,
        'buyer_user_id', NEW.buyer_user_id,
        'recipient_email', v_vendor_email,
        'recipient_name', v_vendor_name,
        'recipient_phone', v_vendor_phone,
        'vendor_name', v_vendor_name,
        'vendor_email', v_vendor_email,
        'vendor_phone', v_vendor_phone,
        'buyer_name', v_buyer_name,
        'price', NEW.price,
        'material', NEW.material,
        'status', NEW.status,
        'created_at', NEW.created_at
      );

      PERFORM net.http_post(
        url := 'https://vjlsuadvxjmxrwnqytmu.supabase.co/functions/v1/vendor-order-notification'::text,
        body := v_payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        )
      );

      -- 2. Notify buyer of vendor reassignment
      v_payload := jsonb_build_object(
        'event_type', 'mart_order_reassigned',
        'order_id', NEW.id,
        'provider_id', NEW.provider_id,
        'buyer_user_id', NEW.buyer_user_id,
        'recipient_email', v_buyer_email,
        'recipient_name', v_buyer_name,
        'vendor_name', v_vendor_name,
        'vendor_email', v_vendor_email,
        'price', NEW.price,
        'material', NEW.material,
        'status', NEW.status,
        'created_at', now()
      );

      PERFORM net.http_post(
        url := 'https://vjlsuadvxjmxrwnqytmu.supabase.co/functions/v1/vendor-order-notification'::text,
        body := v_payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        )
      );
      RETURN NEW;
    END IF;

    -- Standard status changes (accepted, cancelled, printing, shipped, delivered, expired)
    IF (NEW.status IS DISTINCT FROM OLD.status) THEN
      v_payload := jsonb_build_object(
        'event_type', 'mart_order_status_updated',
        'order_id', NEW.id,
        'provider_id', NEW.provider_id,
        'buyer_user_id', NEW.buyer_user_id,
        'recipient_email', v_buyer_email,
        'recipient_name', v_buyer_name,
        'vendor_name', v_vendor_name,
        'vendor_email', v_vendor_email,
        'price', NEW.price,
        'material', NEW.material,
        'status', NEW.status,
        'previous_status', OLD.status,
        'created_at', now()
      );

      PERFORM net.http_post(
        url := 'https://vjlsuadvxjmxrwnqytmu.supabase.co/functions/v1/vendor-order-notification'::text,
        body := v_payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


-- 5. Update freelance notification trigger: Source email from profiles.email
CREATE OR REPLACE FUNCTION public.fn_notify_freelance_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, auth, pg_temp
AS $$
DECLARE
  v_freelancer_name text;
  v_freelancer_email text;
  v_client_name text;
  v_client_email text;
  v_payload jsonb;
  v_service_key text;
BEGIN
  BEGIN
    v_service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_service_key := '';
  END;
  IF v_service_key IS NULL OR v_service_key = '' THEN
    BEGIN
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key'
      ORDER BY created_at DESC
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_service_key := '';
    END;
  END IF;

  -- Lookup freelancer details: Priority on prof.email, never allow @clerk.internal
  SELECT 
    COALESCE(fp.display_name, prof.full_name, 'Specialist'),
    COALESCE(
      NULLIF(prof.email, ''),
      CASE WHEN u.email NOT LIKE '%@clerk.internal' THEN u.email ELSE NULL END,
      'freelancer@driplnk.in'
    )
  INTO v_freelancer_name, v_freelancer_email
  FROM public.providers pr
  LEFT JOIN public.freelancer_profiles fp ON fp.provider_id = pr.id
  LEFT JOIN public.profiles prof ON prof.id = pr.user_id
  LEFT JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.id = NEW.freelancer_provider_id;

  -- Lookup client (buyer) details: Priority on prof.email, never allow @clerk.internal
  SELECT 
    COALESCE(prof.full_name, 'Client'),
    COALESCE(
      NULLIF(prof.email, ''),
      CASE WHEN u.email NOT LIKE '%@clerk.internal' THEN u.email ELSE NULL END,
      'client@driplnk.in'
    )
  INTO v_client_name, v_client_email
  FROM public.profiles prof
  FULL JOIN auth.users u ON u.id = prof.id
  WHERE COALESCE(prof.id, u.id) = NEW.buyer_user_id;

  -- Case A: INSERT - New freelance request submitted
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.status = 'requested') THEN
      v_payload := jsonb_build_object(
        'event_type', 'freelance_request_created',
        'request_id', NEW.id,
        'order_id', NEW.id,
        'provider_id', NEW.freelancer_provider_id,
        'client_user_id', NEW.buyer_user_id,
        'recipient_email', v_freelancer_email,
        'recipient_name', v_freelancer_name,
        'client_name', v_client_name,
        'vendor_name', v_freelancer_name,
        'vendor_email', v_freelancer_email,
        'brief', NEW.brief,
        'material', 'cad_design',
        'price', NEW.agreed_price,
        'agreed_price', NEW.agreed_price,
        'status', NEW.status,
        'created_at', NEW.created_at
      );

      PERFORM net.http_post(
        url := 'https://vjlsuadvxjmxrwnqytmu.supabase.co/functions/v1/vendor-order-notification'::text,
        body := v_payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Case B: UPDATE OF status (accepted, cancelled, in_progress, delivered, completed)
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.status IS DISTINCT FROM OLD.status) THEN
      v_payload := jsonb_build_object(
        'event_type', 'freelance_request_status_updated',
        'request_id', NEW.id,
        'order_id', NEW.id,
        'provider_id', NEW.freelancer_provider_id,
        'client_user_id', NEW.buyer_user_id,
        'recipient_email', v_client_email,
        'recipient_name', v_client_name,
        'client_name', v_client_name,
        'freelancer_name', v_freelancer_name,
        'vendor_name', v_freelancer_name,
        'vendor_email', v_freelancer_email,
        'brief', NEW.brief,
        'material', 'cad_design',
        'price', NEW.agreed_price,
        'agreed_price', NEW.agreed_price,
        'status', NEW.status,
        'previous_status', OLD.status,
        'created_at', now()
      );

      PERFORM net.http_post(
        url := 'https://vjlsuadvxjmxrwnqytmu.supabase.co/functions/v1/vendor-order-notification'::text,
        body := v_payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


-- 6. SHA-256 Multi-Listing Creator Reuse
-- Drop global unconditional unique index and replace with cross-creator check trigger
DROP INDEX IF EXISTS public.idx_models_file_sha256;

CREATE INDEX IF NOT EXISTS idx_models_file_sha256
  ON public.models (file_sha256)
  WHERE file_sha256 IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_check_model_file_sha256_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.file_sha256 IS NOT NULL THEN
    -- Check if ANOTHER creator has already published a model with this exact hash
    IF EXISTS (
      SELECT 1 FROM public.models
      WHERE file_sha256 = NEW.file_sha256
        AND owner_id IS DISTINCT FROM NEW.owner_id
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'This file is already published on Driplnk by another creator.' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_models_check_sha256_owner ON public.models;
CREATE TRIGGER trg_models_check_sha256_owner
BEFORE INSERT OR UPDATE OF file_sha256, owner_id ON public.models
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_model_file_sha256_owner();
