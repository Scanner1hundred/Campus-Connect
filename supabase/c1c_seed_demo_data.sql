-- COMMIT 1 · file 3 of 3
-- Demo listings so Browse, Search and Categories all have data (37 items).
-- Re-runnable: it wipes earlier demo rows first.  Remove later with:
--     delete from listings where is_demo;
--
-- WHO OWNS THE DEMO LISTINGS?  Put the seller account's email below, e.g.
-- 'initialsurname@ufh.ac.za'. Leave it '' to use the oldest account.
-- Then test buying/renting while logged in as a DIFFERENT account
-- (you can't buy or rent your own listing).

delete from listings where is_demo;

drop table if exists seed_seller;
create temp table seed_seller as
select coalesce(
  (select id from auth.users where email = lower('')),          -- <-- put the seller email between the quotes
  (select id from auth.users order by created_at limit 1)
) as id;

drop table if exists seed_data;
create temp table seed_data (
  sub text, title text, descr text, cond text,
  price numeric, rent numeric, rtb boolean, img text
);
insert into seed_data values
 ('Smartphones','iPhone 12 128GB','Battery health 86%, no cracks, comes with charger and case.','good',7500,null,false,'https://placehold.co/600x450/e6efff/0a2f6b?text=iPhone+12'),
 ('Smartphones','Samsung Galaxy A54','Barely used, box and receipt included. Dual SIM.','like-new',5200,null,false,'https://placehold.co/600x450/e6efff/0a2f6b?text=Galaxy+A54'),
 ('Smartphones','Redmi Note 11','Small scratch on the back, screen perfect.','fair',2400,null,false,'https://placehold.co/600x450/e6efff/0a2f6b?text=Redmi+Note+11'),
 ('Tablets','Samsung Galaxy Tab A8','Great for notes and PDFs. Includes cover.','good',3200,null,false,'https://placehold.co/600x450/e6efff/0a2f6b?text=Galaxy+Tab+A8'),
 ('Phone Accessories','Shockproof phone case bundle','3 cases + screen protectors, fits most mid-range phones.','new',120,null,false,'https://placehold.co/600x450/e6efff/0a2f6b?text=Phone+Cases'),
 ('Laptops','HP 15 Core i5 8GB/256GB SSD','Fast, quiet, battery lasts about 5 hours. Windows 11.','good',6800,null,false,'https://placehold.co/600x450/dcfce7/166534?text=HP+15+Laptop'),
 ('Laptops','Lenovo ThinkPad T480','Rugged, great keyboard, i5 8th gen, 16GB RAM.','good',5900,null,false,'https://placehold.co/600x450/dcfce7/166534?text=ThinkPad+T480'),
 ('Laptops','Dell Inspiron 3000','Good for assignments and browsing. Charger included.','fair',4300,null,false,'https://placehold.co/600x450/dcfce7/166534?text=Dell+Inspiron'),
 ('Laptops','MacBook Air 2017','Runs smoothly, new battery fitted last year.','good',8500,null,false,'https://placehold.co/600x450/dcfce7/166534?text=MacBook+Air'),
 ('Desktops & Monitors','Dell 24 inch monitor','Full HD, HDMI + VGA. Perfect for a residence desk.','good',1400,null,false,'https://placehold.co/600x450/dcfce7/166534?text=Dell+Monitor'),
 ('Computer Accessories','Logitech wireless mouse','Works perfectly, includes USB receiver.','like-new',180,null,false,'https://placehold.co/600x450/dcfce7/166534?text=Wireless+Mouse'),
 ('Audio & Headphones','JBL Go 2 speaker','Waterproof, loud for its size. Comes with cable.','good',450,null,false,'https://placehold.co/600x450/fef3c7/92400e?text=JBL+Go+2'),
 ('Audio & Headphones','Sony over-ear headphones','Comfortable, great sound, foldable.','good',700,null,false,'https://placehold.co/600x450/fef3c7/92400e?text=Sony+Headphones'),
 ('Gaming & Consoles','PlayStation 4 Slim','1TB, one controller, 3 games included.','good',3500,null,false,'https://placehold.co/600x450/fef3c7/92400e?text=PS4+Slim'),
 ('Power Banks & Chargers','20000mAh power bank','Fast charging, handy for load shedding.','like-new',300,null,false,'https://placehold.co/600x450/fef3c7/92400e?text=Power+Bank'),
 -- Rentable appliances. Fridges above R2000 offer rent-to-buy.
 ('Fridges & Freezers','Defy 250L fridge-freezer','Frost-free, works perfectly. Rent R200/month or buy.','good',2500,200,true,'https://placehold.co/600x450/ede9fe/5b21b6?text=Defy+250L+Fridge'),
 ('Fridges & Freezers','Samsung double-door fridge','Large family size, quiet compressor.','good',3200,280,true,'https://placehold.co/600x450/ede9fe/5b21b6?text=Samsung+Double+Door'),
 ('Fridges & Freezers','Hisense 90L mini fridge','Compact, energy efficient, top freezer box.','good',1500,200,false,'https://placehold.co/600x450/ede9fe/5b21b6?text=Mini+Fridge'),
 ('Microwaves','Samsung 23L microwave','Works perfectly, turntable included.','good',800,120,false,'https://placehold.co/600x450/ede9fe/5b21b6?text=Microwave'),
 ('Ovens','Russell Hobbs electric oven 30L','Bakes evenly, two racks included.','good',950,140,false,'https://placehold.co/600x450/ede9fe/5b21b6?text=Electric+Oven'),
 ('Deep Fryers','Salton 3L deep fryer','Cleaned after every use, thermostat works.','good',400,70,false,'https://placehold.co/600x450/ede9fe/5b21b6?text=Deep+Fryer'),
 ('Air Fryers','Philips 4L air fryer','Great for quick meals, barely used.','like-new',1100,150,false,'https://placehold.co/600x450/ede9fe/5b21b6?text=Air+Fryer'),
 ('Kettles & Toasters','Russell Hobbs kettle','1.7L, barely used.','like-new',150,null,false,'https://placehold.co/600x450/ede9fe/5b21b6?text=Kettle'),
 ('Heaters & Fans','Oil heater 9 fin','Keeps a room warm all winter.','good',500,null,false,'https://placehold.co/600x450/ede9fe/5b21b6?text=Oil+Heater'),
 ('Other Appliances','Two-plate hot plate','Heats fast, safe thermostat.','good',350,null,false,'https://placehold.co/600x450/ede9fe/5b21b6?text=Hot+Plate'),
 ('Menswear','Nike hoodie (M)','Black, warm, worn a few times.','good',350,null,false,'https://placehold.co/600x450/fee2e2/991b1b?text=Nike+Hoodie'),
 ('Menswear','Levis 511 jeans (32)','Slim fit, dark wash.','good',300,null,false,'https://placehold.co/600x450/fee2e2/991b1b?text=Levis+Jeans'),
 ('Menswear','Formal blazer (L)','Worn once for a presentation. Navy.','like-new',400,null,false,'https://placehold.co/600x450/fee2e2/991b1b?text=Blazer'),
 ('Womenswear','Floral summer dress (S)','Light and comfortable.','like-new',200,null,false,'https://placehold.co/600x450/fee2e2/991b1b?text=Summer+Dress'),
 ('Shoes & Sneakers','Adidas sneakers UK 8','Clean, lots of life left.','good',550,null,false,'https://placehold.co/600x450/fee2e2/991b1b?text=Adidas+Sneakers'),
 ('Bags & Accessories','Laptop backpack','Fits 15.6 inch laptop, padded, waterproof.','good',250,null,false,'https://placehold.co/600x450/fee2e2/991b1b?text=Backpack'),
 ('Textbooks','Calculus early transcendentals','Some highlighting, no missing pages.','good',450,null,false,'https://placehold.co/600x450/e0f2fe/075985?text=Calculus+Textbook'),
 ('Textbooks','University Physics','Clean copy, latest edition.','fair',500,null,false,'https://placehold.co/600x450/e0f2fe/075985?text=University+Physics'),
 ('Stationery & Calculators','Casio fx-991ES Plus','Exam approved, cover included.','like-new',220,null,false,'https://placehold.co/600x450/e0f2fe/075985?text=Casio+Calculator'),
 ('Desks & Chairs','Study desk with drawer','Sturdy, easy to move, small scratches.','good',600,null,false,'https://placehold.co/600x450/f1f5f9/334155?text=Study+Desk'),
 ('Desks & Chairs','Ergonomic office chair','Adjustable height, good back support.','good',450,null,false,'https://placehold.co/600x450/f1f5f9/334155?text=Office+Chair'),
 ('Beds & Mattresses','Single mattress','Clean, no stains, firm.','good',700,null,false,'https://placehold.co/600x450/f1f5f9/334155?text=Single+Mattress');

insert into listings (seller_id, sub_category_id, title, description, condition,
                      price, rent_price_monthly, rent_to_buy_enabled, status, is_demo)
select (select id from seed_seller), s.sub_category_id, d.title, d.descr, d.cond,
       d.price, d.rent, d.rtb, 'active', true
from seed_data d
join subcategories s on s.sub_category_name = d.sub
where (select id from seed_seller) is not null;

insert into listing_images (listing_id, image_url, is_primary)
select l.listing_id, d.img, true
from listings l join seed_data d on d.title = l.title
where l.is_demo;

select count(*) as demo_listings from listings where is_demo;
