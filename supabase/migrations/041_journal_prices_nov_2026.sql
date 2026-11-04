-- ============================================================
-- NEW PRICES IN THE AMARILLO COST ARTICLE (Nov 2026)
-- ============================================================
-- The site's prices went up (src/lib/servicePricing.ts): websites
-- $1,250 / $1,600 / $1,950, branding $750 / $1,350, social media $750 to
-- $1,350 a month, care plans $100 / $125 a month. The Journal article
-- "What a Small Business Website Costs in Amarillo" quotes them in its
-- text, which lives in the database, so it's updated here.
--
-- Each replace() matches a whole phrase, so nothing else in the article
-- changes, and running this twice does nothing the second time. The article
-- page refreshes within an hour, or straight away if it's re-saved in
-- /admin/journal.

update public.journal_posts
set
  excerpt = replace(excerpt, 'costs $750 to $1,150', 'costs $1,250 to $1,950'),
  body =
    replace(replace(replace(replace(replace(replace(replace(replace(body,
      'costs $750 to $1,150', 'costs $1,250 to $1,950'),
      '### Starter: $750', '### Starter: $1,250'),
      '### Medium: $950', '### Medium: $1,600'),
      '### Large: $1,150', '### Large: $1,950'),
      'Logo and essentials package is $450, and a Full identity is $800', 'Logo and essentials package is $750, and a Full identity is $1,350'),
      'Basic care is $55 a month', 'Basic care is $100 a month'),
      'Plus care is $75 a month', 'Plus care is $125 a month'),
      'social media management is $450 to $800 a month', 'social media management is $750 to $1,350 a month'),
  updated_at = now()
where slug = 'what-a-small-business-website-costs-in-amarillo';
