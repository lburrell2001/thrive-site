-- 063: price ranges on proposals.
--
-- A tier, a phase or the whole list can be priced as a range: each line is
-- in both ends (null), or only the low end ('low') or only the high end
-- ('high'). The client sees "$4,000 – $7,500"; approving a range makes no
-- invoice — Lauren is texted and makes the final estimate from the low or
-- high end. Estimate lines carry the same tag as `range` in their JSON.
--
-- The proposal's stored total is its low end (high-end-only lines left out).

alter table public.proposal_line_items add column if not exists range_end text
  check (range_end in ('low', 'high'));

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
     and li.range_end is distinct from 'high'
     and (li.tier is null or li.tier = (select tier from first_tier));
$$;

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
      (id, proposal_id, label, description, quantity, unit_price_cents, position, tier, is_optional, phase, phase_terms, range_end)
    select
      coalesce((li->>'id')::uuid, gen_random_uuid()),
      p_proposal_id,
      li->>'label',
      nullif(li->>'description', ''),
      coalesce((li->>'quantity')::numeric, 1),
      coalesce((li->>'unit_price_cents')::int, 0),
      (li->>'position')::int,
      nullif(trim(coalesce(li->>'tier', '')), ''),
      coalesce((li->>'is_optional')::boolean, false),
      nullif(trim(coalesce(li->>'phase', '')), ''),
      nullif(trim(coalesce(li->>'phase_terms', '')), ''),
      case when li->>'range_end' in ('low', 'high') then li->>'range_end' else null end
    from jsonb_array_elements(p_line_items) as li;

    update public.proposals p
       set total_cents = public.proposal_default_total(p_proposal_id),
           updated_at = now()
     where p.id = p_proposal_id;
  end if;
end $$;

revoke all on function public.save_proposal_content(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.proposal_default_total(uuid) from public, anon, authenticated;
