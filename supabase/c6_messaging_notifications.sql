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
