-- =============================================================================
-- RetailTrack (Ape Kade) database schema for Supabase / PostgreSQL
--
-- Safe to run more than once (idempotent). Run it in the Supabase SQL editor,
-- then run seed.sql. The API connects with the service-role key only; every
-- table has Row Level Security enabled with NO policies, so the public
-- anon/authenticated roles cannot read or write anything directly.
-- =============================================================================

-- ---------- Types ------------------------------------------------------------
do $$ begin create type user_role as enum ('ADMIN', 'INVENTORY_STAFF', 'CASHIER');
exception when duplicate_object then null; end $$;
do $$ begin create type otp_purpose as enum ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
exception when duplicate_object then null; end $$;
do $$ begin create type sale_status as enum ('COMPLETED', 'PENDING', 'CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin create type payment_method as enum ('CASH', 'CARD', 'OTHER');
exception when duplicate_object then null; end $$;
do $$ begin create type inventory_tx_type as enum ('STOCK_ADDED', 'SALE_DEDUCTION', 'ADJUSTMENT', 'RETURN');
exception when duplicate_object then null; end $$;

-- ---------- Sequences (human-friendly document numbers) -----------------------
-- The frontend numbers sales SALE-1033 onward, returns RET-1001 onward and
-- purchase orders PO-000001 onward.
create sequence if not exists sale_number_seq start 1033;
create sequence if not exists return_number_seq start 1001;
create sequence if not exists purchase_order_number_seq start 1;

-- ---------- Helpers ------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Tables ---------------------------------------------------------------
create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null check (char_length(btrim(full_name)) between 2 and 100),
  email          text not null check (email = lower(email) and char_length(email) <= 254),
  phone          text check (phone is null or char_length(phone) <= 30),
  avatar_url     text,
  password_hash  text not null,
  role           user_role not null default 'CASHIER',
  email_verified boolean not null default false,
  is_active      boolean not null default true,
  -- Bumped on password change/reset or deactivation so older JWTs stop working.
  token_version  integer not null default 0,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists users_email_key on users (email);

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 300),
  color       text not null default '#6574e8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists categories_name_key on categories (lower(name));

create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null check (sku = upper(sku) and char_length(sku) between 2 and 40),
  name            text not null check (char_length(btrim(name)) between 2 and 150),
  category_id     uuid not null references categories (id) on delete restrict,
  selling_price   numeric(12,2) not null check (selling_price >= 0),
  cost_price      numeric(12,2) not null default 0 check (cost_price >= 0),
  current_stock   integer not null default 0 check (current_stock >= 0),
  minimum_stock   integer not null default 0 check (minimum_stock >= 0),
  image_url       text,
  image_public_id text,
  is_active       boolean not null default true,
  -- Derived in the database so every query and report agrees on the rule:
  -- low stock means stock <= minimum (SRS), out of stock means zero.
  stock_status    text generated always as (
    case
      when not is_active then 'INACTIVE'
      when current_stock = 0 then 'OUT_OF_STOCK'
      when current_stock <= minimum_stock then 'LOW_STOCK'
      else 'IN_STOCK'
    end) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists products_sku_key on products (sku);
create index if not exists products_category_idx on products (category_id);
create index if not exists products_status_idx on products (is_active, stock_status);

create table if not exists sales (
  id             uuid primary key default gen_random_uuid(),
  sale_number    text not null unique default ('SALE-' || nextval('sale_number_seq')),
  customer_name  text not null default 'Walk-in Customer' check (char_length(btrim(customer_name)) between 1 and 120),
  payment_method payment_method not null default 'CASH',
  status         sale_status not null,
  total_amount   numeric(12,2) not null default 0 check (total_amount >= 0),
  item_count     integer not null default 0 check (item_count >= 0),
  refunded_total numeric(12,2) not null default 0 check (refunded_total >= 0),
  return_status  text check (return_status in ('PARTIALLY_RETURNED', 'RETURNED')),
  processed_by   uuid not null references users (id),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists sales_created_idx on sales (created_at desc);
create index if not exists sales_status_idx on sales (status, created_at desc);
create index if not exists sales_processed_by_idx on sales (processed_by);

-- Name/SKU/price/cost are snapshots so history survives later product edits.
create table if not exists sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references sales (id) on delete cascade,
  product_id   uuid not null references products (id),
  product_name text not null,
  sku          text not null,
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  unit_cost    numeric(12,2) not null default 0 check (unit_cost >= 0),
  subtotal     numeric(12,2) not null check (subtotal >= 0),
  unique (sale_id, product_id)
);
create index if not exists sale_items_product_idx on sale_items (product_id);

create table if not exists returns (
  id            uuid primary key default gen_random_uuid(),
  return_number text not null unique default ('RET-' || nextval('return_number_seq')),
  sale_id       uuid not null references sales (id),
  reason        text not null default 'Customer return' check (char_length(reason) <= 300),
  total_amount  numeric(12,2) not null check (total_amount >= 0),
  processed_by  uuid not null references users (id),
  created_at    timestamptz not null default now()
);
create index if not exists returns_sale_idx on returns (sale_id);
create index if not exists returns_created_idx on returns (created_at desc);

create table if not exists return_items (
  id           uuid primary key default gen_random_uuid(),
  return_id    uuid not null references returns (id) on delete cascade,
  product_id   uuid not null references products (id),
  product_name text not null,
  sku          text not null,
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  unit_cost    numeric(12,2) not null default 0 check (unit_cost >= 0),
  subtotal     numeric(12,2) not null check (subtotal >= 0),
  unique (return_id, product_id)
);
create index if not exists return_items_product_idx on return_items (product_id);

create table if not exists inventory_transactions (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products (id),
  transaction_type  inventory_tx_type not null,
  quantity_change   integer not null check (quantity_change <> 0),
  previous_quantity integer not null check (previous_quantity >= 0),
  new_quantity      integer not null check (new_quantity >= 0),
  reason            text check (reason is null or char_length(reason) <= 300),
  note              text check (note is null or char_length(note) <= 500),
  performed_by      uuid not null references users (id),
  related_sale_id   uuid references sales (id),
  related_return_id uuid references returns (id),
  created_at        timestamptz not null default now(),
  check (new_quantity = previous_quantity + quantity_change)
);
create index if not exists inventory_tx_product_idx on inventory_transactions (product_id, created_at desc);
create index if not exists inventory_tx_created_idx on inventory_transactions (created_at desc);

create table if not exists purchase_orders (
  id                  uuid primary key default gen_random_uuid(),
  po_number           text not null unique default ('PO-' || lpad(nextval('purchase_order_number_seq')::text, 6, '0')),
  product_id          uuid not null references products (id),
  supplier            text not null default '' check (char_length(supplier) <= 120),
  quantity            integer not null check (quantity > 0),
  unit_cost           numeric(12,2) not null default 0 check (unit_cost >= 0),
  stock_at_creation   integer not null check (stock_at_creation >= 0),
  minimum_at_creation integer not null check (minimum_at_creation >= 0),
  status              text not null default 'CREATED' check (status in ('CREATED')),
  created_by          uuid not null references users (id),
  created_at          timestamptz not null default now()
);
create index if not exists purchase_orders_created_idx on purchase_orders (created_at desc);
create index if not exists purchase_orders_product_idx on purchase_orders (product_id);

-- Single-row table (id is pinned to 1).
create table if not exists store_settings (
  id                 integer primary key default 1 check (id = 1),
  store_name         text not null default 'Ape Kade' check (char_length(btrim(store_name)) between 1 and 80),
  location           text not null default '' check (char_length(location) <= 120),
  address            text not null default '' check (char_length(address) <= 250),
  phone              text not null default '' check (char_length(phone) <= 30),
  email              text not null default '' check (char_length(email) <= 254),
  currency           text not null default 'Sri Lankan Rupee (LKR)',
  low_stock_alerts   boolean not null default true,
  sale_notifications boolean not null default true,
  weekly_summary     boolean not null default true,
  email_alerts       boolean not null default false,
  updated_at         timestamptz not null default now()
);
insert into store_settings (id) values (1) on conflict (id) do nothing;

create table if not exists otp_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users (id) on delete cascade,
  email       text not null,
  purpose     otp_purpose not null,
  otp_hash    text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists otp_lookup_idx on otp_codes (email, purpose, created_at desc);

-- ---------- updated_at triggers ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['users', 'categories', 'products', 'sales', 'store_settings'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_set_updated_at') then
      execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
                     t || '_set_updated_at', t);
    end if;
  end loop;
end $$;

-- ---------- Atomic business functions -------------------------------------------------
-- All stock changes go through these so they run in ONE transaction with row
-- locks: no overselling under concurrency and every change leaves an audit row.
-- Products are always locked in id order to avoid deadlocks.
-- "Not found" cases raise SQLSTATE P0002, which the API maps to HTTP 404; every
-- other business-rule failure uses the default P0001 (HTTP 400, message shown).

create or replace function add_stock_atomic(
  p_product_id uuid, p_quantity integer, p_note text, p_user uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare old_qty integer; new_qty integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  select current_stock into old_qty from products where id = p_product_id for update;
  if old_qty is null then raise exception 'Product not found' using errcode = 'P0002'; end if;
  new_qty := old_qty + p_quantity;
  update products set current_stock = new_qty where id = p_product_id;
  insert into inventory_transactions
    (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, note, performed_by)
  values (p_product_id, 'STOCK_ADDED', p_quantity, old_qty, new_qty, nullif(btrim(p_note), ''), p_user);
  return jsonb_build_object('productId', p_product_id, 'previousQuantity', old_qty, 'newQuantity', new_qty);
end $$;

-- p_change is signed: positive adds, negative removes (damage, loss, recount).
create or replace function adjust_stock_atomic(
  p_product_id uuid, p_change integer, p_reason text, p_user uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare old_qty integer; new_qty integer;
begin
  if p_change is null or p_change = 0 then
    raise exception 'Adjustment must not be zero';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'A reason is required for stock adjustments';
  end if;
  select current_stock into old_qty from products where id = p_product_id for update;
  if old_qty is null then raise exception 'Product not found' using errcode = 'P0002'; end if;
  new_qty := old_qty + p_change;
  if new_qty < 0 then raise exception 'Stock cannot go below zero (current stock: %)', old_qty; end if;
  update products set current_stock = new_qty where id = p_product_id;
  insert into inventory_transactions
    (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reason, performed_by)
  values (p_product_id, 'ADJUSTMENT', p_change, old_qty, new_qty, btrim(p_reason), p_user);
  return jsonb_build_object('productId', p_product_id, 'previousQuantity', old_qty, 'newQuantity', new_qty);
end $$;

-- p_items: [{"productId": "<uuid>", "quantity": 2}, ...]. Prices come from the
-- products table, never from the client. COMPLETED deducts stock immediately;
-- PENDING only checks availability (stock is deducted when it is completed).
create or replace function create_sale_atomic(
  p_items jsonb, p_customer text, p_payment payment_method, p_status sale_status, p_user uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record; prod products%rowtype;
  v_sale_id uuid; v_number text;
  v_total numeric(12,2) := 0; v_count integer := 0; v_sub numeric(12,2);
begin
  if p_status not in ('COMPLETED', 'PENDING') then
    raise exception 'A new sale must be COMPLETED or PENDING';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required';
  end if;

  insert into sales (customer_name, payment_method, status, processed_by, completed_at)
  values (coalesce(nullif(btrim(p_customer), ''), 'Walk-in Customer'), p_payment, p_status, p_user,
          case when p_status = 'COMPLETED' then now() end)
  returning id, sale_number into v_sale_id, v_number;

  for r in
    select (e ->> 'productId')::uuid as product_id, sum((e ->> 'quantity')::integer)::integer as qty
    from jsonb_array_elements(p_items) e
    group by 1 order by 1
  loop
    if r.qty is null or r.qty <= 0 then raise exception 'Quantity must be greater than zero'; end if;
    select * into prod from products where id = r.product_id for update;
    if not found or not prod.is_active then raise exception 'Product not found or inactive'; end if;
    if prod.current_stock < r.qty then
      raise exception 'Insufficient stock for % (available: %)', prod.name, prod.current_stock;
    end if;

    v_sub := prod.selling_price * r.qty;
    insert into sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, unit_cost, subtotal)
    values (v_sale_id, prod.id, prod.name, prod.sku, r.qty, prod.selling_price, prod.cost_price, v_sub);
    v_total := v_total + v_sub;
    v_count := v_count + r.qty;

    if p_status = 'COMPLETED' then
      update products set current_stock = current_stock - r.qty where id = prod.id;
      insert into inventory_transactions
        (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, note, performed_by, related_sale_id)
      values (prod.id, 'SALE_DEDUCTION', -r.qty, prod.current_stock, prod.current_stock - r.qty,
              v_number, p_user, v_sale_id);
    end if;
  end loop;

  update sales set total_amount = v_total, item_count = v_count where id = v_sale_id;
  return jsonb_build_object('id', v_sale_id, 'saleNumber', v_number, 'status', p_status,
                            'totalAmount', v_total, 'itemCount', v_count);
end $$;

create or replace function complete_sale_atomic(p_sale_id uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s sales%rowtype; r record; prod products%rowtype;
begin
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found' using errcode = 'P0002'; end if;
  if s.status <> 'PENDING' then raise exception 'Only pending sales can be completed'; end if;

  for r in select product_id, quantity from sale_items where sale_id = p_sale_id order by product_id loop
    select * into prod from products where id = r.product_id for update;
    if not prod.is_active then raise exception '% is inactive and cannot be sold', prod.name; end if;
    if prod.current_stock < r.quantity then
      raise exception 'Insufficient stock for % (available: %)', prod.name, prod.current_stock;
    end if;
    update products set current_stock = current_stock - r.quantity where id = prod.id;
    insert into inventory_transactions
      (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, note, performed_by, related_sale_id)
    values (prod.id, 'SALE_DEDUCTION', -r.quantity, prod.current_stock, prod.current_stock - r.quantity,
            s.sale_number, p_user, s.id);
  end loop;

  update sales set status = 'COMPLETED', completed_at = now() where id = p_sale_id;
  return jsonb_build_object('id', s.id, 'saleNumber', s.sale_number, 'status', 'COMPLETED');
end $$;

create or replace function cancel_sale_atomic(p_sale_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s sales%rowtype;
begin
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found' using errcode = 'P0002'; end if;
  if s.status <> 'PENDING' then raise exception 'Only pending sales can be cancelled'; end if;
  update sales set status = 'CANCELLED' where id = p_sale_id;
  return jsonb_build_object('id', s.id, 'saleNumber', s.sale_number, 'status', 'CANCELLED');
end $$;

-- p_items: [{"productId": "<uuid>", "quantity": 1}, ...]. Only COMPLETED sales
-- can be returned, never more than was sold minus earlier returns. Stock goes back.
create or replace function create_return_atomic(
  p_sale_id uuid, p_reason text, p_items jsonb, p_user uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s sales%rowtype; r record; si sale_items%rowtype;
  v_return_id uuid; v_number text; v_total numeric(12,2) := 0; v_sub numeric(12,2);
  v_already integer; v_old integer; v_all_returned boolean;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one item to return';
  end if;
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found' using errcode = 'P0002'; end if;
  if s.status <> 'COMPLETED' then raise exception 'Only completed sales can be returned'; end if;

  insert into returns (sale_id, reason, total_amount, processed_by)
  values (p_sale_id, coalesce(nullif(btrim(p_reason), ''), 'Customer return'), 0, p_user)
  returning id, return_number into v_return_id, v_number;

  for r in
    select (e ->> 'productId')::uuid as product_id, sum((e ->> 'quantity')::integer)::integer as qty
    from jsonb_array_elements(p_items) e
    group by 1 order by 1
  loop
    if r.qty is null or r.qty <= 0 then raise exception 'Quantity must be greater than zero'; end if;
    select * into si from sale_items where sale_id = p_sale_id and product_id = r.product_id;
    if not found then raise exception 'Item is not part of this sale'; end if;
    select coalesce(sum(ri.quantity), 0) into v_already
      from return_items ri join returns rt on rt.id = ri.return_id
      where rt.sale_id = p_sale_id and ri.product_id = r.product_id;
    if r.qty > si.quantity - v_already then
      raise exception 'Return quantity for % exceeds the remaining returnable quantity (%)',
        si.product_name, si.quantity - v_already;
    end if;

    v_sub := si.unit_price * r.qty;
    v_total := v_total + v_sub;
    insert into return_items (return_id, product_id, product_name, sku, quantity, unit_price, unit_cost, subtotal)
    values (v_return_id, si.product_id, si.product_name, si.sku, r.qty, si.unit_price, si.unit_cost, v_sub);

    select current_stock into v_old from products where id = si.product_id for update;
    update products set current_stock = v_old + r.qty where id = si.product_id;
    insert into inventory_transactions
      (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reason, note,
       performed_by, related_sale_id, related_return_id)
    values (si.product_id, 'RETURN', r.qty, v_old, v_old + r.qty, 'Customer return',
            s.sale_number || ' - ' || v_number, p_user, p_sale_id, v_return_id);
  end loop;

  update returns set total_amount = v_total where id = v_return_id;

  select bool_and(si2.quantity <= coalesce((
           select sum(ri.quantity) from return_items ri join returns rt on rt.id = ri.return_id
           where rt.sale_id = p_sale_id and ri.product_id = si2.product_id), 0))
    into v_all_returned from sale_items si2 where si2.sale_id = p_sale_id;

  update sales set
    refunded_total = refunded_total + v_total,
    return_status = case when v_all_returned then 'RETURNED' else 'PARTIALLY_RETURNED' end
  where id = p_sale_id;

  return jsonb_build_object('id', v_return_id, 'returnNumber', v_number, 'saleId', p_sale_id,
                            'totalAmount', v_total);
end $$;

create or replace function increment_otp_attempts(p_otp_id uuid) returns void
language sql security definer set search_path = public as $$
  update otp_codes set attempts = attempts + 1 where id = p_otp_id
$$;

-- ---------- Security: lock everything down to the service role ---------------------------
do $$
declare t text;
begin
  foreach t in array array['users', 'categories', 'products', 'sales', 'sale_items', 'returns',
                           'return_items', 'inventory_transactions', 'purchase_orders',
                           'store_settings', 'otp_codes'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke execute on all functions in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke execute on all functions in schema public from authenticated;
  end if;
end $$;
revoke execute on all functions in schema public from public;
