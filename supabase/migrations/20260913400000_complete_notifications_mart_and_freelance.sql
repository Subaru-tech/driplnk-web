-- ==============================================================================
-- Migration: 20260913400000_complete_notifications_mart_and_freelance.sql
-- Description: Complete notification coverage for Mart orders and Freelance
--              hire requests across all 6 lifecycle events via pg_net triggers.
-- ==============================================================================

-- 1. Trigger function for Mart order lifecycle events
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
  v_event_type text;
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

  -- Lookup vendor details
  SELECT 
    COALESCE(vp.business_name, prof.full_name, 'Print Hub'),
    COALESCE(u.phone, u.raw_user_meta_data->>'phone', null),
    COALESCE(u.email, prof.full_name)
  INTO v_vendor_name, v_vendor_phone, v_vendor_email
  FROM public.providers pr
  LEFT JOIN public.vendor_profiles vp ON vp.provider_id = pr.id
  LEFT JOIN public.profiles prof ON prof.id = pr.user_id
  LEFT JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.id = NEW.provider_id;

  -- Lookup buyer details
  SELECT 
    COALESCE(prof.full_name, 'Customer'),
    u.email
  INTO v_buyer_name, v_buyer_email
  FROM auth.users u
  LEFT JOIN public.profiles prof ON prof.id = u.id
  WHERE u.id = NEW.buyer_user_id;

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

-- Replace existing vendor-only insert trigger with comprehensive lifecycle trigger
DROP TRIGGER IF EXISTS trg_mart_orders_notify_vendor ON public.mart_orders;
DROP TRIGGER IF EXISTS trg_mart_orders_lifecycle_notify ON public.mart_orders;

CREATE TRIGGER trg_mart_orders_lifecycle_notify
AFTER INSERT OR UPDATE OF status, provider_id ON public.mart_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_mart_order_event();


-- 2. Trigger function for Freelance hire request lifecycle events
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

  -- Lookup freelancer details
  SELECT 
    COALESCE(fp.display_name, prof.full_name, 'Specialist'),
    u.email
  INTO v_freelancer_name, v_freelancer_email
  FROM public.providers pr
  LEFT JOIN public.freelancer_profiles fp ON fp.provider_id = pr.id
  LEFT JOIN public.profiles prof ON prof.id = pr.user_id
  LEFT JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.id = NEW.freelancer_provider_id;

  -- Lookup client (buyer) details
  SELECT 
    COALESCE(prof.full_name, 'Client'),
    u.email
  INTO v_client_name, v_client_email
  FROM auth.users u
  LEFT JOIN public.profiles prof ON prof.id = u.id
  WHERE u.id = NEW.buyer_user_id;

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

-- Create Trigger on freelance_requests
DROP TRIGGER IF EXISTS trg_freelance_requests_lifecycle_notify ON public.freelance_requests;

CREATE TRIGGER trg_freelance_requests_lifecycle_notify
AFTER INSERT OR UPDATE OF status ON public.freelance_requests
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_freelance_request_event();
