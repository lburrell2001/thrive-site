-- ============================================================
-- ATOMIC CONTENT SAVE
-- ============================================================
-- The builder autosaves the whole block list and line-item list at once.
-- Doing that as delete-then-insert from the client would leave a window
-- where a failed insert has already destroyed the blocks. This function
-- does it inside one transaction, so a failure rolls the whole save back
-- and the proposal keeps the content it had.
--
-- proposal_blocks has unique (proposal_id, position) DEFERRABLE INITIALLY
-- DEFERRED, so positions can be rewritten freely within the transaction.

create or replace function public.save_proposal_content(
  p_proposal_id uuid,
  p_blocks      jsonb default null,   -- null = leave blocks untouched
  p_line_items  jsonb default null    -- null = leave line items untouched
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
      (id, proposal_id, label, description, quantity, unit_price_cents, position)
    select
      coalesce((li->>'id')::uuid, gen_random_uuid()),
      p_proposal_id,
      li->>'label',
      nullif(li->>'description', ''),
      coalesce((li->>'quantity')::numeric, 1),
      coalesce((li->>'unit_price_cents')::int, 0),
      (li->>'position')::int
    from jsonb_array_elements(p_line_items) as li;

    -- The per-row trigger on proposal_line_items already recomputes
    -- total_cents, but an empty list deletes every row and inserts none,
    -- so make the zero case explicit.
    update public.proposals p
       set total_cents = coalesce((
             select round(sum(li.quantity * li.unit_price_cents))
               from public.proposal_line_items li
              where li.proposal_id = p_proposal_id
           ), 0),
           updated_at = now()
     where p.id = p_proposal_id;
  end if;
end $$;

-- Callable only with the service role. RLS-less tables plus SECURITY DEFINER
-- means anon must never be able to reach this.
revoke all on function public.save_proposal_content(uuid, jsonb, jsonb) from public, anon, authenticated;

-- ============================================================
-- SLUG HELPER
-- ============================================================
-- Returns a url-safe slug derived from `base`, suffixed -2, -3, … until it
-- is unique. Used when creating and duplicating proposals.

create or replace function public.next_proposal_slug(base text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  root      text;
  candidate text;
  n         int := 1;
begin
  root := regexp_replace(lower(coalesce(base, '')), '[^a-z0-9]+', '-', 'g');
  root := trim(both '-' from root);
  if root = '' then root := 'proposal'; end if;
  root := left(root, 60);

  candidate := root;
  while exists (select 1 from public.proposals where slug = candidate) loop
    n := n + 1;
    candidate := root || '-' || n;
  end loop;

  return candidate;
end $$;

revoke all on function public.next_proposal_slug(text) from public, anon, authenticated;
