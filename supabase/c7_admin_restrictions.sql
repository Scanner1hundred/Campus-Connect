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
