-- =======================================================
-- CAMPUSCONNECT DATABASE SCHEMA (merged & corrected)
-- Auth: Supabase Auth (auth.users) -- do NOT create a
-- separate users/roles table for logins, Supabase already handles this.
--
-- This file reflects the live database after the cleanup
-- migration (migration_cleanup.sql) removed 14 unrelated/
-- duplicate tables and restored `profiles`, plus section 9
-- (UFH domain restriction + roles), the MARKETPLACE v2
-- commits (rent rules, buy/rentals, seller reviews, rent-
-- to-buy + refunds), the laundry module, messaging/
-- notifications (c6, verified against live info_schema on
-- 22 Sept 2026), and the admin purchase/rental restrictions
-- (c7).
--
-- DASHBOARD CONTRACT (use these names, don't invent new ones):
--   roles ........ app_role: 'student' | 'admin'      (table user_roles.role)
--   kinds ........ account_kind: 'student' | 'lecturer' | 'demo_admin'  (user_roles.kind)
--   admin check .. public.is_admin()  (SQL / RLS)  or user_roles.role = 'admin' (app code)
--   who is staff . admin_allowlist (SQL Editor only, no client access)
-- =======================================================

-- Enable UUID generation
create extension if not exists pgcrypto;

-- ENUM TYPES
create type listing_status as enum ('active', 'sold', 'inactive', 'pending', 'removed');
create type order_status as enum ('pending', 'confirmed', 'shipped', 'completed', 'cancelled', 'refunded');
create type payment_method as enum ('card', 'eft', 'cash', 'mobile_money', 'other');
create type payment_status as enum ('pending', 'completed', 'failed', 'refunded');
create type notification_type as enum ('message', 'order', 'payment', 'review', 'favorite', 'system');

-- =======================================================
-- 1. PROFILES (shared auth layer -- linked to Supabase Auth)
-- NOTE: roles are NOT stored here (users can edit their own
-- profile row, so a role column would be self-promotable).
-- See section 9: user_roles.
-- The handle_new_user() trigger that fills this table is
-- defined in section 9.
-- =======================================================
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  student_number text unique,
  phone text,
  profile_image_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- =======================================================
-- 2. CATEGORIES & SUBCATEGORIES
-- =======================================================
create table if not exists categories (
    category_id uuid primary key default gen_random_uuid(),
    category_name varchar(100) unique not null,
    description text,
    icon_url text,
    created_at timestamp default current_timestamp
);

create table if not exists subcategories (
    sub_category_id uuid primary key default gen_random_uuid(),
    category_id uuid references categories(category_id) on delete cascade,
    sub_category_name varchar(100) unique not null,
    created_at timestamp default current_timestamp
);

-- =======================================================
-- 3. LISTINGS (Marketplace)
-- =======================================================
create table if not exists listings (
    listing_id uuid primary key default gen_random_uuid(),
    seller_id uuid references auth.users(id) on delete cascade,
    sub_category_id uuid references subcategories(sub_category_id) on delete set null,
    title varchar(255) not null,
    description text,
    condition varchar(50),
    price decimal(10, 2) not null,
    status listing_status default 'active',
    views_count int default 0,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

create table if not exists listing_images (
    image_id uuid primary key default gen_random_uuid(),
    listing_id uuid references listings(listing_id) on delete cascade,
    image_url text not null,
    is_primary boolean default false,
    created_at timestamp default current_timestamp
);

create table if not exists favorites (
    favorite_id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    listing_id uuid references listings(listing_id) on delete cascade,
    created_at timestamp default current_timestamp,
    constraint unique_user_favorite unique(user_id, listing_id)
);

-- =======================================================
-- 4. ORDERS & PAYMENTS
-- =======================================================
create table if not exists orders (
    order_id uuid primary key default gen_random_uuid(),
    buyer_id uuid references auth.users(id) on delete set null,
    seller_id uuid references auth.users(id) on delete set null,
    order_date timestamp default current_timestamp,
    total_amount decimal(10, 2) not null,
    status order_status default 'pending'
);

create table if not exists order_items (
    order_item_id uuid primary key default gen_random_uuid(),
    order_id uuid references orders(order_id) on delete cascade,
    listing_id uuid references listings(listing_id) on delete set null,
    quantity int not null default 1,
    unit_price decimal(10, 2) not null,
    subtotal decimal(10, 2) not null
);

create table if not exists payments (
    payment_id uuid primary key default gen_random_uuid(),
    order_id uuid references orders(order_id) on delete cascade,
    amount decimal(10, 2) not null,
    payment_method payment_method,
    payment_reference varchar(255),
    payment_date timestamp default current_timestamp,
    status payment_status default 'pending'
);

-- =======================================================
-- 5. MESSAGES & REVIEWS
-- =======================================================
create table if not exists messages (
    message_id uuid primary key default gen_random_uuid(),
    sender_id uuid references auth.users(id) on delete set null,
    receiver_id uuid references auth.users(id) on delete set null,
    listing_id uuid references listings(listing_id) on delete set null,
    message text not null,
    is_read boolean default false,
    created_at timestamp default current_timestamp
);

create table if not exists reviews (
    review_id uuid primary key default gen_random_uuid(),
    listing_id uuid references listings(listing_id) on delete cascade,
    reviewer_id uuid references auth.users(id) on delete set null,
    rating int check (rating >= 1 and rating <= 5),
    review_text text,
    created_at timestamp default current_timestamp
);

-- =======================================================
-- 6. NOTIFICATIONS & AUDIT LOG
-- =======================================================
create table if not exists notifications (
    notification_id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    type notification_type,
    title varchar(255),
    message text,
    is_read boolean default false,
    created_at timestamp default current_timestamp
);

create table if not exists audit_logs (
    log_id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    action varchar(100),
    table_name varchar(100),
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    action_date timestamp default current_timestamp
);

-- =======================================================
-- 7. ROW LEVEL SECURITY — MARKETPLACE & SUPPORTING TABLES
-- Everything below `profiles` had no RLS until this section:
-- the anon/public API key is embedded in every client bundle,
-- so without these policies any of these tables were readable
-- and writable by anyone through the Supabase REST API.
-- =======================================================

-- Categories & subcategories: public read-only
alter table categories enable row level security;
create policy "Anyone can view categories"
  on categories for select using (true);

alter table subcategories enable row level security;
create policy "Anyone can view subcategories"
  on subcategories for select using (true);

-- Listings: anyone can view active ones; only the seller can manage their own
alter table listings enable row level security;

create policy "Anyone can view active listings"
  on listings for select
  using (status = 'active' or seller_id = auth.uid());

create policy "Sellers can insert their own listings"
  on listings for insert
  with check (seller_id = auth.uid());

create policy "Sellers can update their own listings"
  on listings for update
  using (seller_id = auth.uid());

create policy "Sellers can delete their own listings"
  on listings for delete
  using (seller_id = auth.uid());

-- Listing images: viewable with their listing; sellers manage their own
alter table listing_images enable row level security;

create policy "Anyone can view listing images"
  on listing_images for select using (true);

create policy "Sellers can manage their own listing images"
  on listing_images for all
  using (
    exists (
      select 1 from listings
      where listings.listing_id = listing_images.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- Favorites: strictly your own
alter table favorites enable row level security;

create policy "Users can view their own favorites"
  on favorites for select using (user_id = auth.uid());

create policy "Users can add their own favorites"
  on favorites for insert with check (user_id = auth.uid());

create policy "Users can remove their own favorites"
  on favorites for delete using (user_id = auth.uid());

-- Not wired into the frontend yet, but reachable via the API regardless —
-- locking these down ahead of building the features that use them
alter table orders enable row level security;
create policy "Buyers and sellers can view their own orders"
  on orders for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "Buyers can create orders"
  on orders for insert with check (buyer_id = auth.uid());

alter table order_items enable row level security;
create policy "Order items visible to the order's buyer/seller"
  on order_items for select
  using (
    exists (
      select 1 from orders
      where orders.order_id = order_items.order_id
      and (orders.buyer_id = auth.uid() or orders.seller_id = auth.uid())
    )
  );

alter table payments enable row level security;
create policy "Payments visible to the order's buyer/seller"
  on payments for select
  using (
    exists (
      select 1 from orders
      where orders.order_id = payments.order_id
      and (orders.buyer_id = auth.uid() or orders.seller_id = auth.uid())
    )
  );

alter table messages enable row level security;
create policy "Users can view their own messages"
  on messages for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "Users can send messages"
  on messages for insert with check (sender_id = auth.uid());

alter table reviews enable row level security;
create policy "Anyone can view reviews"
  on reviews for select using (true);
create policy "Users can leave their own reviews"
  on reviews for insert with check (reviewer_id = auth.uid());

alter table notifications enable row level security;
create policy "Users can view their own notifications"
  on notifications for select using (user_id = auth.uid());

-- Audit logs: internal only, no client access at all —
-- RLS enabled with zero policies blocks every API request,
-- leaving it readable only from the SQL Editor / service role
alter table audit_logs enable row level security;

-- =======================================================
-- 8. STORAGE — LISTING IMAGES BUCKET
-- Backs the image upload in the "Sell an item" flow
-- (components/sell.js). Public bucket: listing photos are
-- meant to be visible to anyone browsing the marketplace.
-- =======================================================
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

create policy "Anyone can view listing images in storage"
on storage.objects for select
using (bucket_id = 'listing-images');

create policy "Authenticated users can upload listing images"
on storage.objects for insert
with check (bucket_id = 'listing-images' and auth.role() = 'authenticated');

create policy "Users can delete their own listing images in storage"
on storage.objects for delete
using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- =======================================================
-- 9. UFH DOMAIN RESTRICTION + ROLES
-- Students : studentnumber@ufh.ac.za (9 digits) - open sign-up
-- Staff    : initialSurname@ufh.ac.za - ONLY if in admin_allowlist
--            (lecturers, plus group demo admins for the capstone demo)
-- Anything else is rejected at the auth.users level.
-- The allowlist rows themselves are seeded separately
-- (seed_group_admins.sql, kept out of GitHub).
-- =======================================================
do $$ begin
  create type app_role as enum ('student', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_kind as enum ('student', 'lecturer', 'demo_admin');
exception when duplicate_object then null; end $$;

create table if not exists admin_allowlist (
  email text primary key
    check (email = lower(email) and email like '%@ufh.ac.za'),
  note text,
  added_at timestamptz default now()
);
alter table admin_allowlist
  add column if not exists kind account_kind not null default 'lecturer'
  check (kind <> 'student');
alter table admin_allowlist enable row level security;

create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'student',
  created_at timestamptz default now()
);
alter table user_roles
  add column if not exists kind account_kind not null default 'student';
alter table user_roles enable row level security;

drop policy if exists "Users can view own role" on user_roles;
create policy "Users can view own role"
  on user_roles for select
  using (user_id = auth.uid());

create or replace function public.enforce_ufh_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(coalesce(new.email, '')));
begin
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return new;
  end if;
  if e !~ '^[^@[:space:]]+@ufh\.ac\.za$' then
    raise exception 'Only @ufh.ac.za email addresses are allowed';
  end if;
  if e ~ '^[0-9]{9}@ufh\.ac\.za$' then
    return new;
  end if;
  if exists (select 1 from public.admin_allowlist where email = e) then
    return new;
  end if;
  raise exception 'This @ufh.ac.za address is not registered for Campus Connect';
end;
$$;

drop trigger if exists a_enforce_ufh_email on auth.users;
create trigger a_enforce_ufh_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_ufh_email();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e text := lower(new.email);
  r app_role := 'student';
  k account_kind := 'student';
  sn text := null;
  allow_kind account_kind;
begin
  select kind into allow_kind from admin_allowlist where email = e;
  if found then
    r := 'admin';
    k := allow_kind;
  end if;

  if e ~ '^[0-9]{9}@ufh\.ac\.za$' then
    sn := split_part(e, '@', 1);
  end if;

  insert into profiles (id, full_name, student_number)
  values (new.id, new.raw_user_meta_data ->> 'full_name', sn)
  on conflict (id) do nothing;

  insert into user_roles (user_id, role, kind)
  values (new.id, r, k)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.lock_student_number()
returns trigger language plpgsql as $$
begin
  if old.student_number is not null
     and new.student_number is distinct from old.student_number then
    raise exception 'Student number cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_student_number on profiles;
create trigger lock_student_number
  before update on profiles
  for each row execute function public.lock_student_number();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin');
$$;

insert into user_roles (user_id, role)
select id, 'student' from auth.users
on conflict (user_id) do nothing;


-- =======================================================
-- MARKETPLACE v2: c1a_enum_rented.sql
-- =======================================================
-- COMMIT 1 · file 1 of 3
-- Run this ALONE in the Supabase SQL Editor, before c1b.
-- (Postgres won't let a brand-new enum value be used in the same batch that adds it.)
alter type listing_status add value if not exists 'rented';


-- =======================================================
-- MARKETPLACE v2: c1b_categories_and_rent_rules.sql
-- =======================================================
-- COMMIT 1 · file 2 of 3
-- Fixed category set + the database side of the rent rules.
-- PR first, then run in the Supabase SQL Editor (after c1a).

-- A. New columns ------------------------------------------------------------
alter table subcategories add column if not exists rent_eligible boolean not null default false;
alter table subcategories add column if not exists rent_min_months int not null default 1;

alter table listings add column if not exists rent_price_monthly decimal(10,2);
alter table listings add column if not exists rent_to_buy_enabled boolean not null default false;
alter table listings add column if not exists is_demo boolean not null default false;

-- B. Fixed, school-appropriate categories (NO food) -------------------------
--    rent = can be rented out      min_m = shortest rental in months
drop table if exists fixed_subs;
create temp table fixed_subs (cat text, sub text, rent boolean, min_m int);
insert into fixed_subs values
 ('Phones & Tablets','Smartphones',false,1),
 ('Phones & Tablets','Tablets',false,1),
 ('Phones & Tablets','Phone Accessories',false,1),
 ('Laptops & Computers','Laptops',false,1),
 ('Laptops & Computers','Desktops & Monitors',false,1),
 ('Laptops & Computers','Computer Accessories',false,1),
 ('Electronics','Audio & Headphones',false,1),
 ('Electronics','Gaming & Consoles',false,1),
 ('Electronics','Power Banks & Chargers',false,1),
 ('Electronics','Other Electronics',false,1),
 -- Rentable appliances (no phones, laptops or stoves). Fridges need 2+ months.
 ('Appliances','Fridges & Freezers',true,2),
 ('Appliances','Microwaves',true,1),
 ('Appliances','Ovens',true,1),
 ('Appliances','Deep Fryers',true,1),
 ('Appliances','Air Fryers',true,1),
 ('Appliances','Kettles & Toasters',false,1),
 ('Appliances','Heaters & Fans',false,1),
 ('Appliances','Other Appliances',false,1),
 ('Clothing & Shoes','Menswear',false,1),
 ('Clothing & Shoes','Womenswear',false,1),
 ('Clothing & Shoes','Shoes & Sneakers',false,1),
 ('Clothing & Shoes','Bags & Accessories',false,1),
 ('Books & Stationery','Textbooks',false,1),
 ('Books & Stationery','Stationery & Calculators',false,1),
 ('Furniture & Room Items','Beds & Mattresses',false,1),
 ('Furniture & Room Items','Desks & Chairs',false,1),
 ('Furniture & Room Items','Storage & Room Items',false,1),
 ('Other','Other Items',false,1);

insert into categories (category_name)
select distinct cat from fixed_subs
on conflict (category_name) do nothing;

insert into subcategories (category_id, sub_category_name, rent_eligible, rent_min_months)
select c.category_id, f.sub, f.rent, f.min_m
from fixed_subs f join categories c on c.category_name = f.cat
on conflict (sub_category_name)
do update set category_id = excluded.category_id,
              rent_eligible = excluded.rent_eligible,
              rent_min_months = excluded.rent_min_months;

-- Anything outside the fixed set is removed. Listings that used a removed
-- subcategory keep existing but lose their category (on delete set null).
delete from subcategories where sub_category_name not in (select sub from fixed_subs);
delete from categories    where category_name    not in (select cat from fixed_subs);

-- (categories / subcategories already have select-only RLS, so users can't add their own.)

-- C. Rent rules enforced in the database (not just the form) ----------------
--    * only rentable appliance subcategories can have a monthly rent
--    * rent-to-buy only for items priced ABOVE R2000
create or replace function public.enforce_rent_rules()
returns trigger language plpgsql as $$
begin
  if new.rent_price_monthly is null then
    new.rent_to_buy_enabled := false;
    return new;
  end if;

  if new.rent_price_monthly <= 0 then
    raise exception 'Monthly rent must be more than zero.';
  end if;

  if not exists (
    select 1 from subcategories
    where sub_category_id = new.sub_category_id and rent_eligible
  ) then
    raise exception 'Only fridges/freezers, microwaves, ovens, deep fryers and air fryers can be rented out.';
  end if;

  if new.rent_to_buy_enabled and new.price <= 2000 then
    raise exception 'Rent-to-buy is only available for items priced above R2000.';
  end if;

  return new;
end $$;

drop trigger if exists listings_enforce_rent on listings;
create trigger listings_enforce_rent
  before insert or update on listings
  for each row execute procedure public.enforce_rent_rules();


-- =======================================================
-- MARKETPLACE v2: c3_buy_cards_reviews.sql
-- =======================================================
-- COMMIT 3 · schema.   PR first, then run once in the Supabase SQL Editor (after commits 1–2).
-- Adds: saved demo cards, the atomic BUY function, public seller profiles,
-- and seller (not product) reviews.
--
-- Before running, confirm reviews holds no real data:   select count(*) from reviews;
-- (reviews isn't wired into the app yet, so it should be 0.)

-- =======================================================
-- A. SAVED CARDS  (DEMO: brand + last 4 + expiry ONLY — never a full number or CVV)
-- =======================================================
create table if not exists saved_cards (
  card_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand varchar(20) not null,
  last4 char(4) not null,
  exp_month int not null check (exp_month between 1 and 12),
  exp_year int not null,
  holder_name text,
  created_at timestamp default current_timestamp
);

alter table saved_cards enable row level security;
drop policy if exists "Users view own cards" on saved_cards;
drop policy if exists "Users add own cards" on saved_cards;
drop policy if exists "Users delete own cards" on saved_cards;
create policy "Users view own cards"   on saved_cards for select using (user_id = auth.uid());
create policy "Users add own cards"    on saved_cards for insert with check (user_id = auth.uid());
create policy "Users delete own cards" on saved_cards for delete using (user_id = auth.uid());

-- =======================================================
-- B. BUY — one atomic step: order + item + payment + mark listing sold
-- =======================================================
create or replace function public.purchase_listing(
  p_listing_id uuid,
  p_method payment_method default 'card',
  p_card_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_l listings%rowtype;
  v_order uuid;
begin
  if v_uid is null then raise exception 'Please log in first.'; end if;
  if p_method not in ('card','cash') then raise exception 'Unsupported payment method.'; end if;

  select * into v_l from listings where listing_id = p_listing_id for update;
  if not found or v_l.status <> 'active' then raise exception 'This item is no longer available.'; end if;
  if v_l.seller_id = v_uid then raise exception 'You cannot buy your own listing.'; end if;
  if p_method = 'card' and not exists (
    select 1 from saved_cards where card_id = p_card_id and user_id = v_uid
  ) then raise exception 'Please choose a valid card.'; end if;

  insert into orders (buyer_id, seller_id, total_amount, status)
  values (v_uid, v_l.seller_id, v_l.price, 'confirmed')
  returning order_id into v_order;

  insert into order_items (order_id, listing_id, quantity, unit_price, subtotal)
  values (v_order, v_l.listing_id, 1, v_l.price, v_l.price);

  insert into payments (order_id, amount, payment_method, payment_reference, status)
  values (v_order, v_l.price, p_method,
          'DEMO-' || upper(substr(md5(random()::text), 1, 10)),
          (case when p_method = 'card' then 'completed' else 'pending' end)::payment_status);

  update listings set status = 'sold', updated_at = now() where listing_id = v_l.listing_id;
  return v_order;
end $$;

revoke all on function public.purchase_listing(uuid, payment_method, uuid) from public;
grant execute on function public.purchase_listing(uuid, payment_method, uuid) to authenticated;

-- =======================================================
-- C. PUBLIC SELLER PROFILES — name, photo, join date only
--    (profiles itself stays "own row only"; no student numbers or phones leak)
-- =======================================================
create or replace view public_profiles as
  select id, full_name, profile_image_url, created_at
  from profiles;

grant select on public_profiles to authenticated;

-- =======================================================
-- D. SELLER REVIEWS (replaces product reviews)
-- Every marketplace item is one-of-a-kind, so buyers review the SELLER'S SERVICE
-- after a completed order — never the item itself.
-- =======================================================
alter table reviews add column if not exists seller_id uuid references auth.users(id) on delete cascade;
alter table reviews add column if not exists order_id uuid references orders(order_id) on delete set null;
alter table reviews add column if not exists item_as_described boolean;  -- "did the item match the listing?"
alter table reviews drop column if exists listing_id;

do $$ begin
  alter table reviews add constraint reviews_one_per_order unique (order_id);
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table reviews add constraint reviews_no_self_review check (reviewer_id <> seller_id);
exception when duplicate_object then null; end $$;

-- Only the buyer of a COMPLETED order may write a review (replaces the too-open old policy)
alter table reviews enable row level security;
drop policy if exists "Users can leave their own reviews" on reviews;
drop policy if exists "Buyers can review the seller of a completed order" on reviews;
create policy "Buyers can review the seller of a completed order"
  on reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from orders o
      where o.order_id = reviews.order_id
        and o.buyer_id = auth.uid()
        and o.seller_id = reviews.seller_id
        and o.status = 'completed'
    )
  );
-- ("Anyone can view reviews" from schema.sql stays.)

create or replace view seller_ratings as
  select seller_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*) as review_count
  from reviews
  where seller_id is not null
  group by seller_id;

grant select on seller_ratings to authenticated;


-- =======================================================
-- MARKETPLACE v2: c4_rentals.sql
-- =======================================================
-- COMMIT 4 · schema.   PR first, then run once in the Supabase SQL Editor (after commit 3).
-- Rentals with a payment ledger:
--   * renter's card charges  -> rental_charges   (held by Campus Connect)
--   * owner's monthly pay-outs -> rental_payouts  (released at the END of each rental month)
--
-- PAYMENT RULES (money in)
--   Rentals of 3-10 months : 3 months upfront = month 1 + month 2 + the FINAL month (prepaid).
--                            Months 3..N-1 are charged one month before each is due.
--   Rentals of 1-2 months  : each month is charged in full at the START of that month.
-- PAY-OUT RULE (money out)
--   The owner gets one month's rent at the end of each month. Everything paid but not yet
--   paid out is "held" — that's what gets refunded if the appliance breaks (commit 5).
-- TERM RULES
--   Fridges/freezers: minimum 2 months. Others: minimum 1.
--   Maximum 6 months, or 10 if the seller turned on rent-to-buy (item priced above R2000).

create table if not exists rentals (
  rental_id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(listing_id) on delete set null,
  listing_title text not null,                 -- snapshots: the listing is hidden once rented
  listing_price decimal(10,2) not null,        -- asking price when the rental started (rent-to-buy)
  renter_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  card_id uuid references saved_cards(card_id) on delete set null,
  monthly_rent decimal(10,2) not null,
  term_months int not null check (term_months between 1 and 10),
  upfront_amount decimal(10,2) not null,
  start_date date not null default current_date,
  demo_offset_days int not null default 0,     -- DEMO: pretend this many days have passed
  rent_to_buy boolean not null default false,  -- true when term > 6 months on a rent-to-buy listing
  status text not null default 'active'
    check (status in ('active','completed','bought','refunded','cancelled')),
  created_at timestamp default current_timestamp
);

create table if not exists rental_charges (
  charge_id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references rentals(rental_id) on delete cascade,
  rent_month int not null,                     -- which month of the rental it pays for (0 = buy-out)
  period_start date not null,
  charge_date date not null,
  amount decimal(10,2) not null,
  kind text not null check (kind in ('upfront','monthly','buyout')),
  status text not null default 'scheduled' check (status in ('scheduled','paid','cancelled')),
  paid_at timestamptz
);

create table if not exists rental_payouts (
  payout_id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references rentals(rental_id) on delete cascade,
  rent_month int not null,
  release_date date not null,                  -- end of that rental month
  amount decimal(10,2) not null,
  kind text not null default 'rent' check (kind in ('rent','buyout')),
  status text not null default 'scheduled' check (status in ('scheduled','released','cancelled')),
  released_at timestamptz
);

alter table rentals enable row level security;
alter table rental_charges enable row level security;
alter table rental_payouts enable row level security;

drop policy if exists "Renter, owner or admin views rental" on rentals;
drop policy if exists "Renter, owner or admin views charges" on rental_charges;
drop policy if exists "Renter, owner or admin views payouts" on rental_payouts;

create policy "Renter, owner or admin views rental" on rentals for select
  using (renter_id = auth.uid() or owner_id = auth.uid() or public.is_admin());
create policy "Renter, owner or admin views charges" on rental_charges for select
  using (exists (select 1 from rentals r where r.rental_id = rental_charges.rental_id
                 and (r.renter_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())));
create policy "Renter, owner or admin views payouts" on rental_payouts for select
  using (exists (select 1 from rentals r where r.rental_id = rental_payouts.rental_id
                 and (r.renter_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())));
-- No insert/update policies: everything goes through the functions below.

-- =======================================================
-- START A RENTAL
-- =======================================================
create or replace function public.start_rental(
  p_listing_id uuid,
  p_term_months int,
  p_card_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_l listings%rowtype;
  v_sub subcategories%rowtype;
  v_rental uuid;
  v_start date := current_date;
  v_max int;
  v_rent numeric;
  k int;
begin
  if v_uid is null then raise exception 'Please log in first.'; end if;

  select * into v_l from listings where listing_id = p_listing_id for update;
  if not found or v_l.status <> 'active' then raise exception 'This item is no longer available.'; end if;
  if v_l.rent_price_monthly is null then raise exception 'This item is not available for rent.'; end if;
  if v_l.seller_id = v_uid then raise exception 'You cannot rent your own listing.'; end if;

  select * into v_sub from subcategories where sub_category_id = v_l.sub_category_id;
  if not found or not v_sub.rent_eligible then
    raise exception 'This kind of item cannot be rented.';
  end if;

  v_max := case when v_l.rent_to_buy_enabled then 10 else 6 end;
  if p_term_months < v_sub.rent_min_months then
    raise exception 'The minimum rental for this item is % month(s).', v_sub.rent_min_months;
  end if;
  if p_term_months > v_max then
    raise exception 'The maximum rental for this item is % months.', v_max;
  end if;

  if not exists (select 1 from saved_cards where card_id = p_card_id and user_id = v_uid) then
    raise exception 'A saved card is required to rent an item.';
  end if;

  v_rent := v_l.rent_price_monthly;

  insert into rentals (listing_id, listing_title, listing_price, renter_id, owner_id, card_id,
                       monthly_rent, term_months, upfront_amount, start_date, rent_to_buy)
  values (v_l.listing_id, v_l.title, v_l.price, v_uid, v_l.seller_id, p_card_id,
          v_rent, p_term_months,
          case when p_term_months >= 3 then v_rent * 3 else v_rent end,
          v_start,
          v_l.rent_to_buy_enabled and p_term_months > 6)
  returning rental_id into v_rental;

  if p_term_months >= 3 then
    -- Paid today: month 1, month 2 and the FINAL month
    foreach k in array array[1, 2, p_term_months] loop
      insert into rental_charges (rental_id, rent_month, period_start, charge_date, amount, kind, status, paid_at)
      values (v_rental, k, (v_start + make_interval(months => k - 1))::date, v_start,
              v_rent, 'upfront', 'paid', now());
    end loop;
    -- Months 3..N-1: charged one month before each is due
    for k in 3 .. p_term_months - 1 loop
      insert into rental_charges (rental_id, rent_month, period_start, charge_date, amount, kind)
      values (v_rental, k, (v_start + make_interval(months => k - 1))::date,
              (v_start + make_interval(months => k - 2))::date, v_rent, 'monthly');
    end loop;
  else
    -- 1-2 months: each month is charged in full at the start of that month
    for k in 1 .. p_term_months loop
      insert into rental_charges (rental_id, rent_month, period_start, charge_date, amount, kind, status, paid_at)
      values (v_rental, k, (v_start + make_interval(months => k - 1))::date,
              (v_start + make_interval(months => k - 1))::date, v_rent,
              case when k = 1 then 'upfront' else 'monthly' end,
              case when k = 1 then 'paid' else 'scheduled' end,
              case when k = 1 then now() else null end);
    end loop;
  end if;

  -- Owner pay-outs: one month's rent at the END of each rental month
  for k in 1 .. p_term_months loop
    insert into rental_payouts (rental_id, rent_month, release_date, amount)
    values (v_rental, k, (v_start + make_interval(months => k))::date, v_rent);
  end loop;

  update listings set status = 'rented', updated_at = now() where listing_id = v_l.listing_id;
  return v_rental;
end $$;

-- =======================================================
-- LEDGER: charge what is due, pay out what is earned, complete finished rentals
-- (called from the My Rentals page; in production this is a scheduled job)
-- =======================================================
create or replace function public.process_rental_ledger(p_rental_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r rentals%rowtype;
  v_today date;
begin
  select * into r from rentals where rental_id = p_rental_id;
  if not found then return; end if;
  if auth.uid() is null or not (auth.uid() in (r.renter_id, r.owner_id) or public.is_admin()) then
    raise exception 'Not allowed.';
  end if;
  if r.status <> 'active' then return; end if;

  v_today := current_date + r.demo_offset_days;

  update rental_charges set status = 'paid', paid_at = now()
   where rental_id = r.rental_id and status = 'scheduled' and charge_date <= v_today;

  update rental_payouts set status = 'released', released_at = now()
   where rental_id = r.rental_id and kind = 'rent' and status = 'scheduled' and release_date <= v_today;

  if not exists (select 1 from rental_payouts where rental_id = r.rental_id and status = 'scheduled')
     and v_today >= (r.start_date + make_interval(months => r.term_months))::date then
    update rentals set status = 'completed' where rental_id = r.rental_id;
    update listings set status = 'active', updated_at = now()
     where listing_id = r.listing_id and status = 'rented';
  end if;
end $$;

create or replace function public.process_my_rentals()
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  x uuid;
begin
  if auth.uid() is null then return 0; end if;
  for x in
    select rental_id from rentals
     where status = 'active' and (renter_id = auth.uid() or owner_id = auth.uid())
  loop
    perform public.process_rental_ledger(x);
    n := n + 1;
  end loop;
  return n;
end $$;

-- =======================================================
-- DEMO ONLY: pretend time has passed so a rental can be tested in minutes.
-- (Remove or revoke this before real money is ever involved.)
-- =======================================================
create or replace function public.demo_advance_rental(p_rental_id uuid, p_days int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_days < 1 or p_days > 400 then raise exception 'Choose between 1 and 400 days.'; end if;
  if not exists (select 1 from rentals where rental_id = p_rental_id and renter_id = auth.uid() and status = 'active') then
    raise exception 'Only the renter of an active rental can do this.';
  end if;
  update rentals set demo_offset_days = demo_offset_days + p_days where rental_id = p_rental_id;
  perform public.process_rental_ledger(p_rental_id);
end $$;

revoke all on function public.start_rental(uuid, int, uuid) from public;
revoke all on function public.process_rental_ledger(uuid) from public;
revoke all on function public.process_my_rentals() from public;
revoke all on function public.demo_advance_rental(uuid, int) from public;
grant execute on function public.start_rental(uuid, int, uuid) to authenticated;
grant execute on function public.process_rental_ledger(uuid) to authenticated;
grant execute on function public.process_my_rentals() to authenticated;
grant execute on function public.demo_advance_rental(uuid, int) to authenticated;


-- =======================================================
-- MARKETPLACE v2: c5_rent_to_buy_and_refunds.sql
-- =======================================================
-- COMMIT 5 · schema.   PR first, then run once in the Supabase SQL Editor (after commit 4).
-- Adds: rent-to-buy buy-out, breakage reports, refunds, and the admin review step.
--
-- BREAKAGE RULES
--   Small appliances (microwave, oven, deep fryer, air fryer): automatic FULL refund of the money
--     held (paid by the renter but not yet paid out to the owner). The owner claims a replacement
--     from the store / warranty themselves.
--   Fridges & freezers: the renter reports it; charges and pay-outs are FROZEN; a repairman inspects;
--     an admin then approves (refund) or rejects (rental carries on).
-- RENT-TO-BUY RULE
--   Only on rentals of 7-10 months of a listing with rent-to-buy on. After month 6 the renter can buy:
--     buy-out price = asking price - rent already paid.  The owner ends up with exactly the asking price.

create table if not exists rental_issues (
  issue_id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references rentals(rental_id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  item_type text not null check (item_type in ('fridge','small')),
  description text not null,
  status text not null default 'reported'
    check (status in ('reported','approved','rejected','auto_refunded')),
  repairman_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamp default current_timestamp,
  resolved_at timestamptz
);

create table if not exists rental_refunds (
  refund_id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references rentals(rental_id) on delete cascade,
  issue_id uuid references rental_issues(issue_id) on delete set null,
  amount decimal(10,2) not null,
  created_at timestamp default current_timestamp
);

alter table rental_issues enable row level security;
alter table rental_refunds enable row level security;
drop policy if exists "Renter, owner or admin views issues" on rental_issues;
drop policy if exists "Renter, owner or admin views refunds" on rental_refunds;
create policy "Renter, owner or admin views issues" on rental_issues for select
  using (exists (select 1 from rentals r where r.rental_id = rental_issues.rental_id
                 and (r.renter_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())));
create policy "Renter, owner or admin views refunds" on rental_refunds for select
  using (exists (select 1 from rentals r where r.rental_id = rental_refunds.rental_id
                 and (r.renter_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())));

-- Ledger: same as commit 4, but FROZEN while a fridge report is under investigation
create or replace function public.process_rental_ledger(p_rental_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r rentals%rowtype;
  v_today date;
begin
  select * into r from rentals where rental_id = p_rental_id;
  if not found then return; end if;
  if auth.uid() is null or not (auth.uid() in (r.renter_id, r.owner_id) or public.is_admin()) then
    raise exception 'Not allowed.';
  end if;
  if r.status <> 'active' then return; end if;
  if exists (select 1 from rental_issues where rental_id = r.rental_id and status = 'reported') then
    return;  -- under investigation: no charges, no pay-outs
  end if;

  v_today := current_date + r.demo_offset_days;

  update rental_charges set status = 'paid', paid_at = now()
   where rental_id = r.rental_id and status = 'scheduled' and charge_date <= v_today;

  update rental_payouts set status = 'released', released_at = now()
   where rental_id = r.rental_id and kind = 'rent' and status = 'scheduled' and release_date <= v_today;

  if not exists (select 1 from rental_payouts where rental_id = r.rental_id and status = 'scheduled')
     and v_today >= (r.start_date + make_interval(months => r.term_months))::date then
    update rentals set status = 'completed' where rental_id = r.rental_id;
    update listings set status = 'active', updated_at = now()
     where listing_id = r.listing_id and status = 'rented';
  end if;
end $$;

-- Internal: refund everything held (paid by the renter, not yet paid out) and close the rental
create or replace function public._refund_rental(p_rental_id uuid, p_issue_id uuid)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  r rentals%rowtype;
  v_paid numeric;
  v_released numeric;
  v_prev numeric;
  v_amount numeric;
begin
  select * into r from rentals where rental_id = p_rental_id for update;

  select coalesce(sum(amount), 0) into v_paid from rental_charges where rental_id = r.rental_id and status = 'paid';
  select coalesce(sum(amount), 0) into v_released from rental_payouts where rental_id = r.rental_id and status = 'released';
  select coalesce(sum(amount), 0) into v_prev from rental_refunds where rental_id = r.rental_id;
  v_amount := greatest(v_paid - v_released - v_prev, 0);

  update rental_charges set status = 'cancelled' where rental_id = r.rental_id and status = 'scheduled';
  update rental_payouts set status = 'cancelled' where rental_id = r.rental_id and status = 'scheduled';

  insert into rental_refunds (rental_id, issue_id, amount) values (r.rental_id, p_issue_id, v_amount);

  update rentals set status = 'refunded' where rental_id = r.rental_id;
  -- the broken item comes off the marketplace; the owner can re-activate it from My Listings
  update listings set status = 'inactive', updated_at = now()
   where listing_id = r.listing_id and status = 'rented';

  return v_amount;
end $$;
revoke all on function public._refund_rental(uuid, uuid) from public, authenticated;

-- RENTER: report a broken appliance.  Returns 'auto_refunded' (small appliances) or 'reported' (fridges).
create or replace function public.report_breakage(p_rental_id uuid, p_description text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r rentals%rowtype;
  v_type text;
  v_issue uuid;
begin
  if v_uid is null then raise exception 'Please log in first.'; end if;
  if length(trim(coalesce(p_description, ''))) < 5 then
    raise exception 'Please describe what went wrong (at least a few words).';
  end if;

  select * into r from rentals where rental_id = p_rental_id;
  if not found or r.renter_id <> v_uid then raise exception 'Only the renter can report a problem.'; end if;
  if r.status <> 'active' then raise exception 'This rental is no longer active.'; end if;
  if exists (select 1 from rental_issues where rental_id = r.rental_id and status = 'reported') then
    raise exception 'A report for this rental is already being investigated.';
  end if;

  perform public.process_rental_ledger(r.rental_id);   -- bring the ledger up to date first

  select case when sc.sub_category_name = 'Fridges & Freezers' then 'fridge'
              when sc.sub_category_name is null then 'fridge'   -- unknown: play safe, needs admin
              else 'small' end
    into v_type
    from (select 1) x
    left join listings l on l.listing_id = r.listing_id
    left join subcategories sc on sc.sub_category_id = l.sub_category_id;

  insert into rental_issues (rental_id, reporter_id, item_type, description)
  values (r.rental_id, v_uid, v_type, trim(p_description))
  returning issue_id into v_issue;

  if v_type = 'small' then
    perform public._refund_rental(r.rental_id, v_issue);
    update rental_issues set status = 'auto_refunded', resolved_at = now() where issue_id = v_issue;
    return 'auto_refunded';
  end if;

  return 'reported';
end $$;

-- ADMIN: after the repairman's inspection, approve (refund) or reject (rental continues)
create or replace function public.resolve_rental_issue(p_issue_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  i rental_issues%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'Please record the repairman''s findings.';
  end if;

  select * into i from rental_issues where issue_id = p_issue_id for update;
  if not found or i.status <> 'reported' then raise exception 'This report is not awaiting a decision.'; end if;

  update rental_issues
     set status = case when p_approve then 'approved' else 'rejected' end,
         repairman_note = trim(p_note), resolved_by = auth.uid(), resolved_at = now()
   where issue_id = p_issue_id;

  if p_approve then
    perform public._refund_rental(i.rental_id, i.issue_id);
  else
    perform public.process_rental_ledger(i.rental_id);  -- unfreeze: catch up charges and pay-outs
  end if;
end $$;

-- RENTER: rent-to-buy buy-out (opens after month 6).  Returns the new order id.
create or replace function public.buyout_rental(p_rental_id uuid, p_card_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r rentals%rowtype;
  v_today date;
  v_paid numeric;
  v_released numeric;
  v_held numeric;
  v_balance numeric;
  v_order uuid;
begin
  if v_uid is null then raise exception 'Please log in first.'; end if;

  select * into r from rentals where rental_id = p_rental_id for update;
  if not found or r.renter_id <> v_uid then raise exception 'Only the renter can buy this item.'; end if;
  if r.status <> 'active' then raise exception 'This rental is no longer active.'; end if;
  if not r.rent_to_buy then raise exception 'This rental is not a rent-to-buy rental.'; end if;
  if exists (select 1 from rental_issues where rental_id = r.rental_id and status = 'reported') then
    raise exception 'Buy-out is paused while a problem report is being investigated.';
  end if;

  perform public.process_rental_ledger(r.rental_id);

  v_today := current_date + r.demo_offset_days;
  if v_today < (r.start_date + make_interval(months => 6))::date then
    raise exception 'The buy-out opens after month 6 of the rental.';
  end if;

  select coalesce(sum(amount), 0) into v_paid from rental_charges where rental_id = r.rental_id and status = 'paid';
  select coalesce(sum(amount), 0) into v_released from rental_payouts where rental_id = r.rental_id and status = 'released';
  v_held := v_paid - v_released;
  v_balance := greatest(r.listing_price - v_paid, 0);     -- BUY PRICE = full price - rent paid

  if v_balance > 0 and not exists (select 1 from saved_cards where card_id = p_card_id and user_id = v_uid) then
    raise exception 'Please choose a valid card.';
  end if;

  insert into orders (buyer_id, seller_id, total_amount, status)
  values (v_uid, r.owner_id, r.listing_price, 'completed')
  returning order_id into v_order;

  insert into order_items (order_id, listing_id, quantity, unit_price, subtotal)
  values (v_order, r.listing_id, 1, r.listing_price, r.listing_price);

  if v_balance > 0 then
    insert into payments (order_id, amount, payment_method, payment_reference, status)
    values (v_order, v_balance, 'card', 'DEMO-BUYOUT-' || upper(substr(md5(random()::text), 1, 8)), 'completed');
  end if;

  update rental_charges set status = 'cancelled' where rental_id = r.rental_id and status = 'scheduled';
  update rental_payouts set status = 'cancelled' where rental_id = r.rental_id and status = 'scheduled';

  insert into rental_charges (rental_id, rent_month, period_start, charge_date, amount, kind, status, paid_at)
  values (r.rental_id, 0, v_today, v_today, v_balance, 'buyout', 'paid', now());

  -- the owner receives everything still held plus the balance: in total exactly the asking price
  insert into rental_payouts (rental_id, rent_month, release_date, amount, kind, status, released_at)
  values (r.rental_id, 0, v_today, v_held + v_balance, 'buyout', 'released', now());

  update rentals set status = 'bought' where rental_id = r.rental_id;
  update listings set status = 'sold', updated_at = now() where listing_id = r.listing_id;
  return v_order;
end $$;

revoke all on function public.report_breakage(uuid, text) from public;
revoke all on function public.resolve_rental_issue(uuid, boolean, text) from public;
revoke all on function public.buyout_rental(uuid, uuid) from public;
grant execute on function public.report_breakage(uuid, text) to authenticated;
grant execute on function public.resolve_rental_issue(uuid, boolean, text) to authenticated;
grant execute on function public.buyout_rental(uuid, uuid) to authenticated;
-- =====================================================================
-- Campus Connect: Laundry module
-- Workflow: commit this file in a PR first. Run it in the Supabase
-- SQL Editor only AFTER the PR is merged. Safe to re-run.
-- =====================================================================
--
-- Rules encoded here
--   * One campus laundry room. Nine slots a day, one every 105 minutes
--     (90 min + 15 min grace). Times are Africa/Johannesburg.
--   * Cycles: 'both' (wash + dry, 90 min), 'wash' (60 min), 'dry' (60 min).
--     Every cycle books one of the same nine slots.
--   * Capacity per slot, per machine type = active machines - 1 (reserve).
--       washers used = 'both' + 'wash' bookings
--       dryers  used = 'both' + 'dry'  bookings
--   * A student may not hold a wash-only AND a dry-only booking on the
--     same day (they should book 'both'). Different days are fine.
--   * Students can book up to 7 days ahead and cancel up to 30 min
--     before the slot starts.
--   * Walk-ups (max 4 a day) are a house rule in the room, not tracked here.
-- =====================================================================

create table if not exists laundry_machines (
  machine_id  uuid primary key default gen_random_uuid(),
  name        text not null,
  machine_type text not null check (machine_type in ('washer', 'dryer')),
  active      boolean not null default true,
  created_at  timestamptz default now()
);

create table if not exists laundry_bookings (
  booking_id  uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slot_start  timestamptz not null,
  cycle       text not null default 'both' check (cycle in ('both', 'wash', 'dry')),
  status      text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at  timestamptz default now()
);

-- one confirmed booking per student per slot (they can rebook after cancelling)
create unique index if not exists laundry_one_booking_per_slot
  on laundry_bookings (user_id, slot_start) where status = 'confirmed';

create index if not exists laundry_bookings_slot_idx
  on laundry_bookings (slot_start) where status = 'confirmed';

-- Starting machines: 5 washers + 5 dryers (only when the table is empty)
do $$
begin
  if not exists (select 1 from laundry_machines) then
    insert into laundry_machines (name, machine_type)
      select 'Washer ' || g, 'washer' from generate_series(1, 5) g;
    insert into laundry_machines (name, machine_type)
      select 'Dryer ' || g, 'dryer' from generate_series(1, 5) g;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- Students can read machines and their OWN bookings. All writes to
-- bookings go through the functions below (security definer), so there
-- are deliberately no insert/update/delete policies on laundry_bookings.
-- Machine add/remove is SQL-Editor-only until the admin view exists —
-- when it's built, gate its writes with the existing public.is_admin()
-- (see schema.sql §9), the same check the rental-issue admin queue uses.
-- No separate laundry_staff table is needed for that.
-- ---------------------------------------------------------------------
alter table laundry_machines enable row level security;
alter table laundry_bookings enable row level security;

drop policy if exists "machines readable by signed-in users" on laundry_machines;
create policy "machines readable by signed-in users"
  on laundry_machines for select to authenticated using (true);

drop policy if exists "students read own bookings" on laundry_bookings;
create policy "students read own bookings"
  on laundry_bookings for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Availability: spots left per slot for one day
-- (security definer, because students cannot read other students' rows)
-- ---------------------------------------------------------------------
create or replace function laundry_availability(p_day date)
returns table (slot_start timestamptz, washers_left int, dryers_left int)
language sql
stable
security definer
set search_path = public
as $$
  with cap as (
    select
      greatest(count(*) filter (where machine_type = 'washer' and active) - 1, 0) as w,
      greatest(count(*) filter (where machine_type = 'dryer'  and active) - 1, 0) as d
    from laundry_machines
  ),
  slots as (
    select ((p_day + t) at time zone 'Africa/Johannesburg') as s
    from unnest(array['06:00','07:45','09:30','11:15','13:00','14:45','16:30','18:15','20:00']::time[]) as t
  )
  select
    slots.s,
    greatest(cap.w - b.w_used, 0)::int,
    greatest(cap.d - b.d_used, 0)::int
  from slots
  cross join cap
  cross join lateral (
    select
      count(*) filter (where cycle in ('both', 'wash')) as w_used,
      count(*) filter (where cycle in ('both', 'dry'))  as d_used
    from laundry_bookings lb
    where lb.slot_start = slots.s and lb.status = 'confirmed'
  ) b
  order by slots.s;
$$;

-- ---------------------------------------------------------------------
-- Book a slot. Locks the student's day and the slot so two people can't
-- take the last spot at the same moment.
-- ---------------------------------------------------------------------
create or replace function book_laundry_slot(p_slot_start timestamptz, p_cycle text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_local    timestamp := p_slot_start at time zone 'Africa/Johannesburg';
  v_day      date := (p_slot_start at time zone 'Africa/Johannesburg')::date;
  v_today    date := (now() at time zone 'Africa/Johannesburg')::date;
  v_cap_w    int;
  v_cap_d    int;
  v_used_w   int;
  v_used_d   int;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in to book a slot.' using errcode = '28000';
  end if;

  if p_cycle not in ('both', 'wash', 'dry') then
    raise exception 'Choose Wash + Dry, Wash only or Dry only.';
  end if;

  if not (v_local::time = any (array['06:00','07:45','09:30','11:15','13:00','14:45','16:30','18:15','20:00']::time[])) then
    raise exception 'That is not a valid laundry time.';
  end if;

  if p_slot_start <= now() then
    raise exception 'That slot has already started. Pick a later one.';
  end if;

  if v_day > v_today + 6 then
    raise exception 'You can book up to 7 days ahead.';
  end if;

  -- locks, always taken in the same order (student, then slot) to avoid deadlocks
  perform pg_advisory_xact_lock(hashtextextended('laundry-user:' || v_uid::text || ':' || v_day::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('laundry-slot:' || p_slot_start::text, 0));

  if exists (
    select 1 from laundry_bookings
    where user_id = v_uid and slot_start = p_slot_start and status = 'confirmed'
  ) then
    raise exception 'You already have a booking in that slot.';
  end if;

  -- no wash-only + dry-only split on the same day
  if p_cycle in ('wash', 'dry') and exists (
    select 1 from laundry_bookings
    where user_id = v_uid
      and status = 'confirmed'
      and (slot_start at time zone 'Africa/Johannesburg')::date = v_day
      and cycle in ('wash', 'dry')
      and cycle <> p_cycle
  ) then
    raise exception 'You can''t book wash and dry separately on the same day. Choose Wash + Dry, or pick another day.';
  end if;

  select
    greatest(count(*) filter (where machine_type = 'washer' and active) - 1, 0),
    greatest(count(*) filter (where machine_type = 'dryer'  and active) - 1, 0)
  into v_cap_w, v_cap_d
  from laundry_machines;

  select
    count(*) filter (where cycle in ('both', 'wash')),
    count(*) filter (where cycle in ('both', 'dry'))
  into v_used_w, v_used_d
  from laundry_bookings
  where slot_start = p_slot_start and status = 'confirmed';

  if p_cycle in ('both', 'wash') and v_used_w >= v_cap_w then
    raise exception 'No washers left in that slot. Try another time.';
  end if;
  if p_cycle in ('both', 'dry') and v_used_d >= v_cap_d then
    raise exception 'No dryers left in that slot. Try another time.';
  end if;

  insert into laundry_bookings (user_id, slot_start, cycle)
  values (v_uid, p_slot_start, p_cycle)
  returning booking_id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Cancel your own booking, up to 30 minutes before it starts
-- ---------------------------------------------------------------------
create or replace function cancel_laundry_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_start timestamptz;
begin
  if v_uid is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;

  select slot_start into v_start
  from laundry_bookings
  where booking_id = p_booking_id and user_id = v_uid and status = 'confirmed'
  for update;

  if v_start is null then
    raise exception 'Booking not found.';
  end if;

  if v_start - interval '30 minutes' <= now() then
    raise exception 'Bookings can only be cancelled up to 30 minutes before the slot starts.';
  end if;

  update laundry_bookings set status = 'cancelled' where booking_id = p_booking_id;
end;
$$;

-- only signed-in users may call these
revoke all on function laundry_availability(date)               from public, anon;
revoke all on function book_laundry_slot(timestamptz, text)     from public, anon;
revoke all on function cancel_laundry_booking(uuid)             from public, anon;
grant execute on function laundry_availability(date)            to authenticated;
grant execute on function book_laundry_slot(timestamptz, text)  to authenticated;
grant execute on function cancel_laundry_booking(uuid)          to authenticated;

-- =======================================================
-- MARKETPLACE v2: c6_messaging_notifications.sql
-- =======================================================
-- ============================================================================
-- c6_messaging_notifications.sql  (v2 — verified against the live database's
-- information_schema on 22 Sept 2026, not guessed from docs)
--
-- Unlike the first draft, this does NOT touch the `messages` or
-- `notifications` tables' existing structure or RLS — both already exist
-- with real rows/policies and are extended in place, not dropped.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RESERVE FOR BUYER — seller-only, only for someone who has actually
--    messaged them about this listing.
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists reserved_for uuid references auth.users(id) on delete set null;

create or replace function public.reserve_listing_for(p_listing_id uuid, p_buyer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
begin
  select seller_id into v_seller from listings where listing_id = p_listing_id;
  if v_seller is null then
    raise exception 'listing not found';
  end if;
  if v_seller <> auth.uid() then
    raise exception 'only the seller can reserve this listing';
  end if;

  if p_buyer_id is not null and not exists (
    select 1 from messages
    where listing_id = p_listing_id
      and sender_id = p_buyer_id
      and receiver_id = v_seller
  ) then
    raise exception 'that person has not messaged you about this listing';
  end if;

  update listings set reserved_for = p_buyer_id where listing_id = p_listing_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. MESSAGE THREADS — the `messages` table itself is untouched; it already
--    has everything a per-listing chat needs (sender_id, receiver_id,
--    listing_id, message, is_read). This view just groups it into threads
--    for the inbox.
-- ---------------------------------------------------------------------------
create or replace view public.my_message_threads as
select
  m.listing_id,
  l.title as listing_title,
  case when m.sender_id = auth.uid() then m.receiver_id else m.sender_id end as counterpart_id,
  max(m.created_at) as last_at,
  (array_agg(m.message order by m.created_at desc))[1] as last_message,
  count(*) filter (where m.receiver_id = auth.uid() and m.is_read = false) as unread_count
from messages m
join listings l on l.listing_id = m.listing_id
where m.sender_id = auth.uid() or m.receiver_id = auth.uid()
group by m.listing_id, l.title, counterpart_id;

-- ---------------------------------------------------------------------------
-- 3. EDIT LISTING — whitelists editable fields only; status/seller_id/is_demo
--    are never touched here (also closes the RLS gap from docs §3/§10 for
--    listings edited through this path).
-- ---------------------------------------------------------------------------
create or replace function public.update_listing(
  p_listing_id          uuid,
  p_title               text,
  p_description         text,
  p_price               numeric,
  p_sub_category_id     uuid,
  p_condition           text,
  p_rent_price_monthly  numeric,
  p_rent_to_buy_enabled boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
  v_status text;
begin
  select seller_id, status into v_seller, v_status
  from listings where listing_id = p_listing_id;

  if v_seller is null then
    raise exception 'listing not found';
  end if;
  if v_seller <> auth.uid() then
    raise exception 'not your listing';
  end if;
  if v_status <> 'active' then
    raise exception 'only active listings can be edited';
  end if;

  update listings
  set title               = p_title,
      description          = p_description,
      price                = p_price,
      sub_category_id      = p_sub_category_id,
      condition            = p_condition,
      rent_price_monthly   = p_rent_price_monthly,
      rent_to_buy_enabled  = p_rent_to_buy_enabled
  where listing_id = p_listing_id;
end;
$$;
-- enforce_rent_rules (already in your schema) still fires on this UPDATE and
-- rejects rent settings on a non-eligible subcategory or rent-to-buy under
-- R2000 — no duplicate validation needed here.

-- ---------------------------------------------------------------------------
-- 4. NOTIFICATIONS — extend the existing table in place (add nullable
--    linking columns), don't touch its existing rows/select policy.
--    `type` is a plain varchar live, not enum-constrained (confirmed), so
--    the new type strings below insert fine alongside the existing values.
-- ---------------------------------------------------------------------------
alter table public.notifications add column if not exists listing_id      uuid references public.listings(listing_id) on delete cascade;
alter table public.notifications add column if not exists order_id       uuid references public.orders(order_id) on delete cascade;
alter table public.notifications add column if not exists rental_id      uuid references public.rentals(rental_id) on delete cascade;
alter table public.notifications add column if not exists rental_issue_id uuid references public.rental_issues(issue_id) on delete cascade;

-- Users could view their own notifications but not mark them read — adding
-- that policy (additive, doesn't touch the existing select policy).
drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_notification(
  p_user_id         uuid,
  p_type            text,
  p_title           text,
  p_message         text default null,
  p_listing_id      uuid default null,
  p_order_id        uuid default null,
  p_rental_id       uuid default null,
  p_rental_issue_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, title, message, listing_id, order_id, rental_id, rental_issue_id)
  values (p_user_id, p_type, p_title, p_message, p_listing_id, p_order_id, p_rental_id, p_rental_issue_id);
end;
$$;

-- 4a. Sale + Purchase — orders already carries buyer_id AND seller_id
--     directly, so no join through order_items is even needed to find who
--     to notify; it's only used here to grab the listing title for the text.
create or replace function public.notify_on_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  select l.title into v_title
  from order_items oi
  join listings l on l.listing_id = oi.listing_id
  where oi.order_id = new.order_id
  limit 1;

  if new.seller_id is not null then
    perform create_notification(
      new.seller_id, 'sale', 'Your item sold',
      coalesce(v_title, 'Your listing') || ' just sold.', null, new.order_id
    );
  end if;

  perform create_notification(
    new.buyer_id, 'purchase', 'Purchase confirmed',
    'Your order for ' || coalesce(v_title, 'an item') || ' is confirmed.', null, new.order_id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_order_insert on orders;
create trigger trg_notify_on_order_insert
  after insert on orders
  for each row execute function notify_on_order_insert();

-- 4b. Rental payment (renter charged) + rent payment (owner paid out)
create or replace function public.notify_on_rental_charge_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_renter uuid;
  v_title  text;
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    select r.renter_id, r.listing_title into v_renter, v_title
    from rentals r where r.rental_id = new.rental_id;

    perform create_notification(
      v_renter, 'rental_payment', 'Rental payment taken',
      'R' || new.amount || ' was charged for your rental of ' || coalesce(v_title, 'an item') || '.',
      null, null, new.rental_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_rental_charge_paid on rental_charges;
create trigger trg_notify_on_rental_charge_paid
  after update on rental_charges
  for each row execute function notify_on_rental_charge_paid();

create or replace function public.notify_on_rental_payout_released()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  if new.status = 'released' and (old.status is distinct from 'released') then
    select r.owner_id, r.listing_title into v_owner, v_title
    from rentals r where r.rental_id = new.rental_id;

    perform create_notification(
      v_owner, 'rent_payment', 'Rent payment released',
      'R' || new.amount || ' was paid out to you for ' || coalesce(v_title, 'your rental') || '.',
      null, null, new.rental_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_rental_payout_released on rental_payouts;
create trigger trg_notify_on_rental_payout_released
  after update on rental_payouts
  for each row execute function notify_on_rental_payout_released();

-- 4c. Admin review — fires when a breakage report leaves 'reported' into
--     'approved'/'rejected' (not 'auto_refunded' — that path is instant and
--     never goes through an admin, per docs §9.7). Notifies both sides.
create or replace function public.notify_on_rental_issue_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_renter  uuid;
  v_owner   uuid;
  v_title   text;
  v_outcome text;
begin
  if new.status in ('approved', 'rejected') and (old.status is distinct from new.status) then
    select r.renter_id, r.owner_id, r.listing_title into v_renter, v_owner, v_title
    from rentals r where r.rental_id = new.rental_id;

    v_outcome := case when new.status = 'approved' then 'approved — you have been refunded'
                       else 'reviewed — no refund was issued' end;

    perform create_notification(
      v_renter, 'admin_review', 'Your breakage report was reviewed',
      'Your report on ' || coalesce(v_title, 'your rental') || ' was ' || v_outcome || '.',
      null, null, new.rental_id, new.issue_id
    );
    perform create_notification(
      v_owner, 'admin_review', 'A breakage report on your item was reviewed',
      'The report on ' || coalesce(v_title, 'your item') || ' was ' || v_outcome || '.',
      null, null, new.rental_id, new.issue_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_rental_issue_resolved on rental_issues;
create trigger trg_notify_on_rental_issue_resolved
  after update on rental_issues
  for each row execute function notify_on_rental_issue_resolved();

-- =======================================================
-- MARKETPLACE v2: c7_admin_restrictions.sql
-- =======================================================
-- ============================================================================
-- c7_admin_restrictions.sql
-- Admin accounts can browse everything but cannot buy, rent, buy-out, or
-- create listings — enforced here, not just hidden in the UI.
-- ============================================================================

-- Sellers can't be admins (blocks creating a listing at the DB level).
drop policy if exists "Sellers can insert their own listings" on listings;
create policy "Sellers can insert their own listings"
  on listings for insert
  with check (seller_id = auth.uid() and not public.is_admin());

-- purchase_listing — unchanged except the added admin guard after the login check.
create or replace function public.purchase_listing(
  p_listing_id uuid,
  p_method payment_method default 'card',
  p_card_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_l listings%rowtype;
  v_order uuid;
begin
  if v_uid is null then raise exception 'Please log in first.'; end if;
  if public.is_admin() then raise exception 'Admin accounts cannot make purchases.'; end if;
  if p_method not in ('card','cash') then raise exception 'Unsupported payment method.'; end if;

  select * into v_l from listings where listing_id = p_listing_id for update;
  if not found or v_l.status <> 'active' then raise exception 'This item is no longer available.'; end if;
  if v_l.seller_id = v_uid then raise exception 'You cannot buy your own listing.'; end if;
  if p_method = 'card' and not exists (
    select 1 from saved_cards where card_id = p_card_id and user_id = v_uid
  ) then raise exception 'Please choose a valid card.'; end if;

  insert into orders (buyer_id, seller_id, total_amount, status)
  values (v_uid, v_l.seller_id, v_l.price, 'confirmed')
  returning order_id into v_order;

  insert into order_items (order_id, listing_id, quantity, unit_price, subtotal)
  values (v_order, v_l.listing_id, 1, v_l.price, v_l.price);

  insert into payments (order_id, amount, payment_method, payment_reference, status)
  values (v_order, v_l.price, p_method,
          'DEMO-' || upper(substr(md5(random()::text), 1, 10)),
          (case when p_method = 'card' then 'completed' else 'pending' end)::payment_status);

  update listings set status = 'sold', updated_at = now() where listing_id = v_l.listing_id;
  return v_order;
end $$;

-- start_rental — unchanged except the added admin guard after the login check.
create or replace function public.start_rental(
  p_listing_id uuid,
  p_term_months int,
  p_card_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_l listings%rowtype;
  v_sub subcategories%rowtype;
  v_rental uuid;
  v_start date := current_date;
  v_max int;
  v_rent numeric;
  k int;
begin
  if v_uid is null then raise exception 'Please log in first.'; end if;
  if public.is_admin() then raise exception 'Admin accounts cannot rent items.'; end if;

  select * into v_l from listings where listing_id = p_listing_id for update;
  if not found or v_l.status <> 'active' then raise exception 'This item is no longer available.'; end if;
  if v_l.rent_price_monthly is null then raise exception 'This item is not available for rent.'; end if;
  if v_l.seller_id = v_uid then raise exception 'You cannot rent your own listing.'; end if;

  select * into v_sub from subcategories where sub_category_id = v_l.sub_category_id;
  if not found or not v_sub.rent_eligible then
    raise exception 'This kind of item cannot be rented.';
  end if;

  v_max := case when v_l.rent_to_buy_enabled then 10 else 6 end;
  if p_term_months < v_sub.rent_min_months then
    raise exception 'The minimum rental for this item is % month(s).', v_sub.rent_min_months;
  end if;
  if p_term_months > v_max then
    raise exception 'The maximum rental for this item is % months.', v_max;
  end if;

  if not exists (select 1 from saved_cards where card_id = p_card_id and user_id = v_uid) then
    raise exception 'A saved card is required to rent an item.';
  end if;

  v_rent := v_l.rent_price_monthly;

  insert into rentals (listing_id, listing_title, listing_price, renter_id, owner_id, card_id,
                       monthly_rent, term_months, upfront_amount, start_date, rent_to_buy)
  values (v_l.listing_id, v_l.title, v_l.price, v_uid, v_l.seller_id, p_card_id,
          v_rent, p_term_months,
          case when p_term_months >= 3 then v_rent * 3 else v_rent end,
          v_start,
          v_l.rent_to_buy_enabled and p_term_months > 6)
  returning rental_id into v_rental;

  if p_term_months >= 3 then
    foreach k in array array[1, 2, p_term_months] loop
      insert into rental_charges (rental_id, rent_month, period_start, charge_date, amount, kind, status, paid_at)
      values (v_rental, k, (v_start + make_interval(months => k - 1))::date, v_start,
              v_rent, 'upfront', 'paid', now());
    end loop;
    for k in 3 .. p_term_months - 1 loop
      insert into rental_charges (rental_id, rent_month, period_start, charge_date, amount, kind)
      values (v_rental, k, (v_start + make_interval(months => k - 1))::date,
              (v_start + make_interval(months => k - 2))::date, v_rent, 'monthly');
    end loop;
  else
    for k in 1 .. p_term_months loop
      insert into rental_charges (rental_id, rent_month, period_start, charge_date, amount, kind, status, paid_at)
      values (v_rental, k, (v_start + make_interval(months => k - 1))::date,
              (v_start + make_interval(months => k - 1))::date, v_rent,
              case when k = 1 then 'upfront' else 'monthly' end,
              case when k = 1 then 'paid' else 'scheduled' end,
              case when k = 1 then now() else null end);
    end loop;
  end if;

  for k in 1 .. p_term_months loop
    insert into rental_payouts (rental_id, rent_month, release_date, amount)
    values (v_rental, k, (v_start + make_interval(months => k))::date, v_rent);
  end loop;

  update listings set status = 'rented', updated_at = now() where listing_id = v_l.listing_id;
  return v_rental;
end $$;

-- buyout_rental — unchanged except the added admin guard after the login check.
-- (Admins can never reach this anyway since start_rental now blocks them from
-- ever having a rental, but it's guarded directly too, defense in depth.)
create or replace function public.buyout_rental(p_rental_id uuid, p_card_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r rentals%rowtype;
  v_today date;
  v_paid numeric;
  v_released numeric;
  v_held numeric;
  v_balance numeric;
  v_order uuid;
begin
  if v_uid is null then raise exception 'Please log in first.'; end if;
  if public.is_admin() then raise exception 'Admin accounts cannot make purchases.'; end if;

  select * into r from rentals where rental_id = p_rental_id for update;
  if not found or r.renter_id <> v_uid then raise exception 'Only the renter can buy this item.'; end if;
  if r.status <> 'active' then raise exception 'This rental is no longer active.'; end if;
  if not r.rent_to_buy then raise exception 'This rental is not a rent-to-buy rental.'; end if;
  if exists (select 1 from rental_issues where rental_id = r.rental_id and status = 'reported') then
    raise exception 'Buy-out is paused while a problem report is being investigated.';
  end if;

  perform public.process_rental_ledger(r.rental_id);

  v_today := current_date + r.demo_offset_days;
  if v_today < (r.start_date + make_interval(months => 6))::date then
    raise exception 'The buy-out opens after month 6 of the rental.';
  end if;

  select coalesce(sum(amount), 0) into v_paid from rental_charges where rental_id = r.rental_id and status = 'paid';
  select coalesce(sum(amount), 0) into v_released from rental_payouts where rental_id = r.rental_id and status = 'released';
  v_held := v_paid - v_released;
  v_balance := greatest(r.listing_price - v_paid, 0);

  if v_balance > 0 and not exists (select 1 from saved_cards where card_id = p_card_id and user_id = v_uid) then
    raise exception 'Please choose a valid card.';
  end if;

  insert into orders (buyer_id, seller_id, total_amount, status)
  values (v_uid, r.owner_id, r.listing_price, 'completed')
  returning order_id into v_order;

  insert into order_items (order_id, listing_id, quantity, unit_price, subtotal)
  values (v_order, r.listing_id, 1, r.listing_price, r.listing_price);

  if v_balance > 0 then
    insert into payments (order_id, amount, payment_method, payment_reference, status)
    values (v_order, v_balance, 'card', 'DEMO-BUYOUT-' || upper(substr(md5(random()::text), 1, 8)), 'completed');
  end if;

  update rental_charges set status = 'cancelled' where rental_id = r.rental_id and status = 'scheduled';
  update rental_payouts set status = 'cancelled' where rental_id = r.rental_id and status = 'scheduled';

  insert into rental_charges (rental_id, rent_month, period_start, charge_date, amount, kind, status, paid_at)
  values (r.rental_id, 0, v_today, v_today, v_balance, 'buyout', 'paid', now());

  insert into rental_payouts (rental_id, rent_month, release_date, amount, kind, status, released_at)
  values (r.rental_id, 0, v_today, v_held + v_balance, 'buyout', 'released', now());

  update rentals set status = 'bought' where rental_id = r.rental_id;
  update listings set status = 'sold', updated_at = now() where listing_id = r.listing_id;
  return v_order;
end $$;