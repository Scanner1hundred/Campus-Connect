
-- ============================================================================
-- STUDENT MARKETPLACE & STUDENT CENTRE DATABASE SCHEMA
-- Generated to match ERD (Crow's Foot Notation)
-- Target: Supabase (PostgreSQL)
-- ============================================================================
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New Query)
-- ============================================================================

-- Supabase already has pgcrypto enabled, which gives us gen_random_uuid()
create extension if not exists pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

create type listing_status as enum ('active', 'sold', 'inactive', 'pending', 'removed');
create type order_status as enum ('pending', 'confirmed', 'shipped', 'completed', 'cancelled', 'refunded');
create type payment_method as enum ('card', 'eft', 'cash', 'mobile_money', 'other');
create type payment_status as enum ('pending', 'completed', 'failed', 'refunded');
create type notification_type as enum ('message', 'order', 'payment', 'review', 'favorite', 'system');

-- ============================================================================
-- ROLES
-- ============================================================================

create table roles (
    role_id     uuid primary key default gen_random_uuid(),
    role_name   text not null unique,
    description text
);

-- ============================================================================
-- USERS
-- ============================================================================

create table users (
    user_id        uuid primary key default gen_random_uuid(),
    email          text not null unique,
    password_hash  text not null,
    role_id        uuid references roles(role_id) on delete set null,
    is_active      boolean not null default true,
    last_login     timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- ============================================================================
-- PROFILES  (1-to-1 optional with USERS)
-- ============================================================================

create table profiles (
    user_id           uuid primary key references users(user_id) on delete cascade,
    full_name         text not null,
    student_number    text not null unique,
    phone_number      text,
    profile_image_url text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- ============================================================================
-- CATEGORIES
-- ============================================================================

create table categories (
    category_id   uuid primary key default gen_random_uuid(),
    category_name text not null unique,
    description   text,
    icon_url      text,
    created_at    timestamptz not null default now()
);

-- ============================================================================
-- SUBCATEGORIES
-- ============================================================================

create table subcategories (
    sub_category_id   uuid primary key default gen_random_uuid(),
    category_id       uuid not null references categories(category_id) on delete cascade,
    sub_category_name text not null unique,
    created_at        timestamptz not null default now()
);

-- ============================================================================
-- LISTINGS
-- ============================================================================

create table listings (
    listing_id      uuid primary key default gen_random_uuid(),
    seller_id       uuid not null references users(user_id) on delete cascade,
    sub_category_id uuid not null references subcategories(sub_category_id) on delete restrict,
    title           text not null,
    description     text,
    condition       text,
    price           decimal(10,2) not null,
    status          listing_status not null default 'active',
    views_count     integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ============================================================================
-- LISTING_IMAGES
-- ============================================================================

create table listing_images (
    image_id    uuid primary key default gen_random_uuid(),
    listing_id  uuid not null references listings(listing_id) on delete cascade,
    image_url   text not null,
    is_primary  boolean not null default false,
    created_at  timestamptz not null default now()
);

-- ============================================================================
-- FAVORITES
-- ============================================================================

create table favorites (
    favorite_id uuid primary key default gen_random_uuid(),
    user_id     uuid not null references users(user_id) on delete cascade,
    listing_id  uuid not null references listings(listing_id) on delete cascade,
    created_at  timestamptz not null default now(),
    unique (user_id, listing_id)
);

-- ============================================================================
-- MESSAGES
-- ============================================================================

create table messages (
    message_id  uuid primary key default gen_random_uuid(),
    sender_id   uuid not null references users(user_id) on delete cascade,
    receiver_id uuid not null references users(user_id) on delete cascade,
    listing_id  uuid references listings(listing_id) on delete set null,
    message     text not null,
    is_read     boolean not null default false,
    created_at  timestamptz not null default now()
);

-- ============================================================================
-- ORDERS
-- ============================================================================

create table orders (
    order_id     uuid primary key default gen_random_uuid(),
    buyer_id     uuid not null references users(user_id) on delete restrict,
    seller_id    uuid not null references users(user_id) on delete restrict,
    order_date   timestamptz not null default now(),
    total_amount decimal(10,2) not null,
    status       order_status not null default 'pending'
);

-- ============================================================================
-- ORDER_ITEMS
-- ============================================================================

create table order_items (
    order_item_id uuid primary key default gen_random_uuid(),
    order_id      uuid not null references orders(order_id) on delete cascade,
    listing_id    uuid not null references listings(listing_id) on delete restrict,
    quantity      integer not null default 1,
    unit_price    decimal(10,2) not null,
    subtotal      decimal(10,2) not null
);

-- ============================================================================
-- PAYMENTS
-- ============================================================================

create table payments (
    payment_id       uuid primary key default gen_random_uuid(),
    order_id         uuid not null references orders(order_id) on delete cascade,
    amount           decimal(10,2) not null,
    payment_method   payment_method not null,
    payment_reference text,
    payment_date     timestamptz not null default now(),
    status           payment_status not null default 'pending'
);

-- ============================================================================
-- REVIEWS
-- ============================================================================

create table reviews (
    review_id   uuid primary key default gen_random_uuid(),
    listing_id  uuid not null references listings(listing_id) on delete cascade,
    reviewer_id uuid not null references users(user_id) on delete cascade,
    rating      integer not null check (rating between 1 and 5),
    review_text text,
    created_at  timestamptz not null default now()
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

create table notifications (
    notification_id uuid primary key default gen_random_uuid(),
    user_id         uuid not null references users(user_id) on delete cascade,
    type            notification_type not null,
    title           text not null,
    message         text,
    is_read         boolean not null default false,
    created_at      timestamptz not null default now()
);

-- ============================================================================
-- AUDIT_LOGS
-- ============================================================================

create table audit_logs (
    log_id      uuid primary key default gen_random_uuid(),
    user_id     uuid references users(user_id) on delete set null,
    action      text not null,
    table_name  text not null,
    record_id   uuid,
    old_values  jsonb,
    new_values  jsonb,
    action_date timestamptz not null default now()
);

-- ============================================================================
-- INDEXES (for common lookups & foreign keys)
-- ============================================================================

create index idx_users_role_id            on users(role_id);
create index idx_subcategories_category   on subcategories(category_id);
create index idx_listings_seller          on listings(seller_id);
create index idx_listings_subcategory     on listings(sub_category_id);
create index idx_listings_status          on listings(status);
create index idx_listing_images_listing   on listing_images(listing_id);
create index idx_favorites_user           on favorites(user_id);
create index idx_favorites_listing        on favorites(listing_id);
create index idx_messages_sender          on messages(sender_id);
create index idx_messages_receiver        on messages(receiver_id);
create index idx_messages_listing         on messages(listing_id);
create index idx_orders_buyer             on orders(buyer_id);
create index idx_orders_seller            on orders(seller_id);
create index idx_order_items_order        on order_items(order_id);
create index idx_order_items_listing      on order_items(listing_id);
create index idx_payments_order           on payments(order_id);
create index idx_reviews_listing          on reviews(listing_id);
create index idx_reviews_reviewer         on reviews(reviewer_id);
create index idx_notifications_user       on notifications(user_id);
create index idx_audit_logs_user          on audit_logs(user_id);

-- ============================================================================
-- updated_at auto-update triggers
-- ============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
    before update on users
    for each row execute function set_updated_at();

create trigger trg_profiles_updated_at
    before update on profiles
    for each row execute function set_updated_at();

create trigger trg_listings_updated_at
    before update on listings
    for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Enabled on all tables. Supabase requires policies before data is
-- accessible via the API when RLS is on — adjust these to your auth model.
-- These are permissive starter policies; tighten before going to production.
-- ============================================================================

alter table roles           enable row level security;
alter table users            enable row level security;
alter table profiles         enable row level security;
alter table categories       enable row level security;
alter table subcategories    enable row level security;
alter table listings         enable row level security;
alter table listing_images   enable row level security;
alter table favorites        enable row level security;
alter table messages         enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table payments         enable row level security;
alter table reviews          enable row level security;
alter table notifications    enable row level security;
alter table audit_logs       enable row level security;

-- Public read-only reference data
create policy "Public read roles"        on roles        for select using (true);
create policy "Public read categories"   on categories   for select using (true);
create policy "Public read subcategories" on subcategories for select using (true);
create policy "Public read listings"     on listings     for select using (true);
create policy "Public read listing_images" on listing_images for select using (true);
create policy "Public read reviews"      on reviews      for select using (true);

-- Example authenticated-user-scoped policies (uncomment/adjust as needed)
-- create policy "Users manage own profile" on profiles
--     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "Users see own favorites" on favorites
--     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "Users see own messages" on messages
--     for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
-- create policy "Users see own orders" on orders
--     for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
-- create policy "Users see own notifications" on notifications
--     for select using (auth.uid() = user_id);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================


