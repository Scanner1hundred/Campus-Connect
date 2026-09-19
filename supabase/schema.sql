-- =======================================================
-- CAMPUSCONNECT DATABASE SCHEMA (merged & corrected)
-- Auth: Supabase Auth (auth.users) -- do NOT create a
-- separate users/roles table, Supabase already handles this.
--
-- This file reflects the live database after the cleanup
-- migration (migration_cleanup.sql) removed 14 unrelated/
-- duplicate tables and restored `profiles`.
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

-- Auto-create a profile row the moment someone signs up, so
-- new users don't need to visit /profile before their name
-- shows up anywhere (RLS blocks a client-side insert before
-- email confirmation, hence the server-side trigger).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
