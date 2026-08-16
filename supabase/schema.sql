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
