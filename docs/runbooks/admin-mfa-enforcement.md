# Runbook: Admin MFA Enforcement (Phase 8b item 2)

Status: **action required by an instance admin** — Clerk instance security
settings cannot be modified from application code, so this is a manual step
with a verification checklist. Do not mark Phase 8b done until the
verification section passes on a real login.

## Why per-role MFA needs an app-level gate

Clerk supports two enforcement levels:

1. **Instance-wide MFA requirement** — forces MFA for *every* user. Too
   aggressive for a consumer marketplace at launch; would add friction to
   every signup.
2. **MFA as opt-in factor** + application-level gating — users *can* enroll,
   and the app *refuses admin access* unless they have. This is the pattern
   below: it satisfies "MFA required for the admin role" without punishing
   regular users, and it is enforced server-side (unforgeable from the UI).

## Step 1 — Allow MFA in Clerk (Dashboard)

1. Clerk Dashboard → your instance → **Configure → MFA** (or **User & Authentication → Multi-factor** on older UIs).
2. Enable **Authenticator app (TOTP)** as an available second factor. SMS is optional (discouraged; TOTP is phishing-resistant).
3. Save. This makes enrollment *possible* — it does not yet *require* it.

CLI equivalent (checks current settings):

```bash
clerk instance get --output json | jq '.user_settings.multi_factor'
```

## Step 2 — Enroll the admin(s)

For each admin account:

1. Sign in normally.
2. Go to the Clerk **Account Portal** (user button → Manage account) → **Security** → **Two-step verification** → **Add authenticator app**.
3. Scan the QR with an authenticator (1Password, Bitwarden, Google Authenticator, etc.) and confirm the 6-digit code.
4. **Store backup codes** in the team vault — losing TOTP without backup codes locks the admin out.

## Step 3 — App-level admin gate (already in this codebase)

`lib/admin-auth.ts` (and every `/admin` server surface) calls
`requireAdmin()` which verifies the profile role server-side. Extend that
gate with the MFA check below so an admin session without a second factor is
rejected even if the Clerk setting is mis-toggled later:

```ts
import { auth } from "@clerk/nextjs/server";

// inside requireAdmin(), after role === "admin" check:
const { sessionClaims } = await auth();
const mfaActive = sessionClaims?.hasOwnProperty("has_mfa")
  ? // Clerk embeds `has_mfa` in session claims when the user has ANY MFA factor
    Boolean((sessionClaims as Record<string, unknown>).o?.["2fa"] ?? (sessionClaims as Record<string, unknown>).has_mfa)
  : false;
if (!mfaActive) {
  throw new Error("Admin access requires two-factor authentication. Enroll at the Account Portal → Security.");
}
```

> Note: confirm the exact claim shape for your Clerk version with
> `clerk api sessions get --session-id <id> | jq .` after enrollment, and
> pin the claim name in one place (the snippet above) so a Clerk claim
> rename can't silently disable the gate.

## Step 4 — Verification (Definition of Done)

Execute on a real session and record the results in the phase report:

- [ ] Admin **with** TOTP enrolled: sign-in prompts for the second factor → code accepted → `/admin` loads. (`clerk api sessions list` shows `second_factor: verified` / `verification` present for the session.)
- [ ] Admin **without** TOTP (fresh test admin): `/admin` returns the MFA-required error, even though role check passes.
- [ ] Non-admin user: `/admin` still blocked by role (unchanged).
- [ ] Backup code path: sign in using a backup code when TOTP is unavailable.
- [ ] `clerk instance get | jq '.user_settings.multi_factor'` shows `authenticator_app: true`.

## Step 5 — Rollback (emergency)

If an admin loses their second factor and backup codes:

```bash
# Backup-code consumption fails → delete the factor via Backend API, then
# re-enroll immediately:
clerk api users delete_external_account ... # or:
clerk api users update --user-id user_xxx --two-factor-enabled false
```

Treat factor deletion as an incident: note who did it, when, and re-enroll
the same day.

## Related settings worth enabling while you're in the Dashboard

- **Session token freshness for sensitive actions** (e.g. require recent auth for payouts admin actions).
- **Restrict email domains for admin invites** — invite-only admin membership.
- **Audit log review cadence** — weekly export of `session.ended` / `user.updated` events for admin accounts.
