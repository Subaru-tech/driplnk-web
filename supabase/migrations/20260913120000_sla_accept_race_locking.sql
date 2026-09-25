-- Migration: 20260913120000_sla_accept_race_locking.sql
-- Purpose: Phase 8b item 3 — close the SLA-expiry vs vendor-accept race.
--
-- RACE (before this migration):
--   Session 1 (vendor accept via respond_to_mart_order):
--     SELECT (no lock) -> status 'pending_vendor_response' -> UPDATE status='accepted'
--   Session 2 (pg_cron SLA sweep via check_mart_order_sla):
--     SELECT expired rows (no lock) -> UPDATE provider_id = next vendor
--   Both read the same pre-update snapshot, both UPDATEs succeed -> order
--   accepted by vendor A while provider_id already points at vendor B
--   (double-assignment), or SLA reassigns an already-accepted order.
--
-- FIX: take a row lock (FOR UPDATE) on the mart_orders row BEFORE reading
-- status in BOTH code paths. Two sessions then serialize on the row lock:
-- the loser re-reads committed state and sees the winner's transition, and
-- its own transition is rejected by the state guard. Exactly one outcome.

-- ============================================================================
-- 1. respond_to_mart_order — lock row before status checks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.respond_to_mart_order(
  p_user_id uuid,
  p_order_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_order public.mart_orders%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_is_vendor boolean := false;
  v_is_buyer boolean := false;
BEGIN
  -- Row lock FIRST: concurrent SLA sweep (or another vendor action) on the
  -- same order blocks here until this transaction commits or rolls back.
  SELECT * INTO v_order FROM public.mart_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT * INTO v_provider FROM public.providers WHERE id = v_order.provider_id;

  IF v_provider.user_id = p_user_id THEN
    v_is_vendor := true;
  END IF;

  IF v_order.buyer_user_id = p_user_id THEN
    v_is_buyer := true;
  END IF;

  IF NOT v_is_vendor AND NOT v_is_buyer THEN
    RAISE EXCEPTION 'Unauthorized: You are not a party to this order';
  END IF;

  IF p_action = 'accept' THEN
    IF NOT v_is_vendor THEN
      RAISE EXCEPTION 'Unauthorized: Only the vendor can accept an order';
    END IF;
    -- Guard re-checks the post-lock value: if the SLA sweep already
    -- transitioned/reassigned this row and committed first, we see that
    -- state here and refuse — no double-assignment.
    IF v_order.status NOT IN ('placed', 'pending_vendor_response') THEN
      RAISE EXCEPTION 'Order can only be accepted when in placed or pending_vendor_response status (current: %)', v_order.status;
    END IF;
    UPDATE public.mart_orders
    SET status = 'accepted', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'print' THEN
    IF NOT v_is_vendor THEN
      RAISE EXCEPTION 'Unauthorized: Only the vendor can move an order to printing';
    END IF;
    IF v_order.status <> 'accepted' THEN
      RAISE EXCEPTION 'Order can only begin printing after acceptance';
    END IF;
    UPDATE public.mart_orders
    SET status = 'printing', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'ship' THEN
    IF NOT v_is_vendor THEN
      RAISE EXCEPTION 'Unauthorized: Only the vendor can mark an order shipped';
    END IF;
    IF v_order.status <> 'printing' THEN
      RAISE EXCEPTION 'Order can only be shipped after printing';
    END IF;
    UPDATE public.mart_orders
    SET status = 'shipped', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'deliver' THEN
    IF NOT v_is_vendor THEN
      RAISE EXCEPTION 'Unauthorized: Only the vendor can mark an order delivered';
    END IF;
    IF v_order.status <> 'shipped' THEN
      RAISE EXCEPTION 'Order can only be delivered after being shipped';
    END IF;
    UPDATE public.mart_orders
    SET status = 'delivered', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'complete' THEN
    IF NOT v_is_buyer THEN
      RAISE EXCEPTION 'Unauthorized: Only the buyer can mark an order completed';
    END IF;
    IF v_order.status <> 'delivered' THEN
      RAISE EXCEPTION 'Order can only be completed after being delivered';
    END IF;
    UPDATE public.mart_orders
    SET status = 'completed', updated_at = now()
    WHERE id = p_order_id;

  ELSIF p_action = 'cancel' THEN
    IF v_is_buyer AND v_order.status IN ('placed', 'pending_vendor_response') THEN
      UPDATE public.mart_orders
      SET status = 'cancelled', updated_at = now()
      WHERE id = p_order_id;
    ELSIF v_is_vendor AND v_order.status IN ('placed', 'accepted') THEN
      UPDATE public.mart_orders
      SET status = 'cancelled', updated_at = now()
      WHERE id = p_order_id;
    ELSE
      RAISE EXCEPTION 'Cannot cancel order in current status (%)', v_order.status;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'action', p_action);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_mart_order(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_mart_order(uuid, uuid, text) TO service_role;

-- ============================================================================
-- 2. check_mart_order_sla — lock row before reassign/expire decision
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_mart_order_sla(p_sla_minutes integer DEFAULT 45)
RETURNS TABLE (
  order_id uuid,
  previous_status text,
  new_status text,
  reassigned_provider_id uuid,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_rec record;
  v_next_vendor_id uuid;
BEGIN
  FOR v_rec IN
    -- FOR UPDATE inside the cursor: each candidate order row is locked
    -- before its status is re-evaluated. A vendor accept holding the lock
    -- makes the sweep wait; after the accept commits, the locked re-read
    -- returns the NEW status ('accepted'), which no longer matches the
    -- WHERE clause, so pg_cron skips it — the race is closed at the source.
    SELECT o.id, o.provider_id, o.material, o.price, o.created_at
    FROM public.mart_orders o
    WHERE o.status = 'pending_vendor_response'
      AND o.created_at < (now() - (p_sla_minutes || ' minutes')::interval)
    ORDER BY o.created_at ASC
    FOR UPDATE
  LOOP
    SELECT pr.id INTO v_next_vendor_id
    FROM public.providers pr
    JOIN public.vendor_profiles vp ON vp.provider_id = pr.id
    WHERE pr.type = 'vendor'
      AND pr.status = 'approved'
      AND vp.status = 'approved'
      AND pr.id <> v_rec.provider_id
      AND (cardinality(vp.materials_supported) = 0 OR v_rec.material = ANY(vp.materials_supported))
    LIMIT 1;

    IF v_next_vendor_id IS NOT NULL THEN
      UPDATE public.mart_orders
      SET
        provider_id = v_next_vendor_id,
        status = 'pending_vendor_response',
        updated_at = now()
      WHERE id = v_rec.id;

      order_id := v_rec.id;
      previous_status := 'pending_vendor_response';
      new_status := 'pending_vendor_response';
      reassigned_provider_id := v_next_vendor_id;
      notes := 'Reassigned to alternative approved vendor due to SLA timeout';
      RETURN NEXT;
    ELSE
      UPDATE public.mart_orders
      SET
        status = 'expired_no_vendor_response',
        updated_at = now()
      WHERE id = v_rec.id;

      order_id := v_rec.id;
      previous_status := 'pending_vendor_response';
      new_status := 'expired_no_vendor_response';
      reassigned_provider_id := NULL;
      notes := 'Order expired - no vendor response within SLA window and no alternative vendors';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_mart_order_sla(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_mart_order_sla(integer) TO service_role;

-- ============================================================================
-- 3. transition_order_payment_state — lock the payment row before evaluating
--    the state machine (same double-transition race exists there: two
--    concurrent 'release' calls would both read authorized_held and both
--    write audit rows).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transition_order_payment_state(
  p_payment_id uuid,
  p_target_state public.payment_hold_state,
  p_actor_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_payment public.order_payments%ROWTYPE;
  v_is_legal boolean := false;
BEGIN
  -- Row lock FIRST (previously a plain SELECT): serializes concurrent
  -- transitions of the same payment.
  SELECT * INTO v_payment FROM public.order_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order payment record not found for ID: %', p_payment_id;
  END IF;

  IF v_payment.status = 'authorized_held' THEN
    IF p_target_state IN ('released_to_vendor', 'refunded_to_buyer', 'disputed') THEN
      v_is_legal := true;
    END IF;
  ELSIF v_payment.status = 'disputed' THEN
    IF p_target_state IN ('released_to_vendor', 'refunded_to_buyer') THEN
      v_is_legal := true;
    END IF;
  END IF;

  IF NOT v_is_legal THEN
    RAISE EXCEPTION 'Illegal payment state transition: Cannot transition from % to %', v_payment.status, p_target_state;
  END IF;

  UPDATE public.order_payments
  SET
    status = p_target_state,
    released_at = CASE WHEN p_target_state = 'released_to_vendor' THEN now() ELSE released_at END,
    refunded_at = CASE WHEN p_target_state = 'refunded_to_buyer' THEN now() ELSE refunded_at END,
    disputed_at = CASE WHEN p_target_state = 'disputed' THEN now() ELSE disputed_at END,
    dispute_reason = CASE WHEN p_target_state = 'disputed' THEN p_reason ELSE dispute_reason END,
    dispute_resolution = CASE WHEN v_payment.status = 'disputed' AND p_target_state IN ('released_to_vendor', 'refunded_to_buyer') THEN p_reason ELSE dispute_resolution END,
    updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.order_payment_transitions (
    payment_id,
    from_state,
    to_state,
    transitioned_by,
    reason
  ) VALUES (
    p_payment_id,
    v_payment.status,
    p_target_state,
    p_actor_id,
    p_reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'from_state', v_payment.status,
    'to_state', p_target_state,
    'reason', p_reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_order_payment_state(uuid, public.payment_hold_state, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_payment_state(uuid, public.payment_hold_state, uuid, text) TO service_role;
