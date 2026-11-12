-- 061: tiers and optional items on estimates and proposals.
--
-- Estimate lines (estimates.line_items jsonb) carry `tier` and `optional` in
-- the JSON itself, so they need no column. What's new:
--
--   estimates.selection        the client's choice when they accept or sign:
--                              { "tier": "Custom store" | null, "optional": [line indexes] }
--   proposal_line_items.tier   which tier a proposal line belongs to (null = every tier)
--   proposal_line_items.is_optional   an extra the client can tick
--
-- The invoice made on acceptance uses only the chosen tier's lines, the lines
-- shared by every tier, and the optional extras they ticked
-- (src/lib/lineItems.ts selectLines).

alter table public.estimates add column if not exists selection jsonb;
alter table public.proposal_line_items add column if not exists tier text;
alter table public.proposal_line_items add column if not exists is_optional boolean not null default false;

-- A proposal's total, like an estimate's: the first tier (by position) and the
-- lines every tier shares, without optional extras. The client's own choice
-- is applied to the estimate when they sign.
create or replace function public.proposal_default_total(p_proposal_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  with first_tier as (
    select tier from public.proposal_line_items
     where proposal_id = p_proposal_id and tier is not null
     order by position limit 1
  )
  select coalesce(round(sum(li.quantity * li.unit_price_cents)), 0)::int
    from public.proposal_line_items li
   where li.proposal_id = p_proposal_id
     and not li.is_optional
     and (li.tier is null or li.tier = (select tier from first_tier));
$$;

create or replace function public.recalc_proposal_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.proposal_id, old.proposal_id);
begin
  update public.proposals p
     set total_cents = public.proposal_default_total(target),
         updated_at = now()
   where p.id = target;
  return null;
end $$;

create or replace function public.save_proposal_content(
  p_proposal_id uuid,
  p_blocks      jsonb default null,
  p_line_items  jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.proposals where id = p_proposal_id) then
    raise exception 'Proposal % not found', p_proposal_id;
  end if;

  if p_blocks is not null then
    delete from public.proposal_blocks where proposal_id = p_proposal_id;

    insert into public.proposal_blocks (id, proposal_id, type, position, visible, accent, content)
    select
      coalesce((b->>'id')::uuid, gen_random_uuid()),
      p_proposal_id,
      b->>'type',
      (b->>'position')::int,
      coalesce((b->>'visible')::boolean, true),
      nullif(b->>'accent', ''),
      coalesce(b->'content', '{}'::jsonb)
    from jsonb_array_elements(p_blocks) as b;
  end if;

  if p_line_items is not null then
    delete from public.proposal_line_items where proposal_id = p_proposal_id;

    insert into public.proposal_line_items
      (id, proposal_id, label, description, quantity, unit_price_cents, position, tier, is_optional)
    select
      coalesce((li->>'id')::uuid, gen_random_uuid()),
      p_proposal_id,
      li->>'label',
      nullif(li->>'description', ''),
      coalesce((li->>'quantity')::numeric, 1),
      coalesce((li->>'unit_price_cents')::int, 0),
      (li->>'position')::int,
      nullif(trim(coalesce(li->>'tier', '')), ''),
      coalesce((li->>'is_optional')::boolean, false)
    from jsonb_array_elements(p_line_items) as li;

    update public.proposals p
       set total_cents = public.proposal_default_total(p_proposal_id),
           updated_at = now()
     where p.id = p_proposal_id;
  end if;
end $$;

revoke all on function public.save_proposal_content(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.proposal_default_total(uuid) from public, anon, authenticated;
