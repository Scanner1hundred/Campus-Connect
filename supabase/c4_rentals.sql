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
