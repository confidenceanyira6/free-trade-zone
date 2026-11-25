-- Saage Free Trade Zone, migration 0003: marketplace, transaction flow, payments, delivery, disputes, storage.
-- NOT RUN. Depends on 0001 and 0002. Apply to staging first.
-- Every function is SECURITY DEFINER, checks auth.uid() itself, and is called by the `api` Edge Function
-- with the caller's own JWT, so the database (not the function code) is the authority.

create or replace function notify_user(u uuid, t text, b text, l text) returns void language sql security definer set search_path = public as $$
  insert into notifications(user_id, type, body, link) values (u, t, b, l)
$$;
revoke all on function notify_user(uuid, text, text, text) from public, anon, authenticated;

create or replace function safe_uuid(t text) returns uuid language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- ============================================================ settings, rate limits
create table if not exists platform_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
-- escrow_enabled stays false until a provider that can lawfully hold funds is contracted. While false, no payment can be started.
insert into platform_settings(key, value) values ('platform_fee_pct', '2.5'), ('escrow_enabled', 'false') on conflict do nothing;
alter table platform_settings enable row level security;
drop policy if exists settings_read on platform_settings;
create policy settings_read on platform_settings for select to authenticated using (true);
create or replace function setting_num(k text) returns numeric language sql stable security definer set search_path = public as $$
  select (value #>> '{}')::numeric from platform_settings where key = k
$$;
create or replace function setting_bool(k text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from platform_settings where key = k), false)
$$;

create table if not exists rate_limits (key text not null, window_start timestamptz not null, hits int not null default 1, primary key (key, window_start));
alter table rate_limits enable row level security;
create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int) returns boolean language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds); n int;
begin
  insert into rate_limits(key, window_start) values (p_key, w) on conflict (key, window_start) do update set hits = rate_limits.hits + 1 returning hits into n;
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  return n <= p_limit;
end $$;
revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

-- ============================================================ marketplace
create table if not exists units (code text primary key, name text not null);
insert into units(code, name) values ('kg','Kilograms (kg)'),('t','Metric tonnes'),('L','Litres'),('m3','Cubic metres (m3)'),('pcs','Pieces'),('bag','Bags'),('container','Containers') on conflict do nothing;
create table if not exists product_categories (slug text primary key, name text not null, sort int not null default 0);
insert into product_categories(slug, name, sort) values
  ('timber','Timber',1),('oil','Red palm oil',2),('rubber','Rubber',3),('charcoal','Charcoal',4),('cocoa','Cocoa',5),('coffee','Coffee',6),
  ('grain','Grains and agricultural',7),('garri','Garri',8),('fibre','Fibre',9),('industrial','Industrial raw materials',10),
  ('machinery','Machinery',11),('manufacturing','Manufacturing materials',12),('other','Other bulk commodities',13) on conflict do nothing;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) default auth.uid(),
  kind text not null references product_categories(slug),
  name text not null check (length(name) between 3 and 200),
  description text,
  unit text not null references units(code),
  price numeric(18,2) not null check (price > 0),
  currency text not null default 'NGN' references supported_currencies(code),
  min_qty numeric(18,3) not null default 1 check (min_qty > 0),
  max_qty numeric(18,3),
  step_qty numeric(18,3) not null default 1 check (step_qty > 0),
  stock_qty numeric(18,3) not null default 0 check (stock_qty >= 0),
  reserved_qty numeric(18,3) not null default 0 check (reserved_qty >= 0),
  grade text,
  specs jsonb not null default '{}'::jsonb,
  origin_country char(2),
  delivery_available boolean not null default true,
  image_paths text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','active','paused','sold_out','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_qty <= stock_qty),
  check (max_qty is null or max_qty >= min_qty)
);
create index if not exists products_listing_idx on products (status, kind, created_at desc);
create index if not exists products_seller_idx on products (seller_id);
create index if not exists products_country_idx on products (origin_country) where status = 'active';

create table if not exists product_price_history (id bigserial primary key, product_id uuid not null references products(id), old_price numeric(18,2), new_price numeric(18,2) not null, currency text not null, changed_by uuid, changed_at timestamptz not null default now());
create table if not exists product_status_history (id bigserial primary key, product_id uuid not null references products(id), old_status text, new_status text not null, changed_by uuid, changed_at timestamptz not null default now());
create table if not exists inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  transaction_id uuid not null references transactions(id),
  qty numeric(18,3) not null check (qty > 0),
  status text not null default 'active' check (status in ('active','committed','released')),
  created_at timestamptz not null default now(),
  unique (product_id, transaction_id)
);

create or replace function products_guard() returns trigger language plpgsql as $$
declare v text;
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' then new.reserved_qty := 0; end if;
    if tg_op = 'UPDATE' and (new.reserved_qty is distinct from old.reserved_qty or new.seller_id is distinct from old.seller_id) then
      raise exception 'protected product field';
    end if;
    if new.status = 'active' and not has_permission('marketplace.moderate') then
      select verification_status into v from profiles where id = new.seller_id;
      if v is distinct from 'verified' then raise exception 'complete identity verification before publishing a listing'; end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists products_guard_trg on products;
create trigger products_guard_trg before insert or update on products for each row execute function products_guard();

create or replace function products_history() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into product_status_history(product_id, old_status, new_status, changed_by) values (new.id, null, new.status, auth.uid());
    insert into product_price_history(product_id, old_price, new_price, currency, changed_by) values (new.id, null, new.price, new.currency, auth.uid());
  else
    if new.status is distinct from old.status then insert into product_status_history(product_id, old_status, new_status, changed_by) values (new.id, old.status, new.status, auth.uid()); end if;
    if new.price is distinct from old.price then insert into product_price_history(product_id, old_price, new_price, currency, changed_by) values (new.id, old.price, new.price, new.currency, auth.uid()); end if;
  end if;
  return new;
end $$;
drop trigger if exists products_history_trg on products;
create trigger products_history_trg after insert or update on products for each row execute function products_history();

do $$ declare t text; begin
  foreach t in array array['units','product_categories','products','product_price_history','product_status_history','inventory_reservations'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
drop policy if exists units_read on units;
create policy units_read on units for select using (true);
drop policy if exists categories_read on product_categories;
create policy categories_read on product_categories for select using (true);
drop policy if exists products_read on products;
create policy products_read on products for select using (status = 'active' or seller_id = auth.uid() or has_permission('marketplace.moderate'));
drop policy if exists products_insert on products;
create policy products_insert on products for insert to authenticated with check (seller_id = auth.uid() and app_role() = 'seller');
drop policy if exists products_update on products;
create policy products_update on products for update to authenticated using (seller_id = auth.uid() or has_permission('marketplace.moderate')) with check (seller_id = auth.uid() or has_permission('marketplace.moderate'));
drop policy if exists price_hist_read on product_price_history;
create policy price_hist_read on product_price_history for select using (exists (select 1 from products p where p.id = product_id and (p.seller_id = auth.uid() or has_permission('marketplace.moderate'))));
drop policy if exists status_hist_read on product_status_history;
create policy status_hist_read on product_status_history for select using (exists (select 1 from products p where p.id = product_id and (p.seller_id = auth.uid() or has_permission('marketplace.moderate'))));
drop policy if exists reservations_read on inventory_reservations;
create policy reservations_read on inventory_reservations for select using (exists (select 1 from products p where p.id = product_id and p.seller_id = auth.uid()) or is_admin());
-- No delete policy: listings are retired by setting status = 'removed'. reserved_qty is server-only.

-- Public listing view used by the Marketplace screen. Shows no private coordinates (those live in party_locations only).
create or replace view marketplace_products as
  select p.id, p.name, p.kind, p.description, p.unit, u.name as unit_name, p.price, p.currency, p.min_qty, p.max_qty, p.step_qty,
         (p.stock_qty - p.reserved_qty) as available_qty, p.grade, p.specs, p.origin_country, p.delivery_available, p.image_paths, p.created_at,
         p.seller_id, coalesce((select c.name from companies c where c.owner_id = p.seller_id order by c.created_at limit 1), pr.full_name) as seller_name,
         pr.verification_tier as seller_tier
  from products p join profiles pr on pr.id = p.seller_id join units u on u.code = p.unit
  where p.status = 'active' and pr.account_status = 'active';
grant select on marketplace_products to anon, authenticated;

create or replace function reserve_inventory(p_product uuid, p_qty numeric, p_tx uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update products set reserved_qty = reserved_qty + p_qty where id = p_product and stock_qty - reserved_qty >= p_qty;
  if not found then raise exception 'not enough stock'; end if;
  insert into inventory_reservations(product_id, transaction_id, qty) values (p_product, p_tx, p_qty);
end $$;
create or replace function release_inventory(p_tx uuid) returns void language plpgsql security definer set search_path = public as $$
declare r inventory_reservations%rowtype;
begin
  for r in select * from inventory_reservations where transaction_id = p_tx and status = 'active' for update loop
    update products set reserved_qty = reserved_qty - r.qty where id = r.product_id;
    update inventory_reservations set status = 'released' where id = r.id;
  end loop;
end $$;
create or replace function commit_inventory(p_tx uuid) returns void language plpgsql security definer set search_path = public as $$
declare r inventory_reservations%rowtype;
begin
  for r in select * from inventory_reservations where transaction_id = p_tx and status = 'active' for update loop
    update products set reserved_qty = reserved_qty - r.qty, stock_qty = stock_qty - r.qty where id = r.product_id;
    update inventory_reservations set status = 'committed' where id = r.id;
  end loop;
end $$;
revoke all on function reserve_inventory(uuid, numeric, uuid), release_inventory(uuid), commit_inventory(uuid) from public, anon, authenticated;

-- ============================================================ transaction negotiation, terms, events
alter table transactions add column if not exists product_id uuid references products(id);
alter table transactions add column if not exists quantity numeric(18,3);
alter table transactions add column if not exists unit_price numeric(18,2);
alter table transactions add column if not exists fee_agreement_id uuid references fee_agreements(id);
alter table transactions add column if not exists required_delivery_date date;
alter table transactions add column if not exists fee_rule jsonb;
alter table transactions add column if not exists cancelled_at timestamptz;
do $$ begin
  alter table transactions add constraint tx_status_chk check (status in ('request_sent','negotiating','terms_agreed','payment_pending','escrow_funded',
    'inspection_in_progress','inspection_report_ready','inspection_approved','dispatched','in_transit','arrived','completed','refunded','cancelled')) not valid;
exception when duplicate_object then null; end $$;
create index if not exists transactions_buyer_idx on transactions (buyer_id, created_at desc);
create index if not exists transactions_seller_idx on transactions (seller_id, created_at desc);

create table if not exists transaction_terms (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id),
  version int not null,
  proposed_by uuid not null references profiles(id),
  quantity numeric(18,3) not null check (quantity > 0),
  goods_amount numeric(18,2) not null check (goods_amount > 0),
  delivery_allocation numeric(18,2) not null default 0 check (delivery_allocation >= 0),
  delivery_date date, payment_terms text, note text,
  inspection_required boolean not null default true,
  state text not null default 'proposed' check (state in ('proposed','accepted','countered','rejected')),
  created_at timestamptz not null default now(),
  unique (transaction_id, version)
);
create table if not exists transaction_agreements (
  transaction_id uuid primary key references transactions(id),
  terms_id uuid not null unique references transaction_terms(id),
  quantity numeric(18,3) not null, goods_amount numeric(18,2) not null, delivery_allocation numeric(18,2) not null,
  agent_fee numeric(14,2) not null, currency text not null, platform_fee_pct numeric(5,2) not null,
  fee_rule jsonb, inspection_required boolean not null,
  accepted_by_buyer_at timestamptz not null default now(), accepted_by_seller_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
drop trigger if exists agreements_immutable on transaction_agreements;
create trigger agreements_immutable before update or delete on transaction_agreements for each row execute function append_only();

create table if not exists transaction_events (
  id bigserial primary key,
  transaction_id uuid not null references transactions(id),
  actor_id uuid, event text not null, from_status text, to_status text, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists transaction_events_tx_idx on transaction_events (transaction_id, created_at);
drop trigger if exists tx_events_immutable on transaction_events;
create trigger tx_events_immutable before update or delete on transaction_events for each row execute function append_only();
revoke update, delete, truncate on transaction_events, transaction_agreements from public, anon, authenticated;

create or replace function tx_log(p_tx uuid, p_event text, p_from text, p_to text, p_details jsonb) returns void language sql security definer set search_path = public as $$
  insert into transaction_events(transaction_id, actor_id, event, from_status, to_status, details) values (p_tx, auth.uid(), p_event, p_from, p_to, coalesce(p_details, '{}'::jsonb))
$$;
revoke all on function tx_log(uuid, text, text, text, jsonb) from public, anon, authenticated;

alter table transaction_terms enable row level security;
alter table transaction_agreements enable row level security;
alter table transaction_events enable row level security;
drop policy if exists terms_parties on transaction_terms;
create policy terms_parties on transaction_terms for select using (exists (select 1 from transactions t where t.id = transaction_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())) or is_admin());
drop policy if exists agreements_parties on transaction_agreements;
create policy agreements_parties on transaction_agreements for select using (exists (select 1 from transactions t where t.id = transaction_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())) or is_admin());
drop policy if exists events_parties on transaction_events;
create policy events_parties on transaction_events for select using (exists (select 1 from transactions t where t.id = transaction_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())) or is_admin());

create or replace function request_transaction(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); prod products%rowtype; q numeric; goods numeric(18,2); deliv numeric(18,2); fee numeric(14,2) := 0;
        fa fee_agreements%rowtype; chk jsonb; tid uuid; tref text; pct numeric := setting_num('platform_fee_pct');
begin
  if me is null or app_role() <> 'buyer' then raise exception 'only buyers can request a purchase'; end if;
  select * into prod from products where id = safe_uuid(p->>'productId') and status = 'active';
  if not found then raise exception 'product is not available'; end if;
  if prod.seller_id = me then raise exception 'you cannot buy your own listing'; end if;
  q := (p->>'quantity')::numeric;
  if q is null or q < prod.min_qty or (prod.max_qty is not null and q > prod.max_qty) or q > prod.stock_qty - prod.reserved_qty then
    raise exception 'quantity is outside the allowed range or not in stock';
  end if;
  goods := round(prod.price * q, 2);
  deliv := coalesce(round((p->>'deliveryAllocation')::numeric, 2), 0);
  if deliv < 0 then raise exception 'delivery amount cannot be negative'; end if;
  if nullif(p->>'feeAgreementId', '') is not null then
    select * into fa from fee_agreements f where f.id = safe_uuid(p->>'feeAgreementId') and f.buyer_id = me and f.assignment_id is null and f.currency = prod.currency
      and not exists (select 1 from transactions x where x.fee_agreement_id = f.id and x.status not in ('cancelled','refunded'));
    if not found then raise exception 'that agent fee agreement is not available for this purchase'; end if;
    fee := fa.amount;
  end if;
  chk := can_transact(me, goods + deliv + fee, prod.currency);
  if not (chk->>'allowed')::boolean then raise exception '%', chk->>'reason'; end if;
  chk := can_transact(prod.seller_id, goods + deliv, prod.currency);
  if not (chk->>'allowed')::boolean then raise exception 'this seller cannot accept an order of this size yet'; end if;
  insert into transactions(buyer_id, seller_id, goods_amount, delivery_allocation, agent_fee, platform_fee_pct, currency, product_id, quantity, unit_price,
                           fee_agreement_id, required_delivery_date, inspection_required, fee_rule, status)
  values (me, prod.seller_id, goods, deliv, fee, pct, prod.currency, prod.id, q, prod.price, fa.id, nullif(p->>'deliveryDate', '')::date,
          coalesce((p->>'inspectionRequired')::boolean, true), jsonb_build_object('type', 'percent_of_seller_proceeds', 'pct', pct, 'source', 'platform_settings'), 'request_sent')
  returning id, ref into tid, tref;
  insert into transaction_terms(transaction_id, version, proposed_by, quantity, goods_amount, delivery_allocation, delivery_date, inspection_required, note)
  values (tid, 1, me, q, goods, deliv, nullif(p->>'deliveryDate', '')::date, coalesce((p->>'inspectionRequired')::boolean, true), p->>'note');
  if nullif(p->>'destinationPrecise', '') is not null then
    insert into party_locations(owner_id, transaction_id, kind, precise, approx) values (me, tid, 'delivery', p->>'destinationPrecise', coalesce(nullif(p->>'destinationApprox', ''), 'Area not given'));
  end if;
  perform tx_log(tid, 'requested', null, 'request_sent', jsonb_build_object('goods', goods, 'delivery', deliv, 'agent_fee', fee));
  perform notify_user(prod.seller_id, 'Transaction request', 'New request for ' || prod.name, '/transactions/' || tid);
  return jsonb_build_object('id', tid, 'ref', tref, 'goods_amount', goods, 'delivery_allocation', deliv, 'agent_fee', fee, 'currency', prod.currency, 'platform_fee_pct', pct);
end $$;

create or replace function respond_transaction(p_tx uuid, p_action text, p_terms jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t transactions%rowtype; lt transaction_terms%rowtype; chk jsonb; other uuid; nv int; q numeric; g numeric; d numeric;
begin
  select * into t from transactions where id = p_tx for update;
  if not found or me not in (t.buyer_id, t.seller_id) then raise exception 'not allowed'; end if;
  if t.status not in ('request_sent','negotiating') then raise exception 'terms can no longer be changed here'; end if;
  other := case when me = t.buyer_id then t.seller_id else t.buyer_id end;
  select * into lt from transaction_terms where transaction_id = p_tx and state = 'proposed' order by version desc limit 1;
  if not found then raise exception 'there is no open proposal'; end if;
  if lt.proposed_by = me then raise exception 'waiting for the other party to respond'; end if;

  if p_action = 'accept' then
    chk := can_transact(t.buyer_id, lt.goods_amount + lt.delivery_allocation + t.agent_fee, t.currency);
    if not (chk->>'allowed')::boolean then raise exception '%', chk->>'reason'; end if;
    chk := can_transact(t.seller_id, lt.goods_amount + lt.delivery_allocation, t.currency);
    if not (chk->>'allowed')::boolean then raise exception 'seller limit: %', chk->>'reason'; end if;
    perform reserve_inventory(t.product_id, lt.quantity, p_tx);
    update transaction_terms set state = 'accepted' where id = lt.id;
    update transactions set goods_amount = lt.goods_amount, delivery_allocation = lt.delivery_allocation, quantity = lt.quantity,
           inspection_required = lt.inspection_required, required_delivery_date = lt.delivery_date, status = 'terms_agreed' where id = p_tx;
    insert into transaction_agreements(transaction_id, terms_id, quantity, goods_amount, delivery_allocation, agent_fee, currency, platform_fee_pct, fee_rule, inspection_required)
    values (p_tx, lt.id, lt.quantity, lt.goods_amount, lt.delivery_allocation, t.agent_fee, t.currency, t.platform_fee_pct, t.fee_rule, lt.inspection_required);
    perform tx_log(p_tx, 'terms_agreed', t.status, 'terms_agreed', jsonb_build_object('terms_version', lt.version));
    perform notify_user(other, 'Seller acceptance', 'Terms agreed for ' || t.ref, '/transactions/' || p_tx);
    return jsonb_build_object('ok', true, 'status', 'terms_agreed');
  elsif p_action = 'negotiate' then
    q := coalesce((p_terms->>'quantity')::numeric, lt.quantity);
    g := coalesce((p_terms->>'goodsAmount')::numeric, lt.goods_amount);
    d := coalesce((p_terms->>'deliveryAllocation')::numeric, lt.delivery_allocation);
    if q <= 0 or g <= 0 or d < 0 then raise exception 'invalid terms'; end if;
    update transaction_terms set state = 'countered' where id = lt.id;
    nv := lt.version + 1;
    insert into transaction_terms(transaction_id, version, proposed_by, quantity, goods_amount, delivery_allocation, delivery_date, payment_terms, note, inspection_required)
    values (p_tx, nv, me, q, round(g, 2), round(d, 2), coalesce(nullif(p_terms->>'deliveryDate', '')::date, lt.delivery_date), p_terms->>'paymentTerms', p_terms->>'note',
            coalesce((p_terms->>'inspectionRequired')::boolean, lt.inspection_required));
    update transactions set status = 'negotiating' where id = p_tx;
    perform tx_log(p_tx, 'counter_proposed', t.status, 'negotiating', jsonb_build_object('version', nv));
    perform notify_user(other, 'Negotiation update', 'New terms proposed for ' || t.ref, '/transactions/' || p_tx);
    return jsonb_build_object('ok', true, 'status', 'negotiating', 'version', nv);
  elsif p_action = 'reject' then
    update transaction_terms set state = 'rejected' where id = lt.id;
    update transactions set status = 'cancelled', cancelled_at = now() where id = p_tx;
    perform tx_log(p_tx, 'rejected', t.status, 'cancelled', '{}'::jsonb);
    perform notify_user(other, 'Negotiation update', 'The request ' || t.ref || ' was declined', '/transactions/' || p_tx);
    return jsonb_build_object('ok', true, 'status', 'cancelled');
  end if;
  raise exception 'unknown action';
end $$;

create or replace function cancel_transaction(p_tx uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t transactions%rowtype;
begin
  select * into t from transactions where id = p_tx for update;
  if not found or me not in (t.buyer_id, t.seller_id) then raise exception 'not allowed'; end if;
  if t.status not in ('request_sent','negotiating','terms_agreed','payment_pending') then
    raise exception 'a funded transaction cannot be cancelled here; open a dispute or contact support';
  end if;
  perform release_inventory(p_tx);
  update payment_intents set status = 'expired' where transaction_id = p_tx and status in ('created','pending');
  update transactions set status = 'cancelled', cancelled_at = now() where id = p_tx;
  perform tx_log(p_tx, 'cancelled', t.status, 'cancelled', '{}'::jsonb);
  perform notify_user(case when me = t.buyer_id then t.seller_id else t.buyer_id end, 'Negotiation update', t.ref || ' was cancelled', '/transactions/' || p_tx);
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================ payments (provider-verified only)
create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  transaction_id uuid not null references transactions(id),
  user_id uuid not null references profiles(id),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null references supported_currencies(code),
  provider text not null default 'flutterwave',
  provider_ref text,
  idempotency_key text unique,
  status text not null default 'created' check (status in ('created','pending','verified','failed','expired','mismatch')),
  checkout_url text, failure_reason text,
  created_at timestamptz not null default now(), verified_at timestamptz
);
create index if not exists payment_intents_tx_idx on payment_intents (transaction_id);
create table if not exists payment_records (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references payment_intents(id),
  transaction_id uuid not null references transactions(id),
  provider text not null, provider_ref text not null,
  amount numeric(18,2) not null, currency text not null, status text not null,
  raw jsonb, created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create table if not exists payment_webhook_events (
  id bigserial primary key,
  provider text not null, event_id text not null,
  event_type text, payload jsonb not null, status text not null default 'received', error text,
  received_at timestamptz not null default now(), processed_at timestamptz,
  unique (provider, event_id)
);
drop trigger if exists payment_records_immutable on payment_records;
create trigger payment_records_immutable before update or delete on payment_records for each row execute function append_only();
alter table payment_intents enable row level security;
alter table payment_records enable row level security;
alter table payment_webhook_events enable row level security;
drop policy if exists pi_owner on payment_intents;
create policy pi_owner on payment_intents for select using (user_id = auth.uid() or has_permission('finance.release'));
drop policy if exists pr_owner on payment_records;
create policy pr_owner on payment_records for select using (exists (select 1 from payment_intents i where i.id = intent_id and i.user_id = auth.uid()) or has_permission('finance.release'));
-- payment_webhook_events: no policies, server only.

create or replace function create_payment_intent(p_tx uuid, p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t transactions%rowtype; pi payment_intents%rowtype; total numeric(18,2); em text;
begin
  if not setting_bool('escrow_enabled') then raise exception 'ESCROW_NOT_ENABLED'; end if;
  select * into pi from payment_intents where idempotency_key = p_key and user_id = me;
  if found then return to_jsonb(pi); end if;
  select * into t from transactions where id = p_tx for update;
  if not found or t.buyer_id <> me then raise exception 'not allowed'; end if;
  if t.status not in ('terms_agreed','payment_pending') then raise exception 'this transaction is not ready for payment'; end if;
  update payment_intents set status = 'expired' where transaction_id = p_tx and status in ('created','pending');
  total := t.goods_amount + t.delivery_allocation + t.agent_fee;
  insert into payment_intents(reference, transaction_id, user_id, amount, currency, idempotency_key)
  values ('PAY-' || t.ref || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 8), p_tx, me, total, t.currency, p_key) returning * into pi;
  update transactions set status = 'payment_pending' where id = p_tx;
  select email into em from profiles where id = me;
  return to_jsonb(pi) || jsonb_build_object('buyer_email', em);
end $$;

create or replace function attach_payment_link(p_reference text, p_link text) returns void language sql security definer set search_path = public as $$
  update payment_intents set checkout_url = p_link, status = 'pending' where reference = p_reference and status = 'created'
$$;
revoke all on function attach_payment_link(text, text) from public, anon, authenticated;
grant execute on function attach_payment_link(text, text) to service_role;

-- Called ONLY by the webhook / verify path (service role), after the provider API confirmed the payment.
create or replace function record_verified_payment(p_reference text, p_provider_ref text, p_amount numeric, p_currency text, p_raw jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pi payment_intents%rowtype; res jsonb;
begin
  select * into pi from payment_intents where reference = p_reference for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown reference'); end if;
  if pi.status = 'verified' then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  if p_amount < pi.amount or p_currency <> pi.currency then
    update payment_intents set status = 'mismatch', failure_reason = 'amount or currency does not match' where id = pi.id;
    perform write_audit('payment.mismatch', 'payment_intent', pi.reference, jsonb_build_object('expected', pi.amount, 'received', p_amount, 'currency', p_currency));
    return jsonb_build_object('ok', false, 'reason', 'amount or currency mismatch');
  end if;
  update payment_intents set status = 'verified', provider_ref = p_provider_ref, verified_at = now() where id = pi.id;
  insert into payment_records(intent_id, transaction_id, provider, provider_ref, amount, currency, status, raw)
  values (pi.id, pi.transaction_id, pi.provider, p_provider_ref, p_amount, p_currency, 'successful', p_raw);
  res := fund_escrow(pi.transaction_id, 'fund-' || pi.reference, p_provider_ref);
  return jsonb_build_object('ok', true, 'funded', res);
end $$;
revoke all on function record_verified_payment(text, text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function record_verified_payment(text, text, numeric, text, jsonb) to service_role;

-- fund_escrow, rewritten: refuses to run unless a provider-verified payment covering the exact total exists.
create or replace function fund_escrow(p_tx uuid, p_key text, p_payment_ref text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; prior jsonb; total numeric(14,2); n text; res jsonb; pi payment_intents%rowtype;
begin
  select response into prior from idempotency_keys where key = p_key; if found then return prior; end if;
  if not setting_bool('escrow_enabled') then raise exception 'escrow is not enabled'; end if;
  select * into t from transactions where id = p_tx for update;
  if not found or t.status not in ('terms_agreed','payment_pending') then raise exception 'transaction is not ready to fund'; end if;
  total := t.goods_amount + t.delivery_allocation + t.agent_fee;
  select * into pi from payment_intents where transaction_id = p_tx and provider_ref = p_payment_ref and status = 'verified';
  if not found then raise exception 'no verified payment for this transaction'; end if;
  if pi.amount < total or pi.currency <> t.currency then raise exception 'verified payment does not cover the agreed total'; end if;
  insert into escrow_accounts(transaction_id, funded, goods_reserved, delivery_reserved, agent_reserved, payment_ref, currency)
    values (p_tx, total, t.goods_amount, t.delivery_allocation, t.agent_fee, p_payment_ref, t.currency);
  n := t.ref;
  perform post_ledger(p_tx, 'FIN-' || n || '-FUND', 'buyer', 'debit', total, 'Escrow funded');
  perform post_ledger(p_tx, 'FIN-' || n || '-RES-GOODS', 'escrow', 'reserve', t.goods_amount, 'Goods payment');
  perform post_ledger(p_tx, 'FIN-' || n || '-RES-DELIV', 'escrow', 'reserve', t.delivery_allocation, 'Delivery allocation');
  perform post_ledger(p_tx, 'FIN-' || n || '-RES-AGENT', 'escrow', 'reserve', t.agent_fee, 'Agent fee (separate)');
  update transactions set status = 'escrow_funded', started_at = now() where id = p_tx;
  insert into transaction_events(transaction_id, event, from_status, to_status, details) values (p_tx, 'escrow_funded', t.status, 'escrow_funded', jsonb_build_object('total', total));
  perform notify_user(t.buyer_id, 'Escrow funding', 'Escrow funded for ' || n, '/escrow');
  perform notify_user(t.seller_id, 'Escrow funding', 'Escrow funded for ' || n, '/transactions/' || p_tx);
  res := jsonb_build_object('ok', true, 'transaction', p_tx);
  insert into idempotency_keys(key, endpoint, response) values (p_key, 'fund_escrow', res);
  return res;
end $$;

-- ============================================================ agents: invitations, chat, profiles
alter table buyer_agents add column if not exists invite_name text;
create table if not exists agent_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  experience text, service_areas text[] not null default '{}', available boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table agent_profiles enable row level security;
drop policy if exists agent_profiles_read on agent_profiles;
create policy agent_profiles_read on agent_profiles for select to authenticated using (true);
drop policy if exists agent_profiles_write on agent_profiles;
create policy agent_profiles_write on agent_profiles for all to authenticated using (user_id = auth.uid() and app_role() = 'agent') with check (user_id = auth.uid() and app_role() = 'agent');

create or replace function invite_agent(p_channel text, p_contact text, p_name text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); aid uuid; bid uuid; tok text;
begin
  if app_role() <> 'buyer' then raise exception 'only buyers can invite agents'; end if;
  if p_channel not in ('phone','email','link') or (p_channel <> 'link' and length(coalesce(p_contact, '')) < 3) then raise exception 'invalid contact'; end if;
  if p_channel = 'email' then select id into aid from profiles where lower(email) = lower(p_contact) and role = 'agent'; end if;
  if p_channel = 'phone' then select id into aid from profiles where phone = p_contact and role = 'agent'; end if;
  if aid is not null and exists (select 1 from buyer_agents where buyer_id = me and agent_id = aid and status in ('invited','accepted')) then raise exception 'this agent is already on your list'; end if;
  insert into buyer_agents(buyer_id, agent_id, invite_channel, invite_contact, invite_name) values (me, aid, p_channel, p_contact, p_name) returning id, invite_token into bid, tok;
  if aid is not null then perform notify_user(aid, 'New agent invitation', 'You were invited as an agent', '/agents'); end if;
  return jsonb_build_object('id', bid, 'token', tok, 'registered_agent', aid is not null);
end $$;

create or replace function accept_agent_invitation(p_token text, p_accept boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ba buyer_agents%rowtype;
begin
  if app_role() <> 'agent' then raise exception 'only agent accounts can accept invitations'; end if;
  select * into ba from buyer_agents where invite_token = p_token and status = 'invited' for update;
  if not found then raise exception 'invitation not found or already answered'; end if;
  if ba.agent_id is not null and ba.agent_id <> me then raise exception 'this invitation is for another agent'; end if;
  update buyer_agents set agent_id = me, status = case when p_accept then 'accepted' else 'declined' end, active = p_accept where id = ba.id;
  perform notify_user(ba.buyer_id, 'Agent acceptance', case when p_accept then 'An agent accepted your invitation' else 'An agent declined your invitation' end, '/agents');
  return jsonb_build_object('ok', true, 'id', ba.id, 'accepted', p_accept);
end $$;

create or replace function set_agent_active(p_ba uuid, p_active boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  update buyer_agents set active = p_active where id = p_ba and buyer_id = auth.uid() and status = 'accepted';
  if not found then raise exception 'not allowed'; end if;
end $$;
create or replace function remove_agent(p_ba uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update buyer_agents set status = 'removed', active = false where id = p_ba and buyer_id = auth.uid() and status in ('invited','accepted');
  if not found then raise exception 'not allowed'; end if;
  update assignments set status = 'Cancelled' where buyer_id = auth.uid() and agent_id = (select agent_id from buyer_agents where id = p_ba) and status in ('Pending','Accepted');
end $$;

create or replace function send_chat(p_ba uuid, p_kind text, p_text text, p_attachment text default null) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ba buyer_agents%rowtype; mid uuid;
begin
  select * into ba from buyer_agents where id = p_ba and status = 'accepted' and me in (buyer_id, agent_id);
  if not found then raise exception 'not allowed'; end if;
  if p_kind not in ('text','image') then raise exception 'invalid message kind'; end if;
  if p_kind = 'text' and length(trim(coalesce(p_text, ''))) = 0 then raise exception 'message is empty'; end if;
  if p_attachment is not null and left(p_attachment, length(p_ba::text) + 1) <> p_ba::text || '/' then raise exception 'invalid attachment path'; end if;
  insert into chat_messages(buyer_agent_id, sender_id, kind, body, attachment_path) values (p_ba, me, p_kind, left(p_text, 4000), p_attachment) returning id into mid;
  perform notify_user(case when me = ba.buyer_id then ba.agent_id else ba.buyer_id end, 'New message', 'New message in your agent chat', '/agents/' || p_ba || '/chat');
  return mid;
end $$;

-- ============================================================ assignments
alter table assignments add column if not exists location_approx text;
create table if not exists assignment_events (
  id bigserial primary key, assignment_id uuid not null references assignments(id), actor_id uuid, event text not null, note text, created_at timestamptz not null default now()
);
create table if not exists assignment_reports (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id), version int not null, submitted_by uuid not null references profiles(id),
  data jsonb not null, created_at timestamptz not null default now(), unique (assignment_id, version)
);
drop trigger if exists asg_events_immutable on assignment_events;
create trigger asg_events_immutable before update or delete on assignment_events for each row execute function append_only();
drop trigger if exists asg_reports_immutable on assignment_reports;
create trigger asg_reports_immutable before update or delete on assignment_reports for each row execute function append_only();
alter table assignment_events enable row level security;
alter table assignment_reports enable row level security;
drop policy if exists asg_events_read on assignment_events;
create policy asg_events_read on assignment_events for select using (exists (select 1 from assignments a where a.id = assignment_id and (a.buyer_id = auth.uid() or a.agent_id = auth.uid())) or is_admin());
drop policy if exists asg_reports_read on assignment_reports;
create policy asg_reports_read on assignment_reports for select using (exists (select 1 from assignments a where a.id = assignment_id and (a.buyer_id = auth.uid() or a.agent_id = auth.uid())) or is_admin());

create or replace function asg_log(p_asg uuid, p_event text, p_note text) returns void language sql security definer set search_path = public as $$
  insert into assignment_events(assignment_id, actor_id, event, note) values (p_asg, auth.uid(), p_event, p_note)
$$;
revoke all on function asg_log(uuid, text, text) from public, anon, authenticated;

create or replace function paths_ok(p_prefix text, p_arr jsonb) returns boolean language sql immutable as $$
  select coalesce(bool_and(left(x, length(p_prefix) + 1) = p_prefix || '/'), true) from jsonb_array_elements_text(coalesce(p_arr, '[]'::jsonb)) x
$$;

create or replace function create_assignment(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ba buyer_agents%rowtype; t transactions%rowtype; fa fee_agreements%rowtype; aid uuid; aref text;
begin
  select * into ba from buyer_agents where id = safe_uuid(p->>'agentId') and buyer_id = me and status = 'accepted' and active;
  if not found then raise exception 'choose one of your active agents'; end if;
  if nullif(p->>'transactionId', '') is not null then
    select * into t from transactions where id = safe_uuid(p->>'transactionId') and buyer_id = me;
    if not found or t.status in ('cancelled','refunded','completed') then raise exception 'that transaction is not available'; end if;
    if t.fee_agreement_id is not null then
      select * into fa from fee_agreements where id = t.fee_agreement_id;
      if fa.agent_id <> ba.agent_id then raise exception 'the agent fee for this transaction was agreed with a different agent'; end if;
      if fa.assignment_id is not null then raise exception 'this transaction''s agent fee is already used by another assignment'; end if;
    end if;
  end if;
  if fa.id is null then
    select * into fa from fee_agreements f where f.buyer_agent_id = ba.id and f.buyer_id = me and f.assignment_id is null
      and not exists (select 1 from transactions x where x.fee_agreement_id = f.id and x.status not in ('cancelled','refunded'))
      and (nullif(p->>'feeAgreementId', '') is null or f.id = safe_uuid(p->>'feeAgreementId')) order by f.agreed_at desc limit 1;
  end if;
  if fa.id is null then raise exception 'agree a fee with this agent before assigning work'; end if;
  if length(trim(coalesce(p->>'desc', ''))) < 3 then raise exception 'describe the task'; end if;
  insert into assignments(buyer_id, agent_id, transaction_id, kind, description, seller_name, goods, inspection_deadline, agreed_fee, fee_proposal_id, currency, location_approx, status)
  values (me, ba.agent_id, t.id, coalesce(p->>'kind', 'Inspection'), p->>'desc', p->>'seller', p->>'goods', nullif(p->>'deadline', '')::date, fa.amount, fa.proposal_id, fa.currency, p->>'location', 'Pending')
  returning id, ref into aid, aref;
  update fee_agreements set assignment_id = aid where id = fa.id;
  if nullif(p->>'locationPrecise', '') is not null then
    insert into party_locations(owner_id, transaction_id, assignment_id, kind, precise, approx) values (me, t.id, aid, 'inspection', p->>'locationPrecise', coalesce(nullif(p->>'location', ''), 'Area not given'));
  end if;
  perform asg_log(aid, 'created', null);
  perform notify_user(ba.agent_id, 'New task assignment', aref || ' was assigned to you', '/assignments/' || aid);
  return jsonb_build_object('id', aid, 'ref', aref, 'agreed_fee', fa.amount, 'currency', fa.currency);
end $$;

create or replace function respond_assignment(p_id uuid, p_action text) returns jsonb language plpgsql security definer set search_path = public as $$
declare a assignments%rowtype;
begin
  select * into a from assignments where id = p_id and agent_id = auth.uid() and status = 'Pending' for update;
  if not found then raise exception 'not allowed'; end if;
  if p_action = 'accept' then update assignments set status = 'Accepted' where id = p_id;
  elsif p_action = 'decline' then update assignments set status = 'Rejected' where id = p_id;
  else raise exception 'unknown action'; end if;
  perform asg_log(p_id, p_action, null);
  perform notify_user(a.buyer_id, 'Agent acceptance', a.ref || ' was ' || case when p_action = 'accept' then 'accepted' else 'declined' end, '/assignments/' || p_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function start_assignment(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare a assignments%rowtype; t transactions%rowtype;
begin
  select * into a from assignments where id = p_id and agent_id = auth.uid() and status = 'Accepted' for update;
  if not found then raise exception 'not allowed'; end if;
  if a.transaction_id is not null then
    select * into t from transactions where id = a.transaction_id for update;
    if t.started_at is null then raise exception 'the buyer has not funded this transaction yet'; end if;
    if t.status = 'escrow_funded' then update transactions set status = 'inspection_in_progress' where id = t.id; end if;
  end if;
  update assignments set status = 'In Progress' where id = p_id;
  perform asg_log(p_id, 'started', null);
  return jsonb_build_object('ok', true);
end $$;

create or replace function submit_report(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a assignments%rowtype; v int;
begin
  select * into a from assignments where id = p_id and agent_id = auth.uid() and status = 'In Progress' for update;
  if not found then raise exception 'not allowed'; end if;
  if p->>'recommendation' not in ('approve','reject') then raise exception 'recommendation must be approve or reject'; end if;
  if not (paths_ok(p_id::text, p->'photos') and paths_ok(p_id::text, p->'videos') and paths_ok(p_id::text, p->'docs')) then raise exception 'invalid evidence path'; end if;
  select coalesce(max(version), 0) + 1 into v from assignment_reports where assignment_id = p_id;
  insert into assignment_reports(assignment_id, version, submitted_by, data) values (p_id, v, auth.uid(), p);
  update assignments set status = 'Inspection Completed' where id = p_id;
  if a.transaction_id is not null then update transactions set status = 'inspection_report_ready' where id = a.transaction_id and status in ('escrow_funded','inspection_in_progress'); end if;
  perform asg_log(p_id, 'report_submitted', 'version ' || v);
  perform notify_user(a.buyer_id, 'Inspection update', 'Report uploaded for ' || a.ref, '/assignments/' || p_id);
  return jsonb_build_object('ok', true, 'version', v);
end $$;

create or replace function decide_report(p_id uuid, p_action text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare a assignments%rowtype; t transactions%rowtype;
begin
  select * into a from assignments where id = p_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'not allowed'; end if;
  if p_action = 'cancel' then
    if a.status not in ('Pending','Accepted','In Progress') then raise exception 'this assignment can no longer be cancelled'; end if;
    update assignments set status = 'Cancelled' where id = p_id;
  elsif p_action = 'clarify' then
    if a.status <> 'Inspection Completed' then raise exception 'there is no report to question'; end if;
    perform notify_user(a.agent_id, 'Inspection update', 'The buyer asked a question about ' || a.ref, '/assignments/' || p_id);
  elsif p_action = 'reinspect' then
    if a.status <> 'Inspection Completed' then raise exception 'there is no report to redo'; end if;
    update assignments set status = 'In Progress' where id = p_id;
    perform notify_user(a.agent_id, 'Inspection update', 'The buyer asked for a re-inspection: ' || a.ref, '/assignments/' || p_id);
  elsif p_action in ('approve','reject') then
    if a.status <> 'Inspection Completed' then raise exception 'there is no report to decide on'; end if;
    update assignments set status = case when p_action = 'approve' then 'Approved' else 'Rejected' end where id = p_id;
    if p_action = 'approve' and a.transaction_id is not null then
      select * into t from transactions where id = a.transaction_id for update;
      update transactions set inspection_approved_at = coalesce(inspection_approved_at, now()),
             status = case when status in ('escrow_funded','inspection_in_progress','inspection_report_ready') then 'inspection_approved' else status end where id = t.id;
      perform tx_log(t.id, 'inspection_approved', t.status, 'inspection_approved', jsonb_build_object('assignment', p_id));
      perform notify_user(t.seller_id, 'Inspection approval', 'Inspection approved for ' || t.ref, '/transactions/' || t.id);
      -- The agent's reserved fee is released independently of delivery, once and only once.
      if exists (select 1 from escrow_accounts e where e.transaction_id = t.id and not e.refunded) then
        perform release_agent_fee(p_id, 'agent-fee-' || p_id::text);
      end if;
    end if;
    perform notify_user(a.agent_id, 'Inspection update', a.ref || ' was ' || case when p_action = 'approve' then 'approved' else 'rejected' end, '/assignments/' || p_id);
  else raise exception 'unknown action'; end if;
  perform asg_log(p_id, p_action, p_note);
  return jsonb_build_object('ok', true, 'status', (select status from assignments where id = p_id));
end $$;

create or replace function inspection_decision(p_tx uuid, p_action text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare aid uuid;
begin
  select a.id into aid from assignments a where a.transaction_id = p_tx and a.buyer_id = auth.uid() and a.status = 'Inspection Completed' order by a.created_at desc limit 1;
  if aid is null then raise exception 'there is no inspection report waiting for your decision'; end if;
  return decide_report(aid, p_action, p_note);
end $$;

-- ============================================================ locations (access logged)
create table if not exists location_access_logs (id bigserial primary key, user_id uuid, transaction_id uuid, precise_returned boolean not null, created_at timestamptz not null default now());
alter table location_access_logs enable row level security;
drop policy if exists loc_logs_admin on location_access_logs;
create policy loc_logs_admin on location_access_logs for select using (has_permission('audit.read'));

-- Corrected: the seller also sees the delivery destination when inspection is not required.
create or replace function visible_locations(p_tx uuid)
returns table (kind text, location text, precise_visible boolean) language plpgsql stable security definer set search_path = public as $$
declare t transactions%rowtype; me uuid := auth.uid(); my_assignment boolean;
begin
  select * into t from transactions where id = p_tx;
  if not found then return; end if;
  select exists (select 1 from assignments a where a.transaction_id = p_tx and a.agent_id = me and a.status not in ('Pending','Rejected','Cancelled')) into my_assignment;
  if not (t.buyer_id = me or t.seller_id = me or my_assignment or is_admin()) then return; end if;
  return query
    select l.kind,
           case when l.owner_id = me or is_admin() then l.precise
                when t.started_at is not null and (
                       (l.kind in ('warehouse','factory','collection','inspection') and (t.buyer_id = me or my_assignment))
                    or (l.kind = 'delivery' and (t.seller_id = me or my_assignment) and (t.inspection_approved_at is not null or not t.inspection_required))
                ) then l.precise
                else l.approx end,
           (l.owner_id = me or is_admin() or (t.started_at is not null))
    from party_locations l where l.transaction_id = p_tx;
end $$;

create or replace function get_locations(p_tx uuid) returns table (kind text, location text, precise_visible boolean) language plpgsql security definer set search_path = public as $$
begin
  insert into location_access_logs(user_id, transaction_id, precise_returned)
    select auth.uid(), p_tx, coalesce(bool_or(v.precise_visible), false) from visible_locations(p_tx) v;
  return query select * from visible_locations(p_tx);
end $$;

create or replace function save_location(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  if p->>'kind' not in ('warehouse','factory','collection','delivery','inspection') then raise exception 'invalid location kind'; end if;
  if length(trim(coalesce(p->>'precise', ''))) < 3 or length(trim(coalesce(p->>'approx', ''))) < 2 then raise exception 'precise and approximate locations are required'; end if;
  if nullif(p->>'transactionId', '') is not null and not exists (select 1 from transactions t where t.id = safe_uuid(p->>'transactionId') and auth.uid() in (t.buyer_id, t.seller_id)) then
    raise exception 'not allowed';
  end if;
  insert into party_locations(owner_id, transaction_id, kind, precise, approx) values (auth.uid(), safe_uuid(p->>'transactionId'), p->>'kind', p->>'precise', p->>'approx') returning id into lid;
  return lid;
end $$;

-- ============================================================ delivery
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references transactions(id),
  status text not null default 'Dispatched' check (status in ('Awaiting Dispatch','Dispatched','In Transit','Arrived at Destination','Awaiting Buyer Confirmation','Completed','Failed','Disputed','Returned')),
  method text, carrier text, vehicle_plate text, driver_name text, driver_phone text,
  dispatched_at timestamptz, expected_arrival date, arrived_at timestamptz, quantity numeric(18,3),
  documents text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists delivery_events (
  id bigserial primary key, delivery_id uuid not null references deliveries(id), actor_id uuid, status text, note text, evidence_paths text[] not null default '{}', created_at timestamptz not null default now()
);
drop trigger if exists delivery_events_immutable on delivery_events;
create trigger delivery_events_immutable before update or delete on delivery_events for each row execute function append_only();
alter table deliveries enable row level security;
alter table delivery_events enable row level security;
create or replace function is_tx_party(p_tx uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from transactions t where t.id = p_tx and (t.buyer_id = auth.uid() or t.seller_id = auth.uid()
    or exists (select 1 from assignments a where a.transaction_id = t.id and a.agent_id = auth.uid() and a.status not in ('Pending','Rejected','Cancelled')))) or is_admin()
$$;
drop policy if exists deliveries_read on deliveries;
create policy deliveries_read on deliveries for select using (is_tx_party(transaction_id));
drop policy if exists delivery_events_read on delivery_events;
create policy delivery_events_read on delivery_events for select using (exists (select 1 from deliveries d where d.id = delivery_id and is_tx_party(d.transaction_id)));

create or replace function dispatch(p_tx uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; did uuid; q numeric;
begin
  select * into t from transactions where id = p_tx and seller_id = auth.uid() for update;
  if not found then raise exception 'not allowed'; end if;
  if t.hold then raise exception 'this transaction is on hold'; end if;
  if not ((t.status = 'inspection_approved') or (t.status = 'escrow_funded' and not t.inspection_required)) then
    raise exception 'goods can only be dispatched after escrow is funded and the required inspection is approved';
  end if;
  q := coalesce((p->>'quantity')::numeric, t.quantity);
  if q <= 0 or q > t.quantity then raise exception 'invalid quantity'; end if;
  if not paths_ok(p_tx::text, p->'documents') then raise exception 'invalid document path'; end if;
  insert into deliveries(transaction_id, status, method, carrier, vehicle_plate, driver_name, driver_phone, dispatched_at, expected_arrival, quantity, documents)
  values (p_tx, 'Dispatched', p->>'method', p->>'carrier', p->>'vehiclePlate', p->>'driverName', p->>'driverPhone', coalesce(nullif(p->>'dispatchDate', '')::timestamptz, now()),
          nullif(p->>'expectedArrival', '')::date, q, coalesce(array(select jsonb_array_elements_text(p->'documents')), '{}')) returning id into did;
  insert into delivery_events(delivery_id, actor_id, status, note) values (did, auth.uid(), 'Dispatched', p->>'note');
  update transactions set status = 'dispatched' where id = p_tx;
  perform tx_log(p_tx, 'dispatched', t.status, 'dispatched', '{}'::jsonb);
  perform notify_user(t.buyer_id, 'Delivery dispatch', t.ref || ' was dispatched by the seller', '/transactions/' || p_tx);
  return jsonb_build_object('ok', true, 'delivery', did);
end $$;

create or replace function update_delivery(p_tx uuid, p_status text, p_evidence text[] default '{}') returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; d deliveries%rowtype;
begin
  select * into t from transactions where id = p_tx and seller_id = auth.uid() for update;
  if not found then raise exception 'not allowed'; end if;
  select * into d from deliveries where transaction_id = p_tx for update;
  if not found then raise exception 'nothing has been dispatched yet'; end if;
  if t.hold then raise exception 'this transaction is on hold'; end if;
  if exists (select 1 from unnest(p_evidence) x where left(x, length(p_tx::text) + 1) <> p_tx::text || '/') then raise exception 'invalid evidence path'; end if;
  if p_status = 'In Transit' and d.status = 'Dispatched' then
    update deliveries set status = 'In Transit' where id = d.id; update transactions set status = 'in_transit' where id = p_tx;
  elsif p_status = 'Arrived at Destination' and d.status in ('Dispatched','In Transit') then
    update deliveries set status = 'Arrived at Destination', arrived_at = now() where id = d.id;
    update transactions set status = 'arrived', delivery_arrived_at = now() where id = p_tx;
    perform notify_user(t.buyer_id, 'Delivery arrival', t.ref || ' arrived at the destination. Please confirm.', '/transactions/' || p_tx);
  elsif p_status = 'Failed' and d.status in ('Dispatched','In Transit') then
    update deliveries set status = 'Failed' where id = d.id;
    perform notify_user(t.buyer_id, 'Delivery dispatch', 'Delivery of ' || t.ref || ' failed. You can open a dispute.', '/transactions/' || p_tx);
  else raise exception 'invalid delivery status change'; end if;
  insert into delivery_events(delivery_id, actor_id, status, evidence_paths) values (d.id, auth.uid(), p_status, p_evidence);
  perform tx_log(p_tx, 'delivery_' || lower(replace(p_status, ' ', '_')), t.status, (select status from transactions where id = p_tx), '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create or replace function add_delivery_evidence(p_asg uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a assignments%rowtype; d deliveries%rowtype; paths text[];
begin
  select * into a from assignments where id = p_asg and agent_id = auth.uid() and status in ('Accepted','In Progress','Approved','Inspection Completed');
  if not found or a.transaction_id is null then raise exception 'not allowed'; end if;
  select * into d from deliveries where transaction_id = a.transaction_id;
  if not found then raise exception 'nothing has been dispatched yet'; end if;
  if p->>'kind' not in ('loading','dispatch','transport','arrival','report') then raise exception 'invalid evidence kind'; end if;
  if not paths_ok(a.transaction_id::text, p->'paths') then raise exception 'invalid evidence path'; end if;
  paths := coalesce(array(select jsonb_array_elements_text(p->'paths')), '{}');
  insert into delivery_events(delivery_id, actor_id, status, note, evidence_paths) values (d.id, auth.uid(), 'agent_' || (p->>'kind'), p->>'note', paths);
  perform notify_user((select buyer_id from transactions where id = a.transaction_id), 'Inspection update', 'Delivery evidence uploaded for ' || a.ref, '/transactions/' || a.transaction_id);
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================ money: release / refund (replaces the 0001 versions)
-- 0001's refund_escrow could credit the agent a second time after release_agent_fee had already paid. Fixed here.
create or replace function release_agent_fee(p_assignment uuid, p_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare a assignments%rowtype; t transactions%rowtype; e escrow_accounts%rowtype; prior jsonb; res jsonb;
begin
  select response into prior from idempotency_keys where key = p_key; if found then return prior; end if;
  select * into a from assignments where id = p_assignment for update;
  if not found or a.status <> 'Approved' then raise exception 'assignment is not approved by the buyer'; end if;
  select * into t from transactions where id = a.transaction_id for update;
  select * into e from escrow_accounts where transaction_id = t.id for update;
  if not found or e.refunded then raise exception 'no secured fee to release'; end if;
  if e.agent_reserved > 0 and not exists (select 1 from ledger_entries where ref = 'FIN-' || t.ref || '-AGENT') then
    perform post_ledger(t.id, 'FIN-' || t.ref || '-AGENT', 'agent', 'release', e.agent_reserved, 'Agent fee released');
    perform credit_wallet(a.agent_id, e.agent_reserved);
    perform notify_user(a.agent_id, 'Payment release', 'Your agent fee for ' || t.ref || ' was released', '/wallet');
  end if;
  res := jsonb_build_object('ok', true);
  insert into idempotency_keys(key, endpoint, response) values (p_key, 'release_agent_fee', res);
  return res;
end $$;

create or replace function release_escrow(p_tx uuid, p_key text, p_override boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; e escrow_accounts%rowtype; a assignments%rowtype; prior jsonb; fee numeric(14,2); net numeric(14,2); res jsonb; agent_found boolean;
begin
  select response into prior from idempotency_keys where key = p_key; if found then return prior; end if;
  select * into t from transactions where id = p_tx for update;
  select * into e from escrow_accounts where transaction_id = p_tx for update;
  if not found or e.released or e.refunded then raise exception 'escrow cannot be released'; end if;
  if p_override then
    if not exists (select 1 from disputes d where d.transaction_id = p_tx and d.status = 'resolved' and d.outcome = 'release_to_seller') then
      raise exception 'no resolved dispute authorises this release';
    end if;
  else
    if t.hold then raise exception 'transaction is on hold'; end if;
    if t.inspection_required and t.inspection_approved_at is null then raise exception 'inspection not approved'; end if;
    if t.delivery_arrived_at is null then raise exception 'goods have not arrived'; end if;
    if t.buyer_confirmed_at is null or t.seller_confirmed_at is null then raise exception 'both confirmations are required'; end if;
  end if;
  fee := round((e.goods_reserved + e.delivery_reserved) * t.platform_fee_pct / 100, 2);
  net := e.goods_reserved + e.delivery_reserved - fee;
  perform post_ledger(p_tx, 'FIN-' || t.ref || '-SELLER', 'seller', 'release', net, 'Goods + delivery, net of platform fee');
  perform post_ledger(p_tx, 'FIN-' || t.ref || '-PLATFORM', 'platform', 'credit', fee, 'Platform fee');
  perform credit_wallet(t.seller_id, net);
  select * into a from assignments where transaction_id = p_tx and status in ('Approved','Inspection Completed') order by (status = 'Approved') desc, created_at limit 1;
  agent_found := found;
  if e.agent_reserved > 0 and not exists (select 1 from ledger_entries where ref = 'FIN-' || t.ref || '-AGENT') then
    if agent_found then
      perform post_ledger(p_tx, 'FIN-' || t.ref || '-AGENT', 'agent', 'release', e.agent_reserved, 'Agent fee released');
      perform credit_wallet(a.agent_id, e.agent_reserved);
    else
      perform post_ledger(p_tx, 'FIN-' || t.ref || '-AGENT-UNUSED', 'buyer', 'credit', e.agent_reserved, 'Unused agent fee returned');
      perform credit_wallet(t.buyer_id, e.agent_reserved);
    end if;
  end if;
  update escrow_accounts set released = true where transaction_id = p_tx;
  update transactions set status = 'completed', hold = false where id = p_tx;
  perform commit_inventory(p_tx);
  insert into transaction_events(transaction_id, event, from_status, to_status, details) values (p_tx, 'funds_released', t.status, 'completed', jsonb_build_object('seller_net', net, 'platform_fee', fee, 'override', p_override));
  perform notify_user(t.seller_id, 'Payment release', 'Payment released for ' || t.ref, '/wallet');
  perform notify_user(t.buyer_id, 'Payment release', t.ref || ' is complete. Funds were released.', '/transactions/' || p_tx);
  res := jsonb_build_object('ok', true, 'seller_net', net, 'platform_fee', fee);
  insert into idempotency_keys(key, endpoint, response) values (p_key, 'release_escrow', res);
  return res;
end $$;
create or replace function release_escrow(p_tx uuid, p_key text) returns jsonb language sql security definer set search_path = public as $$
  select release_escrow(p_tx, p_key, false)
$$;
revoke all on function release_escrow(uuid, text, boolean) from public, anon, authenticated;
grant execute on function release_escrow(uuid, text, boolean) to service_role;

create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  transaction_id uuid not null references transactions(id),
  amount numeric(14,2) not null check (amount > 0), currency text not null,
  reason text, status text not null default 'credited_to_platform_account' check (status in ('credited_to_platform_account','pending_provider','completed','failed')),
  approved_by uuid references profiles(id), provider_ref text, created_at timestamptz not null default now()
);
alter table refunds enable row level security;
drop policy if exists refunds_read on refunds;
create policy refunds_read on refunds for select using (exists (select 1 from transactions t where t.id = transaction_id and t.buyer_id = auth.uid()) or has_permission('finance.refund'));

create or replace function refund_escrow(p_tx uuid, p_key text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; e escrow_accounts%rowtype; a assignments%rowtype; prior jsonb; back numeric(14,2); res jsonb; has_asg boolean;
begin
  if not has_permission('finance.refund') then raise exception 'not allowed'; end if;
  select response into prior from idempotency_keys where key = p_key; if found then return prior; end if;
  select * into t from transactions where id = p_tx for update;
  select * into e from escrow_accounts where transaction_id = p_tx for update;
  if not found or e.released or e.refunded then raise exception 'escrow cannot be refunded'; end if;
  if not exists (select 1 from disputes d where d.transaction_id = p_tx and d.status = 'resolved' and d.outcome = 'refund_buyer') and t.status <> 'cancelled' then
    raise exception 'a resolved dispute (refund buyer) or a cancelled transaction is required';
  end if;
  back := e.goods_reserved + e.delivery_reserved;
  select * into a from assignments where transaction_id = p_tx and status in ('Inspection Completed','Approved') order by created_at limit 1;
  has_asg := found;
  if e.agent_reserved > 0 then
    if exists (select 1 from ledger_entries where ref = 'FIN-' || t.ref || '-AGENT') then
      null;   -- agent already paid for approved work; never pay twice
    elsif has_asg then
      perform post_ledger(p_tx, 'FIN-' || t.ref || '-AGENT', 'agent', 'release', e.agent_reserved, 'Agent fee for completed inspection');
      perform credit_wallet(a.agent_id, e.agent_reserved);
    else
      back := back + e.agent_reserved;
    end if;
  end if;
  perform post_ledger(p_tx, 'FIN-' || t.ref || '-REFUND', 'buyer', 'credit', back, coalesce(p_note, 'Refund'));
  perform credit_wallet(t.buyer_id, back);
  insert into refunds(ref, transaction_id, amount, currency, reason, approved_by) values ('RFD-' || t.ref, p_tx, back, t.currency, p_note, auth.uid()) on conflict (ref) do nothing;
  update escrow_accounts set refunded = true where transaction_id = p_tx;
  update transactions set status = 'refunded', hold = false where id = p_tx;
  perform release_inventory(p_tx);
  perform write_audit('refund.executed', 'transaction', p_tx::text, jsonb_build_object('amount', back, 'note', p_note));
  perform notify_user(t.buyer_id, 'Refund', 'Refund processed for ' || t.ref, '/transactions/' || p_tx);
  res := jsonb_build_object('ok', true, 'refunded', back);
  insert into idempotency_keys(key, endpoint, response) values (p_key, 'refund_escrow', res);
  return res;
end $$;

-- ============================================================ disputes and admin actions
create table if not exists dispute_evidence (id uuid primary key default gen_random_uuid(), dispute_id uuid not null references disputes(id), uploader_id uuid not null references profiles(id), path text not null, created_at timestamptz not null default now());
create table if not exists dispute_decisions (id uuid primary key default gen_random_uuid(), dispute_id uuid not null references disputes(id), decided_by uuid not null references profiles(id), outcome text not null, note text not null, created_at timestamptz not null default now());
drop trigger if exists dispute_decisions_immutable on dispute_decisions;
create trigger dispute_decisions_immutable before update or delete on dispute_decisions for each row execute function append_only();
alter table dispute_evidence enable row level security;
alter table dispute_decisions enable row level security;
drop policy if exists dispute_evidence_read on dispute_evidence;
create policy dispute_evidence_read on dispute_evidence for select using (exists (select 1 from disputes d join transactions t on t.id = d.transaction_id where d.id = dispute_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())) or has_permission('dispute.resolve'));
drop policy if exists dispute_decisions_read on dispute_decisions;
create policy dispute_decisions_read on dispute_decisions for select using (exists (select 1 from disputes d join transactions t on t.id = d.transaction_id where d.id = dispute_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())) or has_permission('dispute.resolve'));
drop policy if exists disputes_admin on disputes;
create policy disputes_admin on disputes for select using (has_permission('dispute.resolve'));

drop function if exists open_dispute(uuid, text, text, boolean);
create or replace function open_dispute(p_tx uuid, p_type text, p_text text, p_refund boolean, p_evidence text[] default '{}') returns uuid language plpgsql security definer set search_path = public as $$
declare t transactions%rowtype; d uuid; x text;
begin
  select * into t from transactions where id = p_tx for update;
  if not found or auth.uid() not in (t.buyer_id, t.seller_id) then raise exception 'not allowed'; end if;
  if t.status not in ('escrow_funded','inspection_in_progress','inspection_report_ready','inspection_approved','dispatched','in_transit','arrived') then
    raise exception 'a dispute can only be opened on a funded transaction that is not yet complete';
  end if;
  if length(trim(coalesce(p_text, ''))) < 10 then raise exception 'describe the problem'; end if;
  if exists (select 1 from unnest(p_evidence) e where left(e, length(p_tx::text) + 1) <> p_tx::text || '/') then raise exception 'invalid evidence path'; end if;
  insert into disputes(transaction_id, type, description, refund_requested) values (p_tx, p_type, p_text, coalesce(p_refund, false)) returning id into d;
  foreach x in array p_evidence loop insert into dispute_evidence(dispute_id, uploader_id, path) values (d, auth.uid(), x); end loop;
  update transactions set hold = true where id = p_tx;      -- a hold only; nothing is refunded or released by opening a dispute
  perform tx_log(p_tx, 'dispute_opened', t.status, t.status, jsonb_build_object('dispute', d, 'type', p_type));
  perform notify_user(case when auth.uid() = t.buyer_id then t.seller_id else t.buyer_id end, 'Dispute', 'A dispute was opened on ' || t.ref, '/disputes');
  return d;
end $$;
grant execute on function open_dispute(uuid, text, text, boolean, text[]) to authenticated;

create or replace function dispute_set_investigating(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('dispute.resolve') then raise exception 'not allowed'; end if;
  update disputes set status = 'investigating' where id = p_id and status = 'open';
  perform write_audit('dispute.investigating', 'dispute', p_id::text, '{}'::jsonb);
end $$;
grant execute on function dispute_set_investigating(uuid) to authenticated;

-- Records the decision. Money moves only through admin_release / refund_escrow, which need finance permissions.
create or replace function resolve_dispute(p_id uuid, p_outcome text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare d disputes%rowtype; t transactions%rowtype;
begin
  if not has_permission('dispute.resolve') then raise exception 'not allowed'; end if;
  if p_outcome not in ('refund_buyer','release_to_seller','reject_dispute') then raise exception 'invalid outcome'; end if;
  if length(trim(coalesce(p_note, ''))) < 5 then raise exception 'a reason is required'; end if;
  select * into d from disputes where id = p_id and status in ('open','investigating') for update;
  if not found then raise exception 'dispute is not open'; end if;
  select * into t from transactions where id = d.transaction_id for update;
  update disputes set status = 'resolved', outcome = p_outcome where id = p_id;
  insert into dispute_decisions(dispute_id, decided_by, outcome, note) values (p_id, auth.uid(), p_outcome, p_note);
  if p_outcome = 'reject_dispute' and not exists (select 1 from disputes x where x.transaction_id = t.id and x.status <> 'resolved') then
    update transactions set hold = false where id = t.id;
  end if;
  perform write_audit('dispute.resolved', 'dispute', p_id::text, jsonb_build_object('outcome', p_outcome, 'note', p_note));
  perform notify_user(t.buyer_id, 'Dispute', 'Dispute ' || d.ref || ' was resolved', '/disputes');
  perform notify_user(t.seller_id, 'Dispute', 'Dispute ' || d.ref || ' was resolved', '/disputes');
  return jsonb_build_object('ok', true, 'outcome', p_outcome, 'next', case p_outcome when 'refund_buyer' then 'a financial officer must authorise the refund' when 'release_to_seller' then 'a financial officer must authorise the release' else 'hold removed' end);
end $$;
grant execute on function resolve_dispute(uuid, text, text) to authenticated;

create or replace function admin_set_hold(p_tx uuid, p_hold boolean, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('transaction.hold') then raise exception 'not allowed'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is required'; end if;
  update transactions set hold = p_hold where id = p_tx;
  if not found then raise exception 'transaction not found'; end if;
  perform tx_log(p_tx, case when p_hold then 'admin_hold' else 'admin_unhold' end, null, null, jsonb_build_object('reason', p_reason));
  perform write_audit(case when p_hold then 'transaction.hold' else 'transaction.unhold' end, 'transaction', p_tx::text, jsonb_build_object('reason', p_reason));
end $$;
grant execute on function admin_set_hold(uuid, boolean, text) to authenticated;

create or replace function admin_release(p_tx uuid, p_key text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not has_permission('finance.release') then raise exception 'not allowed'; end if;
  r := release_escrow(p_tx, p_key, true);
  perform write_audit('release.authorised', 'transaction', p_tx::text, jsonb_build_object('note', p_note));
  return r;
end $$;
grant execute on function admin_release(uuid, text, text) to authenticated;

create or replace function admin_release_agent_fee(p_asg uuid, p_key text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not has_permission('finance.release') then raise exception 'not allowed'; end if;
  r := release_agent_fee(p_asg, p_key);
  perform write_audit('agent_fee.authorised', 'assignment', p_asg::text, jsonb_build_object('note', p_note));
  return r;
end $$;
grant execute on function admin_release_agent_fee(uuid, text, text) to authenticated;

-- ============================================================ reviews and read views
create or replace function submit_review(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t transactions%rowtype; tgt uuid := safe_uuid(p->>'targetId'); ok boolean := false; rid uuid; s int := (p->>'stars')::int;
begin
  select * into t from transactions where id = coalesce(safe_uuid(p->>'transactionId'), (select x.id from transactions x where x.ref = p->>'txRef'));
  if not found or t.status <> 'completed' then raise exception 'you can review after the transaction is completed'; end if;
  if s is null or s < 1 or s > 5 then raise exception 'stars must be between 1 and 5'; end if;
  if length(trim(coalesce(p->>'text', ''))) < 3 then raise exception 'write a short review'; end if;
  if me = t.buyer_id and tgt = t.seller_id then ok := true;
  elsif me = t.seller_id and tgt = t.buyer_id then ok := true;
  elsif me = t.buyer_id and exists (select 1 from assignments a where a.transaction_id = t.id and a.agent_id = tgt and a.status in ('Approved','Inspection Completed')) then ok := true; end if;
  if not ok then raise exception 'you cannot review this person for this transaction'; end if;
  insert into reviews(transaction_id, reviewer_id, target_id, stars, body) values (t.id, me, tgt, s, p->>'text') returning id into rid;
  perform notify_user(tgt, 'New rating', 'You received a new ' || s || '-star review', '/reviews');
  return rid;
end $$;

create or replace view profile_ratings as select target_id, round(avg(stars)::numeric, 2) as avg_stars, count(*)::int as reviews from reviews group by target_id;
grant select on profile_ratings to authenticated;

create or replace view agent_stats as
  select p.id as agent_id, coalesce(r.avg_stars, 0) as rating, coalesce(c.n, 0)::int as completed
  from profiles p
  left join profile_ratings r on r.target_id = p.id
  left join (select agent_id, count(*) n from assignments where status = 'Approved' group by agent_id) c on c.agent_id = p.id
  where p.role = 'agent';
grant select on agent_stats to authenticated;

-- What an agent may see about their tasks: no goods price, no buyer contact details.
create or replace view agent_tasks as
  select a.id, a.ref, a.kind, a.description, a.seller_name, a.goods, a.location_approx, a.inspection_deadline, a.agreed_fee, a.currency, a.status, a.created_at,
         t.ref as tx_ref, t.status as tx_status, t.quantity, pp.full_name as buyer_name
  from assignments a left join transactions t on t.id = a.transaction_id left join public_profiles pp on pp.id = a.buyer_id
  where a.agent_id = auth.uid();
grant select on agent_tasks to authenticated;

-- ============================================================ storage buckets and policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-images','profile-images',true,5242880,array['image/jpeg','image/png','image/webp']),
  ('product-images','product-images',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('product-documents','product-documents',false,20971520,array['application/pdf','image/jpeg','image/png']),
  ('business-documents','business-documents',false,20971520,array['application/pdf','image/jpeg','image/png']),
  ('verification-documents','verification-documents',false,20971520,array['application/pdf','image/jpeg','image/png']),
  ('chat-attachments','chat-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
  ('agent-inspections','agent-inspections',false,104857600,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','application/pdf']),
  ('transaction-evidence','transaction-evidence',false,52428800,array['image/jpeg','image/png','image/webp','application/pdf']),
  ('delivery-evidence','delivery-evidence',false,104857600,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','application/pdf']),
  ('dispute-evidence','dispute-evidence',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','application/pdf']),
  ('trade-documents','trade-documents',false,20971520,array['application/pdf','image/jpeg','image/png'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function is_asg_party(p_asg uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignments a where a.id = p_asg and (a.buyer_id = auth.uid() or a.agent_id = auth.uid())) or is_admin()
$$;
create or replace function can_use_chat(p_ba uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from buyer_agents b where b.id = p_ba and auth.uid() in (b.buyer_id, b.agent_id))
$$;

-- Folder convention: the first path segment decides who may touch the file. No update/delete (no overwriting), except own public images.
do $$ declare b text; begin
  foreach b in array array['profile-images','product-images'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_read');
    execute format('create policy %I on storage.objects for select using (bucket_id = %L)', b || '_read', b);
    execute format('drop policy if exists %I on storage.objects', b || '_write');
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', b || '_write', b);
    execute format('drop policy if exists %I on storage.objects', b || '_update');
    execute format('create policy %I on storage.objects for update to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', b || '_update', b);
    execute format('drop policy if exists %I on storage.objects', b || '_delete');
    execute format('create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', b || '_delete', b);
  end loop;
  foreach b in array array['product-documents','business-documents','verification-documents'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_read');
    execute format('create policy %I on storage.objects for select to authenticated using (bucket_id = %L and ((storage.foldername(name))[1] = auth.uid()::text or has_permission(%L)))', b || '_read', b,
                   case when b = 'product-documents' then 'marketplace.moderate' else 'verification.review' end);
    execute format('drop policy if exists %I on storage.objects', b || '_write');
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)', b || '_write', b);
  end loop;
end $$;

drop policy if exists chat_attachments_read on storage.objects;
create policy chat_attachments_read on storage.objects for select to authenticated using (bucket_id = 'chat-attachments' and can_use_chat(safe_uuid((storage.foldername(name))[1])));
drop policy if exists chat_attachments_write on storage.objects;
create policy chat_attachments_write on storage.objects for insert to authenticated with check (bucket_id = 'chat-attachments' and can_use_chat(safe_uuid((storage.foldername(name))[1])));

drop policy if exists agent_inspections_read on storage.objects;
create policy agent_inspections_read on storage.objects for select to authenticated using (bucket_id = 'agent-inspections' and is_asg_party(safe_uuid((storage.foldername(name))[1])));
drop policy if exists agent_inspections_write on storage.objects;
create policy agent_inspections_write on storage.objects for insert to authenticated with check (bucket_id = 'agent-inspections' and exists (
  select 1 from assignments a where a.id = safe_uuid((storage.foldername(name))[1]) and a.agent_id = auth.uid() and a.status in ('Accepted','In Progress')));

do $$ declare b text; begin
  foreach b in array array['transaction-evidence','delivery-evidence','dispute-evidence','trade-documents'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_read');
    execute format('create policy %I on storage.objects for select to authenticated using (bucket_id = %L and is_tx_party(safe_uuid((storage.foldername(name))[1])))', b || '_read', b);
    execute format('drop policy if exists %I on storage.objects', b || '_write');
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and is_tx_party(safe_uuid((storage.foldername(name))[1])))', b || '_write', b);
  end loop;
end $$;

-- ============================================================ realtime (RLS still decides who receives what)
do $$ declare t text; begin
  foreach t in array array['notifications','chat_messages','fee_proposals','assignments','transactions','deliveries','disputes'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when others then null; end;
  end loop;
end $$;
