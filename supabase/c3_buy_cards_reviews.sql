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
