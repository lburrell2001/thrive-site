-- 070: the Starter Website & Brand Package, and default payment terms on
-- price list items.
--
-- price_items.deposit_percent: an item's default payment terms. Adding it to
-- an estimate with no terms set yet sets the estimate's deposit (the rest is
-- invoiced on final approval). Null = no default.
--
-- Starter Website & Brand Package ($1,850, Website packages, after Starter
-- Website): the full brand identity plus a starter website with planning and
-- SEO. 50% up front, 50% on final approval. Requires Hosting setup (Included:
-- billed during the build, switched over at the end). Existing items are left
-- as they are. Re-runnable.

alter table public.price_items
  add column if not exists deposit_percent numeric check (deposit_percent is null or (deposit_percent > 0 and deposit_percent < 100));

insert into public.price_items (category_id, name, description, price, price_type, hours, is_optional, unit, sort_order, deposit_percent)
select c.id,
       'Starter Website & Brand Package',
       'Full brand identity (logo suite, colors, fonts, patterns, brand guide) plus a starter website: 3–5 pages, site planning, mobile-friendly design, SEO setup, schema markup and Google Business Profile, launched on your domain',
       1850, 'flat', null, false, null, 25, 50
from public.price_categories c
where c.name = 'Website packages'
  and not exists (select 1 from public.price_items i where i.category_id = c.id and i.name = 'Starter Website & Brand Package');

insert into public.price_item_rules (item_id, rule_type, related_item_id)
select pkg.id, 'requires', host.id
from public.price_items pkg
join public.price_items host on host.name = 'Hosting setup'
where pkg.name = 'Starter Website & Brand Package'
on conflict do nothing;
