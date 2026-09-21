-- =======================================================
-- CAMPUSCONNECT DATABASE SCHEMA (merged & corrected)
-- Auth: Supabase Auth (auth.users) -- do NOT create a
-- separate users/roles table for logins, Supabase already handles this.
--
-- This file reflects the live database after the cleanup
-- migration (migration_cleanup.sql) removed 14 unrelated/
-- duplicate tables and restored `profiles`, plus section 9
-- (UFH domain restriction + roles).
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
