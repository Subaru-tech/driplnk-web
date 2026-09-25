-- ==============================================================================
-- Migration: 20260913600000_mart_order_weapon_moderation_gate.sql
-- Description: 
--   1. Add moderation_status and moderation_flags to public.mart_orders
--   2. Add 'pending_moderation' to mart_orders.status check constraint
--   3. Update create_mart_order RPC with weapon moderation gate
--   4. Update fn_notify_mart_order_event trigger so pending_moderation orders
--      are held and NEVER auto-dispatched to vendors until admin clearance
--   5. Add admin_moderate_mart_order RPC for admin clearance / rejection
-- ==============================================================================

-- 1. Add moderation columns to mart_orders
ALTER TABLE public.mart_orders
  ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS moderation_flags jsonb DEFAULT '{}'::jsonb;

-- 2. Update status constraint to include 'pending_moderation'
ALTER TABLE public.mart_orders
  DROP CONSTRAINT IF EXISTS mart_orders_status_check;

ALTER TABLE public.mart_orders
  ADD CONSTRAINT mart_orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending_moderation'::text,
    'pending_vendor_response'::text,
    'placed'::text,
    'accepted'::text,
    'printing'::text,
    'shipped'::text,
    'delivered'::text,
    'completed'::text,
    'cancelled'::text,
    'expired_no_vendor_response'::text
  ]));

-- 3. Moderation status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mart_orders_moderation_status_check'
  ) THEN
    ALTER TABLE public.mart_orders
      ADD CONSTRAINT mart_orders_moderation_status_check
      CHECK (moderation_status IS NULL OR moderation_status IN ('weapon_review', 'duplicate_review', 'cleared', 'rejected'));
  END IF;
END $$;

-- 4. Indices for moderation querying
CREATE INDEX IF NOT EXISTS idx_mart_orders_moderation_status
  ON public.mart_orders (moderation_status)
  WHERE moderation_status IS NOT NULL;

-- 5. Hardened RPC: create_mart_order with weapon gate
CREATE OR REPLACE FUNCTION public.create_mart_order(
  p_buyer_user_id uuid,
  p_quote_request_id uuid,
  p_provider_id uuid,
  p_material text,
  p_moderation_status text DEFAULT NULL,
  p_moderation_flags jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_provider public.providers%ROWTYPE;
  v_vendor_profile public.vendor_profiles%ROWTYPE;
  v_quote public.quote_requests%ROWTYPE;
  v_pricing public.vendor_pricing_rules%ROWTYPE;
  v_price numeric;
  v_order_id uuid;
  v_clean_path text;
  v_is_flagged boolean := false;
  v_initial_status text;
  v_mod_status text;
  v_mod_flags jsonb;
BEGIN
  -- Verify provider is an approved vendor (provider + profile gates)
  SELECT * INTO v_provider FROM public.providers WHERE id = p_provider_id AND type = 'vendor';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor provider not found';
  END IF;

  IF v_provider.status <> 'approved' THEN
    RAISE EXCEPTION 'Cannot place order with unapproved vendor (provider status: %)', v_provider.status;
  END IF;

  SELECT * INTO v_vendor_profile FROM public.vendor_profiles WHERE provider_id = p_provider_id;
  IF NOT FOUND OR v_vendor_profile.status <> 'approved' THEN
    RAISE EXCEPTION 'Cannot place order with unapproved vendor (profile status: %)', COALESCE(v_vendor_profile.status, 'none');
  END IF;

  IF v_provider.user_id = p_buyer_user_id THEN
    RAISE EXCEPTION 'You cannot order from your own print hub';
  END IF;

  -- Verify quote request exists and belongs to buyer
  SELECT * INTO v_quote FROM public.quote_requests
  WHERE id = p_quote_request_id AND user_id = p_buyer_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid quote request';
  END IF;

  -- PRICE INTEGRITY: compute from the vendor's active pricing rule for the ordered material
  SELECT * INTO v_pricing
  FROM public.vendor_pricing_rules
  WHERE provider_id = p_provider_id
    AND active = true
    AND LOWER(material) = LOWER(p_material)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor does not offer material: %', p_material;
  END IF;

  v_price := ROUND(
    GREATEST(
      v_pricing.min_order_price,
      COALESCE(v_quote.weight_g, 0) * v_pricing.price_per_gram
    ),
    2
  );

  -- WEAPON MODERATION CHECK ON DIRECT-PRINT FILE:
  -- Check caller-supplied moderation status OR run server-side regex on quote file path
  IF p_moderation_status = 'weapon_review' THEN
    v_is_flagged := true;
  ELSE
    v_clean_path := LOWER(REPLACE(REPLACE(REPLACE(COALESCE(v_quote.file_path, ''), '_', ' '), '-', ' '), '.', ' '));
    IF v_clean_path ~* '\y(lower receiver|upper receiver|firearm|handgun|pistol|revolver|rifle|shotgun|carbine|machine gun|ghost gun|zip gun|ar-15|ar15|ar-10|ar10|m4a1|glock|sig sauer|ak-47|ak47|colt 1911|1911 pistol|p80|poly80|polymer80|fmg-9|fmg9|fgc-9|fgc9|gun barrel|threaded barrel|silencer|suppressor|solvent trap|flash hider|muzzle brake|auto sear|drop in auto sear|dias|firing pin|bolt carrier|bcg|firearm hammer|drum mag|glock switch|full auto|forced reset trigger|frt|bump stock|super safety|grenade|claymore|landmine|pipe bomb)\y' THEN
      v_is_flagged := true;
    END IF;
  END IF;

  IF v_is_flagged THEN
    -- Order is HELD for mandatory human review; DO NOT auto-dispatch to vendor!
    v_initial_status := 'pending_moderation';
    v_mod_status := 'weapon_review';
    v_mod_flags := jsonb_build_object(
      'weapon_match', true,
      'flagged_at', now(),
      'file_path', v_quote.file_path,
      'details', COALESCE(p_moderation_flags->>'details', 'Flagged during direct-print quote analysis')
    );
  ELSE
    v_initial_status := 'pending_vendor_response';
    v_mod_status := NULL;
    v_mod_flags := '{}'::jsonb;
  END IF;

  INSERT INTO public.mart_orders (
    quote_request_id,
    buyer_user_id,
    provider_id,
    price,
    material,
    status,
    moderation_status,
    moderation_flags
  ) VALUES (
    p_quote_request_id,
    p_buyer_user_id,
    p_provider_id,
    v_price,
    LOWER(p_material),
    v_initial_status,
    v_mod_status,
    v_mod_flags
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_mart_order(uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mart_order(uuid, uuid, uuid, text, text, jsonb) TO service_role;


-- 6. Update notification trigger: Never dispatch pending_moderation orders to vendors
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

  -- Case A: INSERT - Only dispatch if status = 'pending_vendor_response'.
  -- If status = 'pending_moderation', DO NOT DISPATCH TO VENDOR!
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
    -- 1. Check for Admin Clearance: Transitioning from pending_moderation -> pending_vendor_response
    IF (OLD.status = 'pending_moderation' AND NEW.status = 'pending_vendor_response') THEN
      -- Dispatch to vendor now that human admin has cleared the direct-print order
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

    -- 2. Check for SLA vendor reassignment (same order reassigned to next vendor)
    IF (NEW.status = 'pending_vendor_response' AND NEW.provider_id IS DISTINCT FROM OLD.provider_id) THEN
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

      -- Notify buyer of vendor reassignment
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

    -- 3. Standard status changes (accepted, cancelled, printing, shipped, delivered, expired)
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

-- 7. Admin clearance / rejection RPC for held Mart orders
CREATE OR REPLACE FUNCTION public.admin_moderate_mart_order(
  p_order_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_order public.mart_orders%ROWTYPE;
BEGIN
  IF p_action NOT IN ('clear', 'reject') THEN
    RAISE EXCEPTION 'Invalid moderation action: %. Allowed: clear, reject', p_action;
  END IF;

  SELECT * INTO v_order FROM public.mart_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF p_action = 'clear' THEN
    -- Clear moderation status and transition to pending_vendor_response to begin vendor SLA window
    UPDATE public.mart_orders
    SET 
      status = 'pending_vendor_response',
      moderation_status = 'cleared',
      moderation_flags = moderation_flags || jsonb_build_object('cleared_at', now(), 'admin_notes', p_notes),
      updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'status', 'pending_vendor_response', 'action', 'cleared');
  ELSE
    -- Cancel order permanently due to prohibited content
    UPDATE public.mart_orders
    SET 
      status = 'cancelled',
      moderation_status = 'rejected',
      moderation_flags = moderation_flags || jsonb_build_object('rejected_at', now(), 'admin_notes', p_notes),
      updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'status', 'cancelled', 'action', 'rejected');
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_moderate_mart_order(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_mart_order(uuid, text, text) TO service_role;
