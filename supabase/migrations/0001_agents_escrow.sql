-- Saage Free Trade Zone: buyer-owned agents, escrow, inspection, delivery, disputes.
-- DRAFT for the backend team. Review, adapt to your existing tables, and test in a staging
-- project before using it with real money. Nothing here has been run.
--
-- Principles:
--  * Money only moves inside SECURITY DEFINER functions that read amounts from the database,
--    never from the caller. The browser cannot set an escrow balance or mark anything released.
--  * Every money movement writes append-only ledger rows (update/delete are blocked).
--  * Every financial function is idempotent (idempotency key + unique ledger references).
--  * Precise locations live in their own tables with no direct read access; they are returned
--    only by visible_locations(), which checks who is asking and whether the transaction started.

create extension if not exists pgcrypto;

do $$ begin create type user_role as enum ('buyer','seller','agent','admin'); exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null,
  full_name text,
  phone text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function app_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'admin', false)
$$;

-- ---------- buyer's own agents ----------
create table if not exists buyer_agents (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id),
  agent_id uuid references profiles(id),               -- set when the agent accepts
  invite_channel text not null check (invite_channel in ('phone','email','link')),
  invite_contact text,
  invite_token text unique default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'invited' check (status in ('invited','accepted','declined','removed')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table buyer_agents enable row level security;
create policy buyer_agents_buyer on buyer_agents for all using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy buyer_agents_agent on buyer_agents for select using (agent_id = auth.uid());
create policy buyer_agents_admin on buyer_agents for select using (is_admin());

-- ---------- private buyer <-> agent chat and fee negotiation ----------
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  buyer_agent_id uuid not null references buyer_agents(id),
  sender_id uuid not null references profiles(id) default auth.uid(),
  kind text not null check (kind in ('text','image')),
  body text,
  attachment_path text,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
-- Only the two people in the relationship (and admins). Sellers can never read this.
create policy chat_participants on chat_messages for all using (
  exists (select 1 from buyer_agents ba where ba.id = buyer_agent_id and (ba.buyer_id = auth.uid() or ba.agent_id = auth.uid()))
  or is_admin()
) with check (
  sender_id = auth.uid() and exists (select 1 from buyer_agents ba where ba.id = buyer_agent_id and (ba.buyer_id = auth.uid() or ba.agent_id = auth.uid()))
);

create table if not exists fee_proposals (
  id uuid primary key default gen_random_uuid(),
  buyer_agent_id uuid not null references buyer_agents(id),
  proposed_by uuid not null references profiles(id) default auth.uid(),
  amount numeric(14,2) not null check (amount > 0),
  state text not null default 'proposed' check (state in ('proposed','accepted','rejected','countered')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table fee_proposals enable row level security;
create policy fee_participants on fee_proposals for select using (
  exists (select 1 from buyer_agents ba where ba.id = buyer_agent_id and (ba.buyer_id = auth.uid() or ba.agent_id = auth.uid())) or is_admin());
-- Writes go through an API/RPC that checks the other party is the one responding.

-- ---------- transactions ----------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default 'TX-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('tx_ref_seq')::text, 6, '0'),
  buyer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  goods_amount numeric(14,2) not null check (goods_amount > 0),
  delivery_allocation numeric(14,2) not null default 0 check (delivery_allocation >= 0),  -- part of the seller's proceeds
  agent_fee numeric(14,2) not null default 0 check (agent_fee >= 0),
  platform_fee_pct numeric(5,2) not null,                -- copied from settings when the terms are agreed
  status text not null default 'request_sent',
  inspection_required boolean not null default true,
  hold boolean not null default false,
  started_at timestamptz,                                -- set when escrow is funded: unlocks locations
  inspection_approved_at timestamptz,
  delivery_arrived_at timestamptz,
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  agent_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create sequence if not exists tx_ref_seq;
alter table transactions enable row level security;
create policy tx_parties on transactions for select using (buyer_id = auth.uid() or seller_id = auth.uid() or is_admin());
-- No insert/update policies for clients: changes go through functions that validate the state machine.

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default 'ASG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('asg_ref_seq')::text, 6, '0'),
  buyer_id uuid not null references profiles(id),
  agent_id uuid not null references profiles(id),
  transaction_id uuid references transactions(id),
  kind text not null,
  description text not null,
  seller_name text,
  goods text,
  inspection_deadline date,
  agreed_fee numeric(14,2),
  fee_proposal_id uuid references fee_proposals(id),
  status text not null default 'Pending' check (status in ('Pending','Accepted','In Progress','Inspection Completed','Approved','Rejected','Cancelled')),
  created_at timestamptz not null default now()
);
create sequence if not exists asg_ref_seq;
alter table assignments enable row level security;
create policy asg_buyer on assignments for all using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy asg_agent on assignments for select using (agent_id = auth.uid());
create policy asg_admin on assignments for select using (is_admin());

-- ---------- precise locations (never readable directly) ----------
create table if not exists party_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) default auth.uid(),
  transaction_id uuid references transactions(id),
  assignment_id uuid references assignments(id),
  kind text not null,                                    -- warehouse | factory | collection | delivery | inspection
  precise text not null,
  approx text not null,                                  -- general area, safe to show anyone involved
  created_at timestamptz not null default now()
);
alter table party_locations enable row level security;
create policy loc_owner on party_locations for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- The only way another user gets a precise location. Returns the approximate area until the
-- transaction has started and the caller is someone who needs the precise one.
create or replace function visible_locations(p_tx uuid)
returns table (kind text, location text, precise_visible boolean) language plpgsql stable security definer set search_path = public as $$
declare t transactions%rowtype; me uuid := auth.uid(); my_assignment boolean;
begin
  select * into t from transactions where id = p_tx;
  if not found then return; end if;
  select exists (select 1 from assignments a where a.transaction_id = p_tx and a.agent_id = me and a.status <> 'Pending' and a.status <> 'Cancelled') into my_assignment;
  if not (t.buyer_id = me or t.seller_id = me or my_assignment or is_admin()) then return; end if;
  return query
    select l.kind,
           case when l.owner_id = me or is_admin() then l.precise
                when t.started_at is not null and (
                       (l.kind in ('warehouse','factory','collection','inspection') and (t.buyer_id = me or my_assignment))
                    or (l.kind = 'delivery' and (t.seller_id = me and t.inspection_approved_at is not null or my_assignment and t.inspection_approved_at is not null))
                ) then l.precise
                else l.approx end,
           (l.owner_id = me or is_admin() or (t.started_at is not null))
    from party_locations l where l.transaction_id = p_tx;
end $$;

-- ---------- money ----------
create table if not exists wallets (user_id uuid primary key references profiles(id), available numeric(14,2) not null default 0 check (available >= 0));
alter table wallets enable row level security;
create policy wallet_owner on wallets for select using (user_id = auth.uid() or is_admin());

create table if not exists escrow_accounts (
  transaction_id uuid primary key references transactions(id),
  funded numeric(14,2) not null,
  goods_reserved numeric(14,2) not null,
  delivery_reserved numeric(14,2) not null,
  agent_reserved numeric(14,2) not null,                  -- kept apart so the seller's payment cannot consume it
  released boolean not null default false,
  refunded boolean not null default false,
  payment_ref text unique not null                        -- provider reference from the verified payment
);
alter table escrow_accounts enable row level security;
create policy escrow_parties on escrow_accounts for select using (
  exists (select 1 from transactions t where t.id = transaction_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())) or is_admin());

create table if not exists ledger_entries (
  id bigserial primary key,
  ref text unique not null,                               -- unique financial reference: duplicates are impossible
  transaction_id uuid references transactions(id),
  account text not null,                                  -- buyer | seller | agent | platform | escrow
  direction text not null check (direction in ('credit','debit','reserve','release')),
  amount numeric(14,2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);
alter table ledger_entries enable row level security;
create policy ledger_admin on ledger_entries for select using (is_admin());
create or replace function ledger_immutable() returns trigger language plpgsql as $$ begin raise exception 'ledger_entries is append-only'; end $$;
drop trigger if exists ledger_no_change on ledger_entries;
create trigger ledger_no_change before update or delete on ledger_entries for each row execute function ledger_immutable();
revoke update, delete, truncate on ledger_entries from public, anon, authenticated;

create table if not exists idempotency_keys (key text primary key, endpoint text not null, response jsonb not null, created_at timestamptz not null default now());

create or replace function post_ledger(p_tx uuid, p_ref text, p_account text, p_dir text, p_amount numeric, p_note text) returns void language sql as $$
  insert into ledger_entries(ref, transaction_id, account, direction, amount, note) values (p_ref, p_tx, p_account, p_dir, p_amount, p_note) on conflict (ref) do nothing
$$;
create or replace function credit_wallet(p_user uuid, p_amount numeric) returns void language sql as $$
  insert into wallets(user_id, available) values (p_user, p_amount) on conflict (user_id) do update set available = wallets.available + excluded.available
$$;

-- Called ONLY by the payment webhook (service role) after the provider confirms the payment.
create or replace function fund_escrow(p_tx uuid, p_key text, p_payment_ref text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; prior jsonb; total numeric(14,2); n text; res jsonb;
begin
  select response into prior from idempotency_keys where key = p_key; if found then return prior; end if;
  select * into t from transactions where id = p_tx for update;
  if not found or t.status <> 'terms_agreed' then raise exception 'transaction is not ready to fund'; end if;
  total := t.goods_amount + t.delivery_allocation + t.agent_fee;      -- amounts come from the row, not the caller
  insert into escrow_accounts(transaction_id, funded, goods_reserved, delivery_reserved, agent_reserved, payment_ref)
    values (p_tx, total, t.goods_amount, t.delivery_allocation, t.agent_fee, p_payment_ref);
  n := t.ref;
  perform post_ledger(p_tx, 'FIN-' || n || '-FUND', 'buyer', 'debit', total, 'Escrow funded');
  perform post_ledger(p_tx, 'FIN-' || n || '-RES-GOODS', 'escrow', 'reserve', t.goods_amount, 'Goods payment');
  perform post_ledger(p_tx, 'FIN-' || n || '-RES-DELIV', 'escrow', 'reserve', t.delivery_allocation, 'Delivery allocation');
  perform post_ledger(p_tx, 'FIN-' || n || '-RES-AGENT', 'escrow', 'reserve', t.agent_fee, 'Agent fee (separate)');
  update transactions set status = 'escrow_funded', started_at = now() where id = p_tx;
  res := jsonb_build_object('ok', true, 'transaction', p_tx);
  insert into idempotency_keys(key, endpoint, response) values (p_key, 'fund_escrow', res);
  return res;
end $$;

-- Pays the agent once the buyer has approved the work. Same reference as release_escrow uses,
-- so the agent can never be paid twice.
create or replace function release_agent_fee(p_assignment uuid, p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare a assignments%rowtype; t transactions%rowtype; e escrow_accounts%rowtype; prior jsonb; res jsonb;
begin
  select response into prior from idempotency_keys where key = p_key; if found then return prior; end if;
  select * into a from assignments where id = p_assignment for update;
  if not found or a.status <> 'Approved' then raise exception 'assignment is not approved by the buyer'; end if;
  select * into t from transactions where id = a.transaction_id for update;
  select * into e from escrow_accounts where transaction_id = t.id for update;
  if not found or e.refunded then raise exception 'no secured fee to release'; end if;
  if not exists (select 1 from ledger_entries where ref = 'FIN-' || t.ref || '-AGENT') then
    perform post_ledger(t.id, 'FIN-' || t.ref || '-AGENT', 'agent', 'release', e.agent_reserved, 'Agent fee released');
    perform credit_wallet(a.agent_id, e.agent_reserved);
  end if;
  res := jsonb_build_object('ok', true);
  insert into idempotency_keys(key, endpoint, response) values (p_key, 'release_agent_fee', res);
  return res;
end $$;

-- Atomic, idempotent release of the goods + delivery proceeds. Runs only when every condition holds.
create or replace function release_escrow(p_tx uuid, p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; e escrow_accounts%rowtype; a assignments%rowtype; prior jsonb; fee numeric(14,2); net numeric(14,2); res jsonb;
begin
  select response into prior from idempotency_keys where key = p_key; if found then return prior; end if;
  select * into t from transactions where id = p_tx for update;
  select * into e from escrow_accounts where transaction_id = p_tx for update;
  if not found or e.released or e.refunded then raise exception 'escrow cannot be released'; end if;
  if t.hold then raise exception 'transaction is on hold'; end if;
  if t.inspection_required and t.inspection_approved_at is null then raise exception 'inspection not approved'; end if;
  if t.delivery_arrived_at is null then raise exception 'goods have not arrived'; end if;
  if t.buyer_confirmed_at is null or t.seller_confirmed_at is null then raise exception 'both confirmations are required'; end if;
  fee := round((e.goods_reserved + e.delivery_reserved) * t.platform_fee_pct / 100, 2);
  net := e.goods_reserved + e.delivery_reserved - fee;
  perform post_ledger(p_tx, 'FIN-' || t.ref || '-SELLER', 'seller', 'release', net, 'Goods + delivery, net of platform fee');
  perform post_ledger(p_tx, 'FIN-' || t.ref || '-PLATFORM', 'platform', 'credit', fee, 'Platform fee');
  perform credit_wallet(t.seller_id, net);
  select * into a from assignments where transaction_id = p_tx order by created_at limit 1;
  if found and e.agent_reserved > 0 and not exists (select 1 from ledger_entries where ref = 'FIN-' || t.ref || '-AGENT') then
    perform post_ledger(p_tx, 'FIN-' || t.ref || '-AGENT', 'agent', 'release', e.agent_reserved, 'Agent fee released');
    perform credit_wallet(a.agent_id, e.agent_reserved);
  end if;
  update escrow_accounts set released = true where transaction_id = p_tx;
  update transactions set status = 'completed' where id = p_tx;
  res := jsonb_build_object('ok', true, 'seller_net', net, 'platform_fee', fee);
  insert into idempotency_keys(key, endpoint, response) values (p_key, 'release_escrow', res);
  return res;
end $$;

-- Buyer / seller / agent confirmation. Releases funds automatically once both required confirmations exist.
create or replace function confirm_transaction(p_tx uuid, p_as text, p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype;
begin
  select * into t from transactions where id = p_tx for update;
  if not found or t.delivery_arrived_at is null then raise exception 'goods have not arrived'; end if;
  if p_as = 'buyer' and t.buyer_id = auth.uid() then update transactions set buyer_confirmed_at = coalesce(buyer_confirmed_at, now()) where id = p_tx;
  elsif p_as = 'seller' and t.seller_id = auth.uid() then update transactions set seller_confirmed_at = coalesce(seller_confirmed_at, now()) where id = p_tx;
  elsif p_as = 'agent' and exists (select 1 from assignments a where a.transaction_id = p_tx and a.agent_id = auth.uid()) then update transactions set agent_confirmed_at = coalesce(agent_confirmed_at, now()) where id = p_tx;
  else raise exception 'not allowed'; end if;
  select * into t from transactions where id = p_tx;
  if t.buyer_confirmed_at is not null and t.seller_confirmed_at is not null and not t.hold then perform release_escrow(p_tx, 'auto-release-' || p_tx::text); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- disputes and refunds ----------
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default 'DSP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('dsp_ref_seq')::text, 6, '0'),
  transaction_id uuid not null references transactions(id),
  opened_by uuid not null references profiles(id) default auth.uid(),
  type text not null,
  description text not null,
  refund_requested boolean not null default false,
  status text not null default 'open' check (status in ('open','investigating','resolved')),
  outcome text check (outcome in ('refund_buyer','release_to_seller','reject_dispute')),
  created_at timestamptz not null default now()
);
create sequence if not exists dsp_ref_seq;
alter table disputes enable row level security;
create policy disputes_parties on disputes for select using (
  exists (select 1 from transactions t where t.id = transaction_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())) or is_admin());

-- Opening a dispute only places a HOLD. It never refunds anything by itself.
create or replace function open_dispute(p_tx uuid, p_type text, p_text text, p_refund boolean) returns uuid language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; d uuid;
begin
  select * into t from transactions where id = p_tx for update;
  if not found or (t.buyer_id <> auth.uid() and t.seller_id <> auth.uid()) then raise exception 'not allowed'; end if;
  insert into disputes(transaction_id, type, description, refund_requested) values (p_tx, p_type, p_text, p_refund) returning id into d;
  update transactions set hold = true where id = p_tx;
  return d;
end $$;

-- Admin-only refund after a resolved dispute. Agent fee for completed inspection work is still paid.
create or replace function refund_escrow(p_tx uuid, p_key text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; e escrow_accounts%rowtype; a assignments%rowtype; prior jsonb; back numeric(14,2); res jsonb;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select response into prior from idempotency_keys where key = p_key; if found then return prior; end if;
  select * into t from transactions where id = p_tx for update;
  select * into e from escrow_accounts where transaction_id = p_tx for update;
  if not found or e.released or e.refunded then raise exception 'escrow cannot be refunded'; end if;
  back := e.goods_reserved + e.delivery_reserved;
  select * into a from assignments where transaction_id = p_tx and status in ('Inspection Completed','Approved') order by created_at limit 1;
  if found then
    perform post_ledger(p_tx, 'FIN-' || t.ref || '-AGENT', 'agent', 'release', e.agent_reserved, 'Agent fee for completed inspection');
    perform credit_wallet(a.agent_id, e.agent_reserved);
  else back := back + e.agent_reserved; end if;
  perform post_ledger(p_tx, 'FIN-' || t.ref || '-REFUND', 'buyer', 'credit', back, coalesce(p_note, 'Refund'));
  perform credit_wallet(t.buyer_id, back);
  update escrow_accounts set refunded = true where transaction_id = p_tx;
  update transactions set status = 'refunded', hold = false where id = p_tx;
  res := jsonb_build_object('ok', true, 'refunded', back);
  insert into idempotency_keys(key, endpoint, response) values (p_key, 'refund_escrow', res);
  return res;
end $$;

-- ---------- reviews and notifications ----------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id),
  reviewer_id uuid not null references profiles(id) default auth.uid(),
  target_id uuid not null references profiles(id),
  stars int not null check (stars between 1 and 5),
  body text not null,
  created_at timestamptz not null default now(),
  unique (transaction_id, reviewer_id, target_id)
);
alter table reviews enable row level security;
create policy reviews_read on reviews for select using (true);
-- Insert only through a function that checks the transaction is completed and the reviewer took part in it.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  type text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create policy notes_owner on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lock down the money functions: only the service role (server) may call them directly.
revoke all on function fund_escrow(uuid, text, text), release_escrow(uuid, text), release_agent_fee(uuid, text), refund_escrow(uuid, text, text) from public, anon, authenticated;
grant execute on function fund_escrow(uuid, text, text), release_escrow(uuid, text), release_agent_fee(uuid, text) to service_role;
grant execute on function refund_escrow(uuid, text, text) to authenticated; -- the function itself checks is_admin()
grant execute on function confirm_transaction(uuid, text, text), open_dispute(uuid, text, text, boolean), visible_locations(uuid) to authenticated;
