-- Migration: 20260913220000_phase7_security_sweep.sql
-- Phase 7 pre-launch security sweep.
-- Addresses three open items from the prior audit:
--
--   (a) RATE LIMITING — vendor/freelancer applications and the waitlist had
--       no per-IP or per-account volume limit. Contact had a 1-hour/email
--       trigger but waitlist did not. Vendor and freelancer application tables
--       are written via service-role RPCs, so the limit is enforced there
--       via a SECURITY DEFINER gate function, not a trigger the client can
--       bypass. Waitlist gets the same pattern as contact_messages.
--
--   (b) ERROR RESPONSE HYGIENE — nothing in this migration; handled in
--       application code (upload.ts, vendor.ts, freelance.ts).
--
--   (c) B2 CORS — updated via the Backblaze API (not a SQL migration);
--       documented in the Phase 7 audit report.
--
-- All changes are additive or replace existing functions / policies only.

-- ============================================================================
-- 1. Waitlist rate limit trigger (same pattern as contact_messages)
-- ============================================================================
-- One waitlist sign-up per email per 24 hours to prevent email harvesting
-- abuse and unlimited PII insertion through the anon key.

CREATE OR REPLACE FUNCTION public.enforce_waitlist_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.waitlist
    WHERE email = NEW.email
      AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'This email has already been submitted recently. Please try again later.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_waitlist_rate_limit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_waitlist_rate_limit() TO service_role;

DROP TRIGGER IF EXISTS trg_waitlist_rate_limit ON public.waitlist;
CREATE TRIGGER trg_waitlist_rate_limit
BEFORE INSERT ON public.waitlist
FOR EACH ROW
EXECUTE FUNCTION public.enforce_waitlist_rate_limit();

-- ============================================================================
-- 2. Application submission rate limit (vendor + freelancer)
--    Per authenticated user: max 3 applications in 24 hours.
--    The RPCs apply_vendor_profile and register_freelancer_profile both go
--    through the service role; we add a SECURITY DEFINER gate function they
--    must call, rather than a trigger that a client could bypass by calling
--    the RPC directly.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_application_rate_limit(p_user_id uuid, p_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.providers
  WHERE user_id = p_user_id
    AND type = p_type
    AND created_at > now() - interval '24 hours';

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Too many % applications submitted recently. Please wait 24 hours.', p_type;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.check_application_rate_limit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_application_rate_limit(uuid, text) TO service_role;

-- ============================================================================
-- 3. Quote request (mart STL parsing) rate limit
--    Per user: max 20 quote requests in 1 hour to prevent CPU/storage abuse.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_quote_rate_limit(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.quote_requests
  WHERE user_id = p_user_id
    AND created_at > now() - interval '1 hour';

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'Too many quote requests. Please wait before submitting another.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.check_quote_rate_limit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_quote_rate_limit(uuid) TO service_role;

-- Trigger on quote_requests so it fires regardless of call path (direct insert
-- via service role or RPC). Uses a BEFORE INSERT trigger; the service-role
-- client is the only path that can insert here (no client-facing INSERT policy
-- exists), but defense-in-depth at the row level is correct.
CREATE OR REPLACE FUNCTION public.enforce_quote_rate_limit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.quote_requests
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'Quote rate limit exceeded. Please wait before submitting another model.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_quote_rate_limit_trigger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_quote_rate_limit_trigger() TO service_role;

DROP TRIGGER IF EXISTS trg_quote_rate_limit ON public.quote_requests;
CREATE TRIGGER trg_quote_rate_limit
BEFORE INSERT ON public.quote_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_quote_rate_limit_trigger();
