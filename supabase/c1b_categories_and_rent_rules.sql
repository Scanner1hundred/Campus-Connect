-- COMMIT 1 · file 2 of 3
-- Fixed category set + the database side of the rent rules.
-- PR first, then run in the Supabase SQL Editor (after c1a).

-- A. New columns ------------------------------------------------------------
alter table subcategories add column if not exists rent_eligible boolean not null default false;
alter table subcategories add column if not exists rent_min_months int not null default 1;

alter table listings add column if not exists rent_price_monthly decimal(10,2);
alter table listings add column if not exists rent_to_buy_enabled boolean not null default false;
alter table listings add column if not exists is_demo boolean not null default false;

-- B. Fixed, school-appropriate categories (NO food) -------------------------
--    rent = can be rented out      min_m = shortest rental in months
drop table if exists fixed_subs;
create temp table fixed_subs (cat text, sub text, rent boolean, min_m int);
insert into fixed_subs values
 ('Phones & Tablets','Smartphones',false,1),
 ('Phones & Tablets','Tablets',false,1),
 ('Phones & Tablets','Phone Accessories',false,1),
 ('Laptops & Computers','Laptops',false,1),
 ('Laptops & Computers','Desktops & Monitors',false,1),
 ('Laptops & Computers','Computer Accessories',false,1),
 ('Electronics','Audio & Headphones',false,1),
 ('Electronics','Gaming & Consoles',false,1),
 ('Electronics','Power Banks & Chargers',false,1),
 ('Electronics','Other Electronics',false,1),
 -- Rentable appliances (no phones, laptops or stoves). Fridges need 2+ months.
 ('Appliances','Fridges & Freezers',true,2),
 ('Appliances','Microwaves',true,1),
 ('Appliances','Ovens',true,1),
 ('Appliances','Deep Fryers',true,1),
 ('Appliances','Air Fryers',true,1),
 ('Appliances','Kettles & Toasters',false,1),
 ('Appliances','Heaters & Fans',false,1),
 ('Appliances','Other Appliances',false,1),
 ('Clothing & Shoes','Menswear',false,1),
 ('Clothing & Shoes','Womenswear',false,1),
 ('Clothing & Shoes','Shoes & Sneakers',false,1),
 ('Clothing & Shoes','Bags & Accessories',false,1),
 ('Books & Stationery','Textbooks',false,1),
 ('Books & Stationery','Stationery & Calculators',false,1),
 ('Furniture & Room Items','Beds & Mattresses',false,1),
 ('Furniture & Room Items','Desks & Chairs',false,1),
 ('Furniture & Room Items','Storage & Room Items',false,1),
 ('Other','Other Items',false,1);

insert into categories (category_name)
select distinct cat from fixed_subs
on conflict (category_name) do nothing;

insert into subcategories (category_id, sub_category_name, rent_eligible, rent_min_months)
select c.category_id, f.sub, f.rent, f.min_m
from fixed_subs f join categories c on c.category_name = f.cat
on conflict (sub_category_name)
do update set category_id = excluded.category_id,
              rent_eligible = excluded.rent_eligible,
              rent_min_months = excluded.rent_min_months;

-- Anything outside the fixed set is removed. Listings that used a removed
-- subcategory keep existing but lose their category (on delete set null).
delete from subcategories where sub_category_name not in (select sub from fixed_subs);
delete from categories    where category_name    not in (select cat from fixed_subs);

-- (categories / subcategories already have select-only RLS, so users can't add their own.)

-- C. Rent rules enforced in the database (not just the form) ----------------
--    * only rentable appliance subcategories can have a monthly rent
--    * rent-to-buy only for items priced ABOVE R2000
create or replace function public.enforce_rent_rules()
returns trigger language plpgsql as $$
begin
  if new.rent_price_monthly is null then
    new.rent_to_buy_enabled := false;
    return new;
  end if;

  if new.rent_price_monthly <= 0 then
    raise exception 'Monthly rent must be more than zero.';
  end if;

  if not exists (
    select 1 from subcategories
    where sub_category_id = new.sub_category_id and rent_eligible
  ) then
    raise exception 'Only fridges/freezers, microwaves, ovens, deep fryers and air fryers can be rented out.';
  end if;

  if new.rent_to_buy_enabled and new.price <= 2000 then
    raise exception 'Rent-to-buy is only available for items priced above R2000.';
  end if;

  return new;
end $$;

drop trigger if exists listings_enforce_rent on listings;
create trigger listings_enforce_rent
  before insert or update on listings
  for each row execute procedure public.enforce_rent_rules();
