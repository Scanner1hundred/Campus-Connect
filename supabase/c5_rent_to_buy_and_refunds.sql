-- COMMIT 5 · schema.   PR first, then run once in the Supabase SQL Editor (after commit 4).
-- Adds: rent-to-buy buy-out, breakage reports, refunds, and the admin review step.
--
-- BREAKAGE RULES
--   Small appliances (microwave, oven, deep fryer, air fryer): automatic FULL refund of the money
--     held (paid by the renter but not yet paid out to the owner). The owner claims a replacement
--     from the store / warranty themselves.
--   Fridges & freezers: the renter reports it; charges and pay-outs are FROZEN; a repairman inspects;
--     an admin then approves (refund) or rejects (rental carries on).
-- RENT-TO-BUY RULE
--   Only on rentals of 7-10 months of a listing with rent-to-buy on. After month 6 the renter can buy:
--     buy-out price = asking price - rent already paid.  The owner ends up with exactly the asking price.

create table if not exists rental_issues (
  issue_id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references rentals(rental_id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  item_type text not null check (item_type in ('fridge','small')),
  description text not null,
  status text not null default 'reported'
    check (status in ('reported','approved','rejected','auto_refunded')),
  repairman_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamp default current_timestamp,
  resolved_at timestamptz
);

create table if not exists rental_refunds (
  refund_id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references rentals(rental_id) on delete cascade,
  issue_id uuid references rental_issues(issue_id) on delete set null,
  amount decimal(10,2) not null,
  created_at timestamp default current_timestamp
);

alter table rental_issues enable row level security;
alter table rental_refunds enable row level security;
drop policy if exists "Renter, owner or admin views issues" on rental_issues;
drop policy if exists "Renter, owner or admin views refunds" on rental_refunds;
create policy "Renter, owner or admin views issues" on rental_issues for select
  using (exists (select 1 from rentals r where r.rental_id = rental_issues.rental_id
                 and (r.renter_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())));
create policy "Renter, owner or admin views refunds" on rental_refunds for select
  using (exists (select 1 from rentals r where r.rental_id = rental_refunds.rental_id
                 and (r.renter_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())));

-- Ledger: same as commit 4, but FROZEN while a fridge report is under investigation
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
  if exists (select 1 from rental_issues where rental_id = r.rental_id and status = 'reported') then
    return;  -- under investigation: no charges, no pay-outs
  end if;

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

-- Internal: refund everything held (paid by the renter, not yet paid out) and close the rental
create or replace function public._refund_rental(p_rental_id uuid, p_issue_id uuid)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  r rentals%rowtype;
  v_paid numeric;
  v_released numeric;
  v_prev numeric;
  v_amount numeric;
begin
  select * into r from rentals where rental_id = p_rental_id for update;

  select coalesce(sum(amount), 0) into v_paid from rental_charges where rental_id = r.rental_id and status = 'paid';
  select coalesce(sum(amount), 0) into v_released from rental_payouts where rental_id = r.rental_id and status = 'released';
  select coalesce(sum(amount), 0) into v_prev from rental_refunds where rental_id = r.rental_id;
  v_amount := greatest(v_paid - v_released - v_prev, 0);

  update rental_charges set status = 'cancelled' where rental_id = r.rental_id and status = 'scheduled';
  update rental_payouts set status = 'cancelled' where rental_id = r.rental_id and status = 'scheduled';

  insert into rental_refunds (rental_id, issue_id, amount) values (r.rental_id, p_issue_id, v_amount);

  update rentals set status = 'refunded' where rental_id = r.rental_id;
  -- the broken item comes off the marketplace; the owner can re-activate it from My Listings
  update listings set status = 'inactive', updated_at = now()
   where listing_id = r.listing_id and status = 'rented';

  return v_amount;
end $$;
revoke all on function public._refund_rental(uuid, uuid) from public, authenticated;

-- RENTER: report a broken appliance.  Returns 'auto_refunded' (small appliances) or 'reported' (fridges).
create or replace function public.report_breakage(p_rental_id uuid, p_description text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r rentals%rowtype;
  v_type text;
  v_issue uuid;
begin
  if v_uid is null then raise exception 'Please log in first.'; end if;
  if length(trim(coalesce(p_description, ''))) < 5 then
    raise exception 'Please describe what went wrong (at least a few words).';
  end if;

  select * into r from rentals where rental_id = p_rental_id;
  if not found or r.renter_id <> v_uid then raise exception 'Only the renter can report a problem.'; end if;
  if r.status <> 'active' then raise exception 'This rental is no longer active.'; end if;
  if exists (select 1 from rental_issues where rental_id = r.rental_id and status = 'reported') then
    raise exception 'A report for this rental is already being investigated.';
  end if;

  perform public.process_rental_ledger(r.rental_id);   -- bring the ledger up to date first

  select case when sc.sub_category_name = 'Fridges & Freezers' then 'fridge'
              when sc.sub_category_name is null then 'fridge'   -- unknown: play safe, needs admin
              else 'small' end
    into v_type
    from (select 1) x
    left join listings l on l.listing_id = r.listing_id
    left join subcategories sc on sc.sub_category_id = l.sub_category_id;

  insert into rental_issues (rental_id, reporter_id, item_type, description)
  values (r.rental_id, v_uid, v_type, trim(p_description))
  returning issue_id into v_issue;

  if v_type = 'small' then
    perform public._refund_rental(r.rental_id, v_issue);
    update rental_issues set status = 'auto_refunded', resolved_at = now() where issue_id = v_issue;
    return 'auto_refunded';
  end if;

  return 'reported';
end $$;

-- ADMIN: after the repairman's inspection, approve (refund) or reject (rental continues)
create or replace function public.resolve_rental_issue(p_issue_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  i rental_issues%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'Please record the repairman''s findings.';
  end if;

  select * into i from rental_issues where issue_id = p_issue_id for update;
  if not found or i.status <> 'reported' then raise exception 'This report is not awaiting a decision.'; end if;

  update rental_issues
     set status = case when p_approve then 'approved' else 'rejected' end,
         repairman_note = trim(p_note), resolved_by = auth.uid(), resolved_at = now()
   where issue_id = p_issue_id;

  if p_approve then
    perform public._refund_rental(i.rental_id, i.issue_id);
  else
    perform public.process_rental_ledger(i.rental_id);  -- unfreeze: catch up charges and pay-outs
  end if;
end $$;

-- RENTER: rent-to-buy buy-out (opens after month 6).  Returns the new order id.
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
  v_balance := greatest(r.listing_price - v_paid, 0);     -- BUY PRICE = full price - rent paid

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

  -- the owner receives everything still held plus the balance: in total exactly the asking price
  insert into rental_payouts (rental_id, rent_month, release_date, amount, kind, status, released_at)
  values (r.rental_id, 0, v_today, v_held + v_balance, 'buyout', 'released', now());

  update rentals set status = 'bought' where rental_id = r.rental_id;
  update listings set status = 'sold', updated_at = now() where listing_id = r.listing_id;
  return v_order;
end $$;

revoke all on function public.report_breakage(uuid, text) from public;
revoke all on function public.resolve_rental_issue(uuid, boolean, text) from public;
revoke all on function public.buyout_rental(uuid, uuid) from public;
grant execute on function public.report_breakage(uuid, text) to authenticated;
grant execute on function public.resolve_rental_issue(uuid, boolean, text) to authenticated;
grant execute on function public.buyout_rental(uuid, uuid) to authenticated;
