-- ==========================
-- PROFILES (already scaffolded)
-- ==========================
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  student_number text,
  phone text,
  updated_at timestamptz default now()
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

-- ==========================
-- CATEGORIES & SUBCATEGORIES
-- ==========================
create table if not exists categories (
  category_id uuid primary key default gen_random_uuid(),
  category_name text unique not null,
  description text,
  icon_url text,
  created_at timestamptz default now()
);

create table if not exists subcategories (
  sub_category_id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(category_id) on delete cascade,
  sub_category_name text unique not null,
  image_url text,
  created_at timestamptz default now()
);

-- ==========================
-- LISTINGS
-- ==========================
create table if not exists listings (
  listing_id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  sub_category_id uuid references subcategories(sub_category_id),
  title text not null,
  description text,
  condition text,
  price numeric(10,2) not null,
  status text check (status in ('active','sold','archived')) default 'active',
  views_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table listings enable row level security;

create policy "Anyone can view listings"
  on listings for select
  using (true);

create policy "Users can insert own listings"
  on listings for insert
  with check (auth.uid() = seller_id);

create policy "Users can update own listings"
  on listings for update
  using (auth.uid() = seller_id);

create policy "Users can delete own listings"
  on listings for delete
  using (auth.uid() = seller_id);

create table if not exists listing_images (
  image_id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(listing_id) on delete cascade,
  image_url text not null,
  is_primary boolean default false,
  created_at timestamptz default now()
);

-- ==========================
-- ORDERS & ORDER ITEMS
-- ==========================
create table if not exists orders (
  order_id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id),
  seller_id uuid references auth.users(id),
  order_date timestamptz default now(),
  total_amount numeric(10,2) not null,
  status text check (status in ('pending','paid','shipped','completed','cancelled')) default 'pending'
);

create table if not exists order_items (
  order_item_id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(order_id) on delete cascade,
  listing_id uuid references listings(listing_id),
  quantity int not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

-- ==========================
-- PAYMENTS
-- ==========================
create table if not exists payments (
  payment_id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(order_id) on delete cascade,
  amount numeric(10,2) not null,
  payment_method text check (payment_method in ('card','cash','eft')) not null,
  payment_reference text,
  payment_date timestamptz default now(),
  status text check (status in ('pending','successful','failed')) default 'pending'
);

-- ==========================
-- REVIEWS
-- ==========================
create table if not exists reviews (
  review_id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(listing_id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  rating int check (rating between 1 and 5),
  review_text text,
  created_at timestamptz default now()
);

-- ==========================
-- MESSAGES
-- ==========================
create table if not exists messages (
  message_id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id),
  receiver_id uuid references auth.users(id),
  listing_id uuid references listings(listing_id),
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ==========================
-- FAVORITES
-- ==========================
create table if not exists favorites (
  favorite_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  listing_id uuid references listings(listing_id),
  created_at timestamptz default now()
);

-- ==========================
-- NOTIFICATIONS
-- ==========================
create table if not exists notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  type text check (type in ('order','message','system','review')),
  title text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ==========================
-- AUDIT LOGS
-- ==========================
create table if not exists audit_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  action_date timestamptz default now()
);
