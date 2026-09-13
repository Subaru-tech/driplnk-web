-- Migration: 20260913000000_security_hardening_price_integrity.sql
-- Purpose: Fix several security & correctness defects found in audit:
--   1. get_mart_vendor_quotes hard-coded price (weight_g * 4.5) ignored each
--      vendor's real pricing rules — restore rule-based pricing.
--   2. create_mart_order trusted the client-supplied price — recompute the
--      price server-side from the vendor's pricing rules so a tampered client
--      cannot buy a ₹5,000 print for ₹50.
--   3. model_events.event_type CHECK rejects the event types the application
--      actually writes ('draft_saved', 'submitted_for_review', 'published').
--   4. fn_notify_vendor_on_mart_order posted to the Edge Function with no
--      Authorization header — deployments that verify the service JWT
--      (Supabase default for non-public functions) silently never notified.
--   5. mart_orders updated_at was never maintained outside explicit writes.

-- ============================================================================
-- 1. get_mart_vendor_quotes: real pricing rules again
--    (migration 20260912100000 replaced rule-based pricing with a flat
--    weight*4.5 constant, silently discarding vendor_pricing_rules)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_mart_vendor_quotes(numeric, text);

CREATE OR REPLACE FUNCTION public.get_mart_vendor_quotes(
  p_weight_g numeric,
  p_material text
)
RETURNS TABLE (
  provider_id uuid,
  business_name text,
  location text,
  price numeric,
  material text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS provider_id,
    vp.business_name,
    vp.location,
    ROUND(GREATEST(vpr.min_order_price, p_weight_g * vpr.price_per_gram), 2) AS price,
    vpr.material
  FROM public.providers p
  JOIN public.vendor_profiles vp ON vp.provider_id = p.id
  JOIN public.vendor_pricing_rules vpr ON vpr.provider_id = p.id
  WHERE p.type = 'vendor'
    AND p.status = 'approved'
    AND vp.status = 'approved'
    AND vpr.active = true
    AND LOWER(vpr.material) = LOWER(p_material)
  ORDER BY price ASC, vp.business_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mart_vendor_quotes(numeric, text) TO anon, authenticated, service_role;

-- ============================================================================
-- 2. create_mart_order: price comes from the vendor's rules, not the client
--    The previous signature accepted p_price; callers that pass a price will
--    now fail loudly instead of silently ordering at an attacker-chosen price.
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_mart_order(uuid, uuid, uuid, text, numeric);

CREATE OR REPLACE FUNCTION public.create_mart_order(
  p_buyer_user_id uuid,
  p_quote_request_id uuid,
  p_provider_id uuid,
  p_material text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_provider public.providers%ROWTYPE;
  v_vendor_profile public.vendor_profiles%ROWTYPE;
  v_quote public.quote_requests%ROWTYPE;
  v_pricing public.vendor_pricing_rules%ROWTYPE;
  v_price numeric;
  v_order_id uuid;
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

  -- PRICE INTEGRITY: compute from the vendor's active pricing rule for the
  -- ordered material. No client-supplied price is trusted. A missing rule is
  -- a hard failure — falling back to any number here would let an order be
  -- placed at an unintended price.
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

  INSERT INTO public.mart_orders (
    quote_request_id,
    buyer_user_id,
    provider_id,
    price,
    material,
    status
  ) VALUES (
    p_quote_request_id,
    p_buyer_user_id,
    p_provider_id,
    v_price,
    LOWER(p_material),
    'pending_vendor_response'
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_mart_order(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mart_order(uuid, uuid, uuid, text) TO service_role;

-- ============================================================================
-- 3. model_events: accept the event types the app writes
--    syncModelChildren() writes 'draft_saved', 'submitted_for_review' and
--    'published' — all three violated the CHECK constraint, so those inserts
--    failed silently inside try/catch.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'model_events_event_type_check'
      AND conrelid = 'public.model_events'::regclass
  ) THEN
    ALTER TABLE public.model_events DROP CONSTRAINT model_events_event_type_check;
  END IF;
END $$;

ALTER TABLE public.model_events
  ADD CONSTRAINT model_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'view'::text,
    'download'::text,
    'acquired'::text,
    'favorite'::text,
    'draft_saved'::text,
    'submitted_for_review'::text,
    'published'::text
  ]));

-- ============================================================================
-- 4. Vendor notification trigger: authenticate to the Edge Function
--    The function URL is not public by default; pg_net previously sent no
--    Authorization header, so calls could 401 and notifications never fired.
--
--    The service key is read from Supabase Vault (secret name:
--    'service_role_key'). One-time operator setup — run in the SQL editor:
--        select vault.create_secret('<service_role key>', 'service_role_key');
--    Vault is used instead of a plain database setting because custom GUCs
--    are readable by every session in the database; decrypted_secrets is
--    restricted to table owner + service role.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_vendor_on_mart_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, auth, pg_temp
AS $$
DECLARE
  v_vendor_name text;
  v_vendor_phone text;
  v_vendor_email text;
  v_payload jsonb;
  v_service_key text;
BEGIN
  -- Latest secret under this name (re-creating the secret supersedes older
  -- ones without touching this function).
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  ORDER BY created_at DESC
  LIMIT 1;
  SELECT
    vp.business_name,
    COALESCE(u.phone, u.raw_user_meta_data->>'phone', null),
    COALESCE(u.email, prof.full_name)
  INTO v_vendor_name, v_vendor_phone, v_vendor_email
  FROM public.providers pr
  JOIN public.vendor_profiles vp ON vp.provider_id = pr.id
  LEFT JOIN public.profiles prof ON prof.id = pr.user_id
  LEFT JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.id = NEW.provider_id;

  v_payload := jsonb_build_object(
    'order_id', NEW.id,
    'provider_id', NEW.provider_id,
    'buyer_user_id', NEW.buyer_user_id,
    'price', NEW.price,
    'material', NEW.material,
    'status', NEW.status,
    'vendor_name', COALESCE(v_vendor_name, 'Print Vendor'),
    'vendor_phone', v_vendor_phone,
    'vendor_email', v_vendor_email,
    'created_at', NEW.created_at
  );

  -- COALESCE keeps a missing secret from turning the header (and therefore
  -- the ORDER INSERT, which fires this trigger) into a hard failure — the
  -- notification is best-effort, the transaction is not.
  PERFORM net.http_post(
    url := 'https://vjlsuadvxjmxrwnqytmu.supabase.co/functions/v1/vendor-order-notification'::text,
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
    )
  );

  RETURN NEW;
END;
$$;

-- The trigger itself already exists (migration 20260912110000) and fires on
-- the same table/columns; re-creating the function is enough.

-- ============================================================================
-- 5. keep mart_orders.updated_at honest
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_mart_order_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mart_orders_touch_updated_at ON public.mart_orders;
CREATE TRIGGER trg_mart_orders_touch_updated_at
BEFORE UPDATE ON public.mart_orders
FOR EACH ROW
EXECUTE FUNCTION public.touch_mart_order_updated_at();
