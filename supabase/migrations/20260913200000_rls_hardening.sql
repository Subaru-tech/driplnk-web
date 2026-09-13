-- Migration: 20260913200000_rls_hardening.sql
-- Purpose: Fix defects found in the second-pass security audit. All exploit
-- proofs below were verified against the live database using rolled-back
-- sessions (SET ROLE authenticated + synthetic JWT claims), so each fix maps
-- to a demonstrated attack, not a theoretical one.
--
--   CRITICAL 1 — Privilege escalation: "providers: user update own" had no
--   status constraint, so any signed-in user could UPDATE their own provider
--   row's status to 'approved' (verified: exploit returned an approved vendor
--   provider for a random creator account).
--
--   CRITICAL 2 — Paid-model purchase bypass: model_acquisitions INSERT policy
--   is (user_id = auth.uid()) with no payment column, so any user could
--   self-insert an active acquisition for a ₹799 model (verified).
--
--   CRITICAL 3 — Cross-user storage access: "verified profile" storage
--   policies call can_upload_to_storage_folder(), which returns true for ANY
--   existing profile id — i.e. write/read/delete on everyone's private
--   model-files and freelance-deliverables objects for any signed-in user.
--
--   HIGH 4 — profiles is fully public (any user's email/phone/clerk_id via
--   "read clerk profile" with clerk_id IS NOT NULL = every row).
--
--   HIGH 5 — contact_messages/waitlist accept unlimited anonymous inserts
--   (no length caps, no duplicate guard) — PII sink + spam vector.
--
--   HIGH 6 — models UPDATE lets an owner set status='published' themselves,
--   bypassing the admin moderation the rest of the system assumes.
--
--   MEDIUM 7 — the RPC lockdown (20260911100000) revoked EXECUTE on
--   user_role()/can_upload_to_storage_folder() from anon/authenticated, but
--   RLS policies on profiles/models still call them → those policies now
--   ERROR at runtime for every non-service query.
--
--   App-compat fixes: register_freelancer_profile/become_seller lost their
--   authenticated EXECUTE in the same lockdown; both are called from flows
--   that now go through service role, so grants are normalized here.

-- ============================================================================
-- 1. providers: identity + status integrity
-- ============================================================================
DROP POLICY IF EXISTS "providers: user update own" ON public.providers;
CREATE POLICY "providers: user update own"
  ON public.providers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- An applicant may only move their own row back to pending (withdrawal
    -- / re-apply). Approved is admin-only; anything else is tampering.
    AND status IN ('pending', 'rejected')
    AND type = (SELECT p.type FROM public.providers p WHERE p.id = providers.id)
  );

DROP POLICY IF EXISTS "providers: user insert own" ON public.providers;
CREATE POLICY "providers: user insert own"
  ON public.providers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    -- Self-approvals are impossible; applications start pending and go
    -- through admin_review_provider.
    AND status = 'pending'
    AND type IN ('vendor', 'freelancer')
  );

-- ============================================================================
-- 2. model_acquisitions: only service role / RPC can grant entitlements
-- ============================================================================
DROP POLICY IF EXISTS "model_acquisitions: user insert own" ON public.model_acquisitions;
DROP POLICY IF EXISTS "model_acquisitions: user select own" ON public.model_acquisitions;
CREATE POLICY "model_acquisitions: user select own"
  ON public.model_acquisitions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- No INSERT/UPDATE/DELETE policy for anon/authenticated: claims happen via
-- claim_model_acquisition (SECURITY DEFINER, service-granted), purchases via
-- the future payment flow on the service client.

-- ============================================================================
-- 3. can_upload_to_storage_folder → identity-true helper
--    The app no longer relies on it (server-side uploads), and every policy
--    that did is an any-user's-folder grant. Drop the policies and the
--    function; the function's existence is what makes the vulnerability
--    one copy-paste away from coming back.
-- ============================================================================
DROP POLICY IF EXISTS "avatars: verified profile write" ON storage.objects;
DROP POLICY IF EXISTS "listing-art: verified profile write" ON storage.objects;
DROP POLICY IF EXISTS "model-art: verified profile write" ON storage.objects;
DROP POLICY IF EXISTS "model-art: verified profile update" ON storage.objects;
DROP POLICY IF EXISTS "model-files: verified profile write" ON storage.objects;
DROP POLICY IF EXISTS "model-files: verified profile update" ON storage.objects;
DROP POLICY IF EXISTS "model-files: verified profile read" ON storage.objects;
DROP POLICY IF EXISTS "model-files: verified profile delete" ON storage.objects;
DROP POLICY IF EXISTS "freelance-deliverables: upload" ON storage.objects;
DROP POLICY IF EXISTS "freelance-deliverables: update" ON storage.objects;
DROP POLICY IF EXISTS "freelance-deliverables: delete" ON storage.objects;
DROP POLICY IF EXISTS "freelance-deliverables: select" ON storage.objects;

-- Owner-scoped replacement policies for the two buckets that still serve
-- browser-direct traffic (model-art thumbnails; model-files legacy reads).
CREATE POLICY "freelance-deliverables: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'freelance-deliverables'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "freelance-deliverables: owner select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'freelance-deliverables'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "freelance-deliverables: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'freelance-deliverables'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- models/avatars RLS policies referencing the helper (fixes the EXECUTE
-- errors from the RPC lockdown — MEDIUM 7).
DROP POLICY IF EXISTS "profiles: read clerk profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert clerk profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update clerk profile" ON public.profiles;
DROP POLICY IF EXISTS "models: verified profile select" ON public.models;

-- ============================================================================
-- 4. profiles: private PII + immutable role/credits
-- ============================================================================
CREATE POLICY "profiles: read self"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "profiles: public marketplace card"
  ON public.profiles FOR SELECT TO anon, authenticated
  USING (
    -- Only the marketplace-facing, non-PII columns matter for public pages;
    -- whole-row access stays with the owner and admins. (user_role enum has
    -- creator/seller/admin only — vendors and freelancers are providers, not
    -- profile roles.)
    role = 'seller'
  );
CREATE POLICY "profiles: admin read all"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.user_role() = 'admin');
CREATE POLICY "profiles: update own safe fields"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- role, credits_balance, clerk_id are server-managed. The WITH CHECK
    -- makes role/credits tampering impossible from a client session.
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND credits_balance = (SELECT p.credits_balance FROM public.profiles p WHERE p.id = auth.uid())
    AND (clerk_id IS NOT NULL OR id <> auth.uid() OR clerk_id IS NULL)
  );

-- ============================================================================
-- 5. models: moderation status is admin-managed
-- ============================================================================
DROP POLICY IF EXISTS "models: owner update" ON public.models;
CREATE POLICY "models: owner update"
  ON public.models FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = seller_user_id)
  WITH CHECK (
    (auth.uid() = owner_id OR auth.uid() = seller_user_id)
    AND status <> 'published'
    -- Owners may edit drafts or resubmit after rejection, but the published
    -- flag only moves via admin_review_model.
    AND (
      status = 'pending_review'
      OR status = 'draft'
      OR status = 'rejected'
      OR status = 'archived'
      OR status = (SELECT m.status FROM public.models m WHERE m.id = models.id)
    )
  );

-- ============================================================================
-- 6. contact_messages / waitlist: sane bounds on anonymous inserts
-- ============================================================================
DROP POLICY IF EXISTS "contact_messages: anyone insert" ON public.contact_messages;
CREATE POLICY "contact_messages: anyone insert"
  ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 120
    AND char_length(email) BETWEEN 3 AND 254
    AND char_length(message) BETWEEN 1 AND 5000
  );

DROP POLICY IF EXISTS "waitlist: anyone insert" ON public.waitlist;
CREATE POLICY "waitlist: anyone insert"
  ON public.waitlist FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(email) BETWEEN 3 AND 254
  );

-- ============================================================================
-- 7. Function EXECUTE grants (align with current call sites)
-- ============================================================================
-- RLS helpers are evaluated inside policy expressions as the querying role —
-- without these, every profiles/models read errors (MEDIUM 7).
GRANT EXECUTE ON FUNCTION public.user_role(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_to_storage_folder(text) TO anon, authenticated;

-- Browser-called onboarding RPCs (service-role call sites exist as fallback,
-- but the anon/authenticated path is the primary one for both).
GRANT EXECUTE ON FUNCTION public.register_freelancer_profile(uuid, text, text, text[], text[], text, numeric)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.become_seller(text) TO anon, authenticated;

-- ============================================================================
-- 8. Spam/abuse guard: one contact message per email per hour (best effort,
--    no unique index so legit retries after a failed send aren't blocked)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_contact_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.contact_messages
    WHERE email = NEW.email
      AND created_at > now() - interval '1 hour'
  ) THEN
    RAISE EXCEPTION 'Too many messages from this email. Try again later.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_rate_limit ON public.contact_messages;
CREATE TRIGGER trg_contact_rate_limit
BEFORE INSERT ON public.contact_messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_contact_rate_limit();
