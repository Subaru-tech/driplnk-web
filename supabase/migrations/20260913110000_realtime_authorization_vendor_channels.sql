-- Migration: 20260913110000_realtime_authorization_vendor_channels.sql
-- Purpose: Phase 8b item 1 — Realtime channel authorization for vendor order
-- channels.
--
-- The vendor-order-notification edge function broadcasts new/updated orders
-- to `vendor-orders:<provider_id>` channels. Supabase Realtime checks RLS
-- automatically for postgres_changes subscriptions, but Broadcast/Presence
-- messages are NOT filtered by table RLS: without a channel authorization
-- policy, ANY authenticated user who learns (or brute-forces) another
-- vendor's provider_id can subscribe to `vendor-orders:<that_id>` and read
-- order events (buyer name, material, address metadata) from the broadcast.
--
-- Fix: Realtime Authorization policies. Supabase evaluates the policy's
-- SELECT against the `realtime.messages` table with the subscribing user's
-- JWT; a false/empty result makes the subscribe+join silently receive
-- nothing. Topic must match exactly — no wildcards.

-- Remove any prior version of the policy so this file stays idempotent.
DROP POLICY IF EXISTS "vendor-orders channel: owning vendor only" ON realtime.messages;

-- Scope channel access to the vendor that owns the provider_id in the topic.
--   topic format:  vendor-orders:<provider_id>
-- The policy joins the topic's provider_id back to providers and requires
-- that the subscribing user (auth.uid()) owns that provider row.
CREATE POLICY "vendor-orders channel: owning vendor only"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic()
    LIKE 'vendor-orders:%'
    AND (
      SELECT p.user_id
      FROM public.providers p
      WHERE p.id = substring(realtime.topic() from length('vendor-orders:') + 1)::uuid
    ) = auth.uid()
  );

-- Anon must never receive vendor channel traffic at all. (Default deny is
-- already in force when no policy grants a role, but state it explicitly so
-- a future permissive policy for anon doesn't silently re-open the hole.)
REVOKE SELECT ON realtime.messages FROM anon;

COMMENT ON POLICY "vendor-orders channel: owning vendor only" ON realtime.messages IS
  'Phase 8b: vendor-orders:<provider_id> broadcast channels are readable only by the vendor user who owns that provider row. Test: subscribe as user A to vendor-orders:<B provider_id> — must receive no messages.';

-- ---------------------------------------------------------------------------
-- Verification procedure (run manually — requires two real user JWTs):
--
--   1. As vendor B (or any user), create a client:
--        const c = createClient(URL, ANON_KEY, { auth: { persistSession: false }});
--        await c.realtime.setAuth(B_JWT);            // B's own access token
--        const ch = c.channel(`vendor-orders:${B_PROVIDER_ID}`);
--        ch.subscribe((status) => ...);              // receives SUBSCRIBED
--        ch.on('broadcast', { event: 'order' }, cb); // receives events
--
--   2. As attacker A, repeat with A_JWT and the SAME channel topic
--      `vendor-orders:${B_PROVIDER_ID}`:
--        - subscription may report SUBSCRIBED (channel join succeeds), but
--        - the authorization policy filters every broadcast row, so `cb`
--          never fires for messages sent by the edge function.
--      That silent-empty behavior is the expected "rejected" outcome for
--      broadcast channels.
--
--   3. Sanity: RLS probe via SQL (rolled-back session) —
--        begin; set local role authenticated;
--        set local request.jwt.claims = '{"sub":"<A user id>","role":"authenticated"}';
--        select count(*) from realtime.messages
--         where topic = 'vendor-orders:<B provider id>';  -- must be 0
--      This check is wired into supabase/tests/rls_regression.mjs (probe
--      P8-RT) where the Management API can impersonate the claims.
-- ---------------------------------------------------------------------------
