-- 067: Shopify Starter Store on the price list (Website add-ons, with the
-- other Shopify items). Pairs with "Shopify account setup" (Included), so an
-- estimate can be Starter Store + Account setup = $500. Existing items are
-- left as they are. Re-runnable.

insert into public.price_items (category_id, name, description, price, price_type, hours, is_optional, unit, sort_order)
select c.id,
       'Shopify Starter Store',
       'Free Shopify theme customized in your brand, up to 10 products loaded, payments, simple shipping, and taxes set up, mobile-friendly, and launch-ready. Shopify subscription billed separately by Shopify.',
       500, 'flat', null, false, null, 116
from public.price_categories c
where c.name = 'Website add-ons'
  and not exists (select 1 from public.price_items i where i.category_id = c.id and i.name = 'Shopify Starter Store');
