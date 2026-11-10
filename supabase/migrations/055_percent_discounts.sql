-- 055: percentage discounts on the price list.
--
-- price_type 'percent': price is the percent off (1-100). In the estimate and
-- invoice builder it becomes a line like "Friends & family discount | 50% off",
-- worked out from the one-time lines that are not discounts
-- (src/lib/lineItems.ts applyPercents). Proposals do not offer them.
-- Adds a Discounts category with the four standing discounts.
--
-- Safe to run more than once. (No apostrophes below: the SQL editor reads them as quotes.)

alter table public.price_items drop constraint if exists price_items_price_type_check;
alter table public.price_items add constraint price_items_price_type_check
  check (price_type in ('flat', 'hourly', 'included', 'monthly', 'percent'));
alter table public.price_items drop constraint if exists price_items_percent_range;
alter table public.price_items add constraint price_items_percent_range
  check (price_type <> 'percent' or (price > 0 and price <= 100));

insert into public.price_categories (name, description, sort_order)
values ('Discounts', 'Percent off the one-time total of an estimate or invoice. Monthly charges are not discounted.', 130)
on conflict (name) do nothing;

insert into public.price_items (category_id, name, description, price, price_type, hours, is_optional, unit, sort_order)
select c.id, v.name, v.description, v.price, 'percent', null, false, null, v.sort_order
from (values
  ('Friends & family discount', '50% off for friends and family', 50::numeric, 10),
  ('Project spotlight discount', '15% off for featuring the project in the Thrive portfolio', 15::numeric, 20),
  ('Teacher & veteran discount', '20% off for teachers and veterans', 20::numeric, 30),
  ('HBCU graduate discount', '20% off for HBCU graduates', 20::numeric, 40)
) as v(name, description, price, sort_order)
join public.price_categories c on c.name = 'Discounts'
where not exists (select 1 from public.price_items i where i.category_id = c.id and i.name = v.name);
