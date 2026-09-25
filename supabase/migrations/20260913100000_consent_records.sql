-- Phase 8: consent records.
-- Explicit-consent checkboxes (signup, contact form, waitlist) and the cookie
-- banner must log WHAT was consented to and WHEN, as evidence of valid notice
-- under the DPDP Act. This table is insert-only for clients: records are
-- evidence, so UPDATE and DELETE are never granted to anon/authenticated.

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  subject_email text,
  user_id uuid references public.profiles(id) on delete set null,
  consent_type text not null check (consent_type in (
    'signup_terms',
    'contact_form',
    'waitlist',
    'cookie_analytics',
    'cookie_marketing'
  )),
  granted boolean not null default true,
  policy_version text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.consent_records is
  'Append-only log of explicit user consents (terms, forms, waitlist, cookies) with timestamps and policy versions. Evidence for DPDP Act compliance. Never exposed to client reads.';

create index if not exists consent_records_subject_idx
  on public.consent_records (subject_email);

create index if not exists consent_records_user_idx
  on public.consent_records (user_id);

-- RLS: nobody reads via client sessions; anon/authenticated may only insert
-- their own consent rows (no user_id forgery: the DB scope keeps user_id null
-- for anon inserts; service role writes user-scoped rows).
alter table public.consent_records enable row level security;

drop policy if exists "consent_records: insert own consent" on public.consent_records;
create policy "consent_records: insert own consent"
  on public.consent_records
  for insert
  to anon, authenticated
  with check (user_id is null);

drop policy if exists "consent_records: no client read/update/delete" on public.consent_records;
create policy "consent_records: no client read/update/delete"
  on public.consent_records
  for select
  to anon, authenticated
  using (false);

-- Belt and braces: revoke statement privileges beyond INSERT for client roles.
revoke update, delete, truncate on public.consent_records from anon, authenticated;

-- ---------------------------------------------------------------- rate limit
-- Reuse the same spam-guard pattern as waitlist/contact_messages: cap consent
-- rows per email per hour so the endpoint can't be stuffed.
create or replace function public.guard_consent_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent integer;
begin
  select count(*) into v_recent
  from public.consent_records
  where subject_email = new.subject_email
    and created_at > now() - interval '1 hour';

  if v_recent >= 10 then
    raise exception 'Consent rate limit exceeded for this email; try again later.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_consent_rate_limit on public.consent_records;
create trigger trg_consent_rate_limit
before insert on public.consent_records
for each row
when (new.subject_email is not null)
execute function public.guard_consent_rate_limit();
