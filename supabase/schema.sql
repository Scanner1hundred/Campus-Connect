-- Run this in the Supabase SQL Editor for your project.

-- Shared profiles table (used by both Marketplace and Laundry modules)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  student_number text,
  phone text,
  updated_at timestamp with time zone default now()
);

-- Row Level Security: each student can only read/write their own profile
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

-- =====================================================
-- MARKETPLACE CATEGORIES
-- =====================================================

create table if not exists marketplace_categories (
    category_id uuid primary key default gen_random_uuid(),
    category_name text not null unique,
    description text,
    created_at timestamp with time zone default now()
);

-- =====================================================
-- MARKETPLACE ITEMS
-- =====================================================

create table if not exists marketplace_items (
    item_id uuid primary key default gen_random_uuid(),

    category_id uuid not null
        references marketplace_categories(category_id)
        on delete restrict,

    item_name text not null,
    brand text,
    model text,
    item_condition text,
    description text,

    created_at timestamp with time zone default now()
);

-- =====================================================
-- MARKETPLACE LISTINGS
-- =====================================================

create table if not exists marketplace_listings (
    listing_id uuid primary key default gen_random_uuid(),

    item_id uuid not null
        references marketplace_items(item_id)
        on delete cascade,

    seller_id uuid not null
        references profiles(id)
        on delete cascade,

    listing_type text not null
        check (listing_type in ('Sale', 'Rent', 'Both')),

    sale_price numeric(12,2)
        check (sale_price is null or sale_price >= 0),

    rental_price_per_day numeric(12,2)
        check (
            rental_price_per_day is null
            or rental_price_per_day >= 0
        ),

    deposit_amount numeric(12,2) default 0
        check (deposit_amount >= 0),

    listing_status text not null default 'Available'
        check (
            listing_status in (
                'Available',
                'Sold',
                'Rented',
                'Unavailable',
                'Removed'
            )
        ),

    created_at timestamp with time zone default now()
);

-- =====================================================
-- MARKETPLACE ORDERS
-- =====================================================

create table if not exists marketplace_orders (
    marketplace_order_id uuid primary key default gen_random_uuid(),

    buyer_id uuid not null
        references profiles(id)
        on delete restrict,

    seller_id uuid not null
        references profiles(id)
        on delete restrict,

    order_date timestamp with time zone default now(),

    total_amount numeric(12,2) not null default 0
        check (total_amount >= 0),

    order_status text not null default 'Pending'
        check (
            order_status in (
                'Pending',
                'Confirmed',
                'Completed',
                'Cancelled'
            )
        )
);

-- =====================================================
-- MARKETPLACE ORDER ITEMS
-- =====================================================

create table if not exists marketplace_order_items (
    marketplace_order_item_id uuid primary key default gen_random_uuid(),

    marketplace_order_id uuid not null
        references marketplace_orders(marketplace_order_id)
        on delete cascade,

    listing_id uuid not null
        references marketplace_listings(listing_id)
        on delete restrict,

    quantity integer not null default 1
        check (quantity > 0),

    unit_price numeric(12,2) not null
        check (unit_price >= 0),

    subtotal numeric(12,2)
        generated always as (quantity * unit_price) stored
);

-- =====================================================
-- MARKETPLACE RENTALS
-- =====================================================

create table if not exists marketplace_rentals (
    rental_id uuid primary key default gen_random_uuid(),

    listing_id uuid not null
        references marketplace_listings(listing_id)
        on delete restrict,

    renter_id uuid not null
        references profiles(id)
        on delete restrict,

    owner_id uuid not null
        references profiles(id)
        on delete restrict,

    start_date date not null,

    expected_return_date date not null,

    actual_return_date date,

    rental_price_per_day numeric(12,2) not null
        check (rental_price_per_day >= 0),

    total_rental_cost numeric(12,2)
        check (total_rental_cost >= 0),

    deposit_amount numeric(12,2) default 0
        check (deposit_amount >= 0),

    rental_status text not null default 'Pending'
        check (
            rental_status in (
                'Pending',
                'Active',
                'Returned',
                'Late',
                'Cancelled'
            )
        ),

    check (expected_return_date >= start_date)
);

-- =====================================================
-- PAYMENTS
-- =====================================================

create table if not exists marketplace_payments (
    payment_id uuid primary key default gen_random_uuid(),

    marketplace_order_id uuid
        references marketplace_orders(marketplace_order_id)
        on delete cascade,

    rental_id uuid
        references marketplace_rentals(rental_id)
        on delete cascade,

    amount numeric(12,2) not null
        check (amount >= 0),

    payment_method text not null
        check (
            payment_method in (
                'Cash',
                'Card',
                'EFT',
                'Online'
            )
        ),

    payment_status text not null default 'Pending'
        check (
            payment_status in (
                'Pending',
                'Paid',
                'Failed',
                'Refunded'
            )
        ),

    payment_date timestamp with time zone default now(),

    check (
        marketplace_order_id is not null
        or rental_id is not null
    )
);

-- =====================================================
-- MARKETPLACE REVIEWS
-- =====================================================

create table if not exists marketplace_reviews (
    review_id uuid primary key default gen_random_uuid(),

    reviewer_id uuid not null
        references profiles(id)
        on delete cascade,

    listing_id uuid
        references marketplace_listings(listing_id)
        on delete cascade,

    seller_id uuid
        references profiles(id)
        on delete cascade,

    rating integer not null
        check (rating between 1 and 5),

    review_comment text,

    review_date timestamp with time zone default now()
);

-- =====================================================
-- MARKETPLACE ITEM IMAGES
-- =====================================================

create table if not exists marketplace_item_images (
    image_id uuid primary key default gen_random_uuid(),

    item_id uuid not null
        references marketplace_items(item_id)
        on delete cascade,

    image_url text not null,

    is_primary boolean default false,

    created_at timestamp with time zone default now()
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_marketplace_items_category
on marketplace_items(category_id);

create index if not exists idx_marketplace_listings_seller
on marketplace_listings(seller_id);

create index if not exists idx_marketplace_listings_item
on marketplace_listings(item_id);

create index if not exists idx_marketplace_listings_status
on marketplace_listings(listing_status);

create index if not exists idx_marketplace_orders_buyer
on marketplace_orders(buyer_id);

create index if not exists idx_marketplace_orders_seller
on marketplace_orders(seller_id);

create index if not exists idx_marketplace_order_items_order
on marketplace_order_items(marketplace_order_id);

create index if not exists idx_marketplace_rentals_renter
on marketplace_rentals(renter_id);

create index if not exists idx_marketplace_reviews_listing
on marketplace_reviews(listing_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

alter table marketplace_categories enable row level security;
alter table marketplace_items enable row level security;
alter table marketplace_listings enable row level security;
alter table marketplace_orders enable row level security;
alter table marketplace_order_items enable row level security;
alter table marketplace_rentals enable row level security;
alter table marketplace_payments enable row level security;
alter table marketplace_reviews enable row level security;
alter table marketplace_item_images enable row level security;

-- =====================================================
-- PUBLIC/LOGGED-IN MARKETPLACE VIEWING
-- =====================================================

create policy "Authenticated users can view categories"
on marketplace_categories
for select
to authenticated
using (true);


create policy "Authenticated users can view items"
on marketplace_items
for select
to authenticated
using (true);


create policy "Authenticated users can view available listings"
on marketplace_listings
for select
to authenticated
using (listing_status <> 'Removed');


create policy "Authenticated users can view item images"
on marketplace_item_images
for select
to authenticated
using (true);

-- =====================================================
-- SELLER POLICIES
-- =====================================================

create policy "Students can create items"
on marketplace_items
for insert
to authenticated
with check (true);


create policy "Students can create listings"
on marketplace_listings
for insert
to authenticated
with check (seller_id = auth.uid());


create policy "Students can update their listings"
on marketplace_listings
for update
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());


create policy "Students can delete their listings"
on marketplace_listings
for delete
to authenticated
using (seller_id = auth.uid());


-- =====================================================
-- BUYER POLICIES
-- =====================================================

create policy "Students can create orders"
on marketplace_orders
for insert
to authenticated
with check (buyer_id = auth.uid());


create policy "Students can view their orders"
on marketplace_orders
for select
to authenticated
using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
);

create policy "Students can create order items"
on marketplace_order_items
for insert
to authenticated
with check (
    exists (
        select 1
        from marketplace_orders
        where marketplace_orders.marketplace_order_id =
              marketplace_order_items.marketplace_order_id
        and marketplace_orders.buyer_id = auth.uid()
    )
);


create policy "Students can view their order items"
on marketplace_order_items
for select
to authenticated
using (
    exists (
        select 1
        from marketplace_orders
        where marketplace_orders.marketplace_order_id =
              marketplace_order_items.marketplace_order_id
        and (
            marketplace_orders.buyer_id = auth.uid()
            or marketplace_orders.seller_id = auth.uid()
        )
    )
);
-- =====================================================
-- REVIEW POLICIES
-- =====================================================

create policy "Students can view reviews"
on marketplace_reviews
for select
to authenticated
using (true);


create policy "Students can create reviews"
on marketplace_reviews
for insert
to authenticated
with check (reviewer_id = auth.uid());

