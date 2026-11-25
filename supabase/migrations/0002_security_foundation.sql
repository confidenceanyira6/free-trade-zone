-- Saage Free Trade Zone, migration 0002: security foundation.
-- NOT RUN (the database connection from my tools failed, see docs/BACKEND_STATUS.md).
-- Run supabase/preflight.sql first to see what already exists in the live project.
-- Additive and idempotent: no drops of tables, no data deletion.
--
-- Fixes in the 0001 draft:
--   1. profiles had no RLS: any signed-in user could set their own role to admin.
--   2. is_admin() trusted profiles.role. Admins now live in admin_users with permission levels.
--   3. No currency on money columns.
--   4. post_ledger / credit_wallet were executable by clients.
--   5. fee_proposals had no write path and accepted fees were not immutable.
--   6. No verification model and no verification gate for transactions.
-- Matches the frontend: signup metadata (saage_role, business_name, country...), companies table,
-- admin_users.admin_role.

create extension if not exists pgcrypto;

-- ============================================================ countries / currencies
create table if not exists countries (code char(2) primary key, name text not null, active boolean not null default true);
create table if not exists supported_currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  minor_unit int not null default 2 check (minor_unit between 0 and 4),
  active boolean not null default true
);
create table if not exists exchange_rates (
  id bigserial primary key,
  base_currency text not null references supported_currencies(code),
  quote_currency text not null references supported_currencies(code),
  rate numeric(24,10) not null check (rate > 0),
  source text not null,
  fetched_at timestamptz not null default now(),
  check (base_currency <> quote_currency)
);
create index if not exists exchange_rates_pair_idx on exchange_rates (base_currency, quote_currency, fetched_at desc);

insert into supported_currencies(code, name) values
  ('NGN','Nigerian Naira'),('USD','US Dollar'),('GBP','Pound Sterling'),('EUR','Euro'),('GHS','Ghanaian Cedi')
  on conflict do nothing;
insert into countries(code, name) values
  ('NG','Nigeria'),('GH','Ghana'),('KE','Kenya'),('ZA','South Africa'),('CI','Cote d''Ivoire'),('CM','Cameroon'),('TZ','Tanzania'),
  ('EG','Egypt'),('CN','China'),('IN','India'),('AE','United Arab Emirates'),('GB','United Kingdom'),('US','United States'),
  ('DE','Germany'),('NL','Netherlands')
  on conflict do nothing;

do $$ declare t text; begin
  foreach t in array array['countries','supported_currencies','exchange_rates'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
drop policy if exists countries_read on countries;
create policy countries_read on countries for select using (true);
drop policy if exists currencies_read on supported_currencies;
create policy currencies_read on supported_currencies for select using (true);
drop policy if exists rates_read on exchange_rates;
create policy rates_read on exchange_rates for select to authenticated using (true);

-- One settlement currency per transaction. No silent conversion.
alter table transactions    add column if not exists currency text not null default 'NGN' references supported_currencies(code);
alter table escrow_accounts add column if not exists currency text not null default 'NGN' references supported_currencies(code);
alter table assignments     add column if not exists currency text not null default 'NGN' references supported_currencies(code);
alter table fee_proposals   add column if not exists currency text not null default 'NGN' references supported_currencies(code);

-- ============================================================ profiles: lock down
alter table profiles add column if not exists email text;
alter table profiles add column if not exists country char(2);
alter table profiles add column if not exists state text;
alter table profiles add column if not exists city text;
alter table profiles add column if not exists avatar_path text;
alter table profiles add column if not exists account_status text not null default 'active'
  check (account_status in ('active','deactivated','suspended','deletion_requested'));
alter table profiles add column if not exists verification_status text not null default 'not_submitted'
  check (verification_status in ('not_submitted','pending','under_review','verified','rejected','expired','requires_resubmission'));
alter table profiles add column if not exists verification_tier text not null default 'unverified'
  check (verification_tier in ('unverified','partial','full'));

alter table profiles enable row level security;
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles for select using (id = auth.uid() or is_admin());
drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke insert, delete on profiles from anon, authenticated;

-- Clients may edit harmless fields only. Not SECURITY DEFINER on purpose: current_user is the real
-- caller, so direct client writes are blocked while our own definer functions still work.
create or replace function profiles_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    if new.role is distinct from old.role or new.verified is distinct from old.verified
       or new.verification_status is distinct from old.verification_status
       or new.verification_tier is distinct from old.verification_tier
       or new.account_status is distinct from old.account_status or new.id is distinct from old.id then
      raise exception 'protected profile field';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_trg on profiles;
create trigger profiles_guard_trg before update on profiles for each row execute function profiles_guard();

-- companies: the frontend reads companies by owner_id.
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  country char(2),
  address text,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now()
);
alter table companies add column if not exists address text;
alter table companies enable row level security;
drop policy if exists companies_owner_read on companies;
create policy companies_owner_read on companies for select using (owner_id = auth.uid() or is_admin());
drop policy if exists companies_owner_update on companies;
create policy companies_owner_update on companies for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create or replace function companies_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and (new.verification_status is distinct from old.verification_status or new.owner_id is distinct from old.owner_id) then
    raise exception 'protected company field';
  end if;
  return new;
end $$;
drop trigger if exists companies_guard_trg on companies;
create trigger companies_guard_trg before update on companies for each row execute function companies_guard();

-- Profile row created at signup from the frontend's metadata. 'admin' can never be self-selected.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); r text := coalesce(m->>'saage_role', m->>'role', 'buyer');
begin
  if r not in ('buyer','seller','agent') then r := 'buyer'; end if;
  insert into profiles(id, role, full_name, phone, email, country)
  values (new.id, r::user_role, m->>'full_name', coalesce(new.phone, m->>'phone'), new.email, nullif(left(m->>'country', 2), ''))
  on conflict (id) do nothing;
  begin
    if nullif(trim(m->>'business_name'), '') is not null then
      insert into companies(owner_id, name, country, address) values (new.id, trim(m->>'business_name'), nullif(left(m->>'country', 2), ''), m->>'address');
    end if;
  exception when others then null;   -- never block signup because of the company row
  end;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace view public_profiles as
  select id, full_name, role, verification_status, verification_tier, country, state, city, avatar_path
  from profiles where account_status = 'active';
grant select on public_profiles to anon, authenticated;

-- ============================================================ admin roles and permissions
create table if not exists admin_roles (id text primary key, name text not null);
create table if not exists admin_permissions (
  role_id text not null references admin_roles(id) on delete cascade,
  permission text not null,
  primary key (role_id, permission)
);
-- The frontend reads admin_users.admin_role. Create or reconcile an existing table.
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin_role text not null default 'super_admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table admin_users add column if not exists admin_role text not null default 'super_admin';
alter table admin_users add column if not exists active boolean not null default true;

insert into admin_roles(id, name) values
  ('super_admin','Super Administrator'),('verification_officer','Verification Officer'),
  ('financial_officer','Financial Officer'),('dispute_officer','Dispute Officer'),
  ('marketplace_moderator','Marketplace Moderator')
  on conflict do nothing;
insert into admin_permissions(role_id, permission) values
  ('verification_officer','verification.review'),
  ('financial_officer','finance.refund'),('financial_officer','finance.release'),('financial_officer','finance.payout'),
  ('dispute_officer','dispute.resolve'),('dispute_officer','transaction.hold'),
  ('marketplace_moderator','marketplace.moderate')
  on conflict do nothing;

insert into admin_users(user_id, admin_role) select id, 'super_admin' from profiles where role = 'admin' on conflict do nothing;

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid() and active)
$$;
create or replace function has_permission(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users u
    where u.user_id = auth.uid() and u.active
      and (u.admin_role = 'super_admin' or exists (select 1 from admin_permissions ap where ap.role_id = u.admin_role and ap.permission = p))
  )
$$;

alter table admin_roles enable row level security;
alter table admin_permissions enable row level security;
alter table admin_users enable row level security;
drop policy if exists admin_roles_read on admin_roles;
create policy admin_roles_read on admin_roles for select using (is_admin());
drop policy if exists admin_perms_read on admin_permissions;
create policy admin_perms_read on admin_permissions for select using (is_admin());
drop policy if exists admin_users_read on admin_users;
create policy admin_users_read on admin_users for select using (user_id = auth.uid() or has_permission('users.manage'));
-- No client write policies: admins are created by a super administrator through the SQL editor or an Edge Function.

create table if not exists admin_audit_logs (
  id bigserial primary key,
  admin_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table admin_audit_logs enable row level security;
drop policy if exists audit_read on admin_audit_logs;
create policy audit_read on admin_audit_logs for select using (has_permission('audit.read'));

create or replace function append_only() returns trigger language plpgsql as $$ begin raise exception '% is append-only', tg_table_name; end $$;
drop trigger if exists audit_no_change on admin_audit_logs;
create trigger audit_no_change before update or delete on admin_audit_logs for each row execute function append_only();
revoke update, delete, truncate on admin_audit_logs from public, anon, authenticated;

create or replace function write_audit(p_action text, p_target_type text, p_target_id text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into admin_audit_logs(admin_id, action, target_type, target_id, details) values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb))
$$;
revoke all on function write_audit(text, text, text, jsonb) from public, anon, authenticated;

-- ============================================================ verification
-- Raw NIN and BVN are never stored: only a keyed hash (blocks one identity on two accounts), the last 4 digits and the provider reference.
create table if not exists verification_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  subject text not null check (subject in ('identity','business','agent')),
  status text not null default 'pending'
    check (status in ('not_submitted','pending','under_review','verified','rejected','expired','requires_resubmission')),
  provider text, provider_reference text,
  nin_last4 text, bvn_last4 text, nin_hash text, bvn_hash text,
  reviewer_id uuid references profiles(id), reviewed_at timestamptz, expires_at timestamptz, notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists verification_nin_unique on verification_records (nin_hash) where nin_hash is not null and status in ('pending','under_review','verified');
create unique index if not exists verification_bvn_unique on verification_records (bvn_hash) where bvn_hash is not null and status in ('pending','under_review','verified');
create index if not exists verification_user_idx on verification_records (user_id, subject);

create table if not exists business_verifications (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references verification_records(id),
  user_id uuid not null references profiles(id),
  business_name text not null,
  registration_country char(2) not null default 'NG',
  registration_number text, business_address text, representative_name text,
  created_at timestamptz not null default now()
);
create table if not exists identity_checks (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references verification_records(id),
  provider text not null, provider_reference text,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists verification_documents (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references verification_records(id),
  owner_id uuid not null references profiles(id),
  doc_type text not null,
  storage_bucket text not null default 'verification-documents',
  storage_path text not null,
  created_at timestamptz not null default now()
);
create table if not exists verification_events (
  id bigserial primary key,
  record_id uuid not null references verification_records(id),
  actor_id uuid references profiles(id),
  from_status text, to_status text not null, note text,
  created_at timestamptz not null default now()
);
-- PLACEHOLDER VALUES: set real limits. NULL means unlimited.
create table if not exists verification_limits (
  tier text not null check (tier in ('unverified','partial','full')),
  currency text not null references supported_currencies(code),
  max_transaction_amount numeric(18,2), max_monthly_volume numeric(18,2),
  primary key (tier, currency)
);
insert into verification_limits(tier, currency, max_transaction_amount, max_monthly_volume) values
  ('unverified','NGN',0,0),('partial','NGN',5000000,20000000),('full','NGN',null,null)
  on conflict do nothing;

do $$ declare t text; begin
  foreach t in array array['verification_records','business_verifications','identity_checks','verification_documents','verification_events','verification_limits'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
drop policy if exists vr_owner on verification_records;
create policy vr_owner on verification_records for select using (user_id = auth.uid() or has_permission('verification.review'));
drop policy if exists bv_owner on business_verifications;
create policy bv_owner on business_verifications for select using (user_id = auth.uid() or has_permission('verification.review'));
drop policy if exists vd_owner on verification_documents;
create policy vd_owner on verification_documents for select using (owner_id = auth.uid() or has_permission('verification.review'));
drop policy if exists ve_owner on verification_events;
create policy ve_owner on verification_events for select using (
  has_permission('verification.review') or exists (select 1 from verification_records r where r.id = record_id and r.user_id = auth.uid()));
drop policy if exists ic_admin on identity_checks;
create policy ic_admin on identity_checks for select using (has_permission('verification.review'));
drop policy if exists vl_read on verification_limits;
create policy vl_read on verification_limits for select to authenticated using (true);
-- Submissions and provider results are written by Edge Functions (service role) only.

create or replace function set_verification_outcome(p_record uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r verification_records%rowtype;
begin
  if not has_permission('verification.review') then raise exception 'not allowed'; end if;
  if p_status not in ('pending','under_review','verified','rejected','expired','requires_resubmission') then raise exception 'invalid status'; end if;
  select * into r from verification_records where id = p_record for update;
  if not found then raise exception 'record not found'; end if;
  update verification_records set status = p_status, reviewer_id = auth.uid(), reviewed_at = now(), notes = p_note where id = p_record;
  insert into verification_events(record_id, actor_id, from_status, to_status, note) values (p_record, auth.uid(), r.status, p_status, p_note);
  if p_status = 'verified' then
    if r.subject in ('identity','agent') then
      update profiles set verification_status = 'verified',
        verification_tier = case when verification_tier = 'full' or exists (
          select 1 from verification_records b where b.user_id = r.user_id and b.subject = 'business' and b.status = 'verified') then 'full' else 'partial' end
      where id = r.user_id;
    else
      update profiles set verification_tier = case when verification_status = 'verified' then 'full' else verification_tier end where id = r.user_id;
      update companies set verification_status = 'verified' where owner_id = r.user_id;
    end if;
  elsif p_status in ('rejected','expired','requires_resubmission') then
    if r.subject in ('identity','agent') then
      update profiles set verification_status = p_status, verification_tier = 'unverified' where id = r.user_id;
    else
      update profiles set verification_tier = case when verification_tier = 'full' then 'partial' else verification_tier end where id = r.user_id;
      update companies set verification_status = p_status where owner_id = r.user_id;
    end if;
  end if;
  perform write_audit('verification.outcome', 'verification_record', p_record::text, jsonb_build_object('status', p_status, 'note', p_note));
end $$;
grant execute on function set_verification_outcome(uuid, text, text) to authenticated;   -- checks has_permission itself

-- Used by the frontend admin console (api.admin.setVerification(userId, status)).
create or replace function admin_set_verification(p_user uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not has_permission('verification.review') then raise exception 'not allowed'; end if;
  if p_status not in ('verified','rejected') then raise exception 'invalid status'; end if;
  select id into rid from verification_records where user_id = p_user and subject in ('identity','agent') order by created_at desc limit 1;
  if rid is null then
    insert into verification_records(user_id, subject, status) values (p_user, 'identity', 'under_review') returning id into rid;
  end if;
  perform set_verification_outcome(rid, p_status, 'set from admin console');
end $$;
grant execute on function admin_set_verification(uuid, text) to authenticated;

-- Called from SQL by request_transaction; also by the create-transaction path. Not callable by clients.
create or replace function can_transact(p_user uuid, p_amount numeric, p_currency text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p profiles%rowtype; lim verification_limits%rowtype; used numeric;
begin
  select * into p from profiles where id = p_user;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'no profile'); end if;
  if p.account_status <> 'active' then return jsonb_build_object('allowed', false, 'reason', 'account not active'); end if;
  if p.verification_status <> 'verified' then return jsonb_build_object('allowed', false, 'reason', 'identity verification required'); end if;
  if p.verification_tier = 'full' then return jsonb_build_object('allowed', true); end if;
  select * into lim from verification_limits where tier = p.verification_tier and currency = p_currency;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'no limit configured for this currency; business verification required'); end if;
  if lim.max_transaction_amount is not null and p_amount > lim.max_transaction_amount then
    return jsonb_build_object('allowed', false, 'reason', 'above single-transaction limit for your verification level');
  end if;
  if lim.max_monthly_volume is not null then
    select coalesce(sum(goods_amount + delivery_allocation + agent_fee), 0) into used from transactions
      where (buyer_id = p_user or seller_id = p_user) and currency = p_currency
        and created_at > now() - interval '30 days' and status not in ('cancelled','refunded');
    if used + p_amount > lim.max_monthly_volume then
      return jsonb_build_object('allowed', false, 'reason', 'above 30-day volume limit for your verification level');
    end if;
  end if;
  return jsonb_build_object('allowed', true);
end $$;
revoke all on function can_transact(uuid, numeric, text) from public, anon, authenticated;
grant execute on function can_transact(uuid, numeric, text) to service_role;

-- ============================================================ agent fee negotiation
alter table fee_proposals add column if not exists parent_id uuid references fee_proposals(id);

create table if not exists fee_agreements (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references fee_proposals(id),
  buyer_agent_id uuid not null references buyer_agents(id),
  buyer_id uuid not null references profiles(id),
  agent_id uuid not null references profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null references supported_currencies(code),
  assignment_id uuid unique references assignments(id),
  agreed_at timestamptz not null default now()
);
alter table fee_agreements enable row level security;
drop policy if exists fee_agreements_read on fee_agreements;
create policy fee_agreements_read on fee_agreements for select using (buyer_id = auth.uid() or agent_id = auth.uid() or is_admin());

create or replace function fee_agreements_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'fee agreements cannot be deleted'; end if;
  if new.amount <> old.amount or new.currency <> old.currency or new.buyer_id <> old.buyer_id or new.agent_id <> old.agent_id
     or new.proposal_id <> old.proposal_id or new.agreed_at <> old.agreed_at
     or (old.assignment_id is not null and new.assignment_id is distinct from old.assignment_id) then
    raise exception 'an accepted fee cannot be changed; make a new proposal';
  end if;
  return new;
end $$;
drop trigger if exists fee_agreements_guard_trg on fee_agreements;
create trigger fee_agreements_guard_trg before update or delete on fee_agreements for each row execute function fee_agreements_guard();

create or replace function fee_proposals_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'proposals cannot be deleted'; end if;
  if old.state <> 'proposed' then raise exception 'this proposal is closed'; end if;
  if new.amount <> old.amount or new.currency <> old.currency or new.proposed_by <> old.proposed_by or new.buyer_agent_id <> old.buyer_agent_id then
    raise exception 'proposal terms are immutable';
  end if;
  return new;
end $$;
drop trigger if exists fee_proposals_guard_trg on fee_proposals;
create trigger fee_proposals_guard_trg before update or delete on fee_proposals for each row execute function fee_proposals_guard();

create or replace function propose_fee(p_buyer_agent uuid, p_amount numeric, p_currency text default 'NGN')
returns uuid language plpgsql security definer set search_path = public as $$
declare ba buyer_agents%rowtype; me uuid := auth.uid(); other uuid; pid uuid;
begin
  select * into ba from buyer_agents where id = p_buyer_agent for update;
  if not found or ba.status <> 'accepted' or ba.agent_id is null or me not in (ba.buyer_id, ba.agent_id) then raise exception 'not allowed'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if exists (select 1 from fee_proposals where buyer_agent_id = ba.id and state = 'proposed') then raise exception 'respond to the open proposal first'; end if;
  insert into fee_proposals(buyer_agent_id, proposed_by, amount, currency) values (ba.id, me, round(p_amount, 2), p_currency) returning id into pid;
  other := case when me = ba.buyer_id then ba.agent_id else ba.buyer_id end;
  insert into notifications(user_id, type, body, link) values (other, 'Agent fee proposal', 'New agent fee proposal', '/agents/' || ba.id || '/chat');
  return pid;
end $$;

create or replace function respond_fee(p_proposal uuid, p_action text, p_counter numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fp fee_proposals%rowtype; ba buyer_agents%rowtype; me uuid := auth.uid(); nid uuid;
begin
  select * into fp from fee_proposals where id = p_proposal for update;
  if not found or fp.state <> 'proposed' then raise exception 'proposal is not open'; end if;
  select * into ba from buyer_agents where id = fp.buyer_agent_id;
  if me not in (ba.buyer_id, ba.agent_id) or me = fp.proposed_by then raise exception 'not allowed'; end if;
  if p_action = 'accept' then
    update fee_proposals set state = 'accepted', responded_at = now() where id = fp.id;
    insert into fee_agreements(proposal_id, buyer_agent_id, buyer_id, agent_id, amount, currency) values (fp.id, ba.id, ba.buyer_id, ba.agent_id, fp.amount, fp.currency);
    insert into notifications(user_id, type, body, link) values (fp.proposed_by, 'Agent fee acceptance', 'Your fee proposal was accepted', '/agents/' || ba.id || '/chat');
    return jsonb_build_object('ok', true, 'state', 'accepted', 'amount', fp.amount, 'currency', fp.currency);
  elsif p_action = 'reject' then
    update fee_proposals set state = 'rejected', responded_at = now() where id = fp.id;
    return jsonb_build_object('ok', true, 'state', 'rejected');
  elsif p_action = 'counter' then
    if p_counter is null or p_counter <= 0 or round(p_counter, 2) = fp.amount then raise exception 'invalid counter amount'; end if;
    update fee_proposals set state = 'countered', responded_at = now() where id = fp.id;
    insert into fee_proposals(buyer_agent_id, proposed_by, amount, currency, parent_id) values (ba.id, me, round(p_counter, 2), fp.currency, fp.id) returning id into nid;
    insert into notifications(user_id, type, body, link) values (fp.proposed_by, 'Agent fee proposal', 'You received a counteroffer', '/agents/' || ba.id || '/chat');
    return jsonb_build_object('ok', true, 'state', 'countered', 'new_proposal', nid);
  end if;
  raise exception 'unknown action';
end $$;

revoke all on function propose_fee(uuid, numeric, text), respond_fee(uuid, text, numeric) from public, anon;
grant execute on function propose_fee(uuid, numeric, text), respond_fee(uuid, text, numeric) to authenticated;

-- ============================================================ close client access to money helpers
revoke all on function post_ledger(uuid, text, text, text, numeric, text) from public, anon, authenticated;
revoke all on function credit_wallet(uuid, numeric) from public, anon, authenticated;
alter table idempotency_keys enable row level security;   -- no policies: server only
