-- ============================================================
-- BRAND ACCENTS
-- ============================================================
-- The accent names now match Thrive's actual palette, sampled from the
-- studio's own proposal artwork, rather than the placeholder set the
-- schema shipped with:
--   lime -> green, pink -> magenta, and blue is added.

alter table public.proposal_blocks
  drop constraint if exists proposal_blocks_accent_check;

update public.proposal_blocks set accent = 'green'   where accent = 'lime';
update public.proposal_blocks set accent = 'magenta' where accent = 'pink';

alter table public.proposal_blocks
  add constraint proposal_blocks_accent_check
  check (accent in ('green', 'orange', 'magenta', 'purple', 'blue'));

-- proposals.theme is free-form jsonb, so the accent inside it is migrated
-- by value rather than by constraint.
update public.proposals
   set theme = jsonb_set(theme, '{accent}', '"green"')
 where theme->>'accent' = 'lime';

update public.proposals
   set theme = jsonb_set(theme, '{accent}', '"magenta"')
 where theme->>'accent' = 'pink';
