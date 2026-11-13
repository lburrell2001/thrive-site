-- 062: phased estimates and proposals.
--
-- A phase is a group of lines with its own payment terms ("50% to start · 50%
-- on delivery"). A phased estimate or proposal shows each phase's subtotal and
-- terms, never a grand total. The client approves the phases they want; no
-- invoice is made — Lauren is texted and makes an estimate from those phases.
--
-- Estimate lines (estimates.line_items jsonb) carry `phase` and `phase_terms`
-- in the JSON, so they need no column. The client's approval is kept in
-- estimates.selection (061) as { "phases": ["Discovery", …], "made": [...] }.
--
-- New here: the same two fields on proposal lines.

alter table public.proposal_line_items add column if not exists phase text;
alter table public.proposal_line_items add column if not exists phase_terms text;

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
      (id, proposal_id, label, description, quantity, unit_price_cents, position, tier, is_optional, phase, phase_terms)
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
      nullif(trim(coalesce(li->>'phase_terms', '')), '')
    from jsonb_array_elements(p_line_items) as li;

    update public.proposals p
       set total_cents = public.proposal_default_total(p_proposal_id),
           updated_at = now()
     where p.id = p_proposal_id;
  end if;
end $$;

revoke all on function public.save_proposal_content(uuid, jsonb, jsonb) from public, anon, authenticated;
