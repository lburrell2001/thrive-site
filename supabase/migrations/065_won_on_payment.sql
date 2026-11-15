-- 065: a deal is Won only when the client pays.
--
-- Before: a signed proposal (021) or an accepted estimate (049) moved the deal
-- straight to Won. Now signing/accepting keeps it at Quote sent ('proposal')
-- and notes "waiting on payment" on the timeline; the deal is won by the
-- existing payment triggers — a deposit paid (048) or an invoice paid (036).
-- Re-runnable.

create or replace function public.crm_follow_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if new.status is not distinct from old.status or new.crm_deal_id is null then return null; end if;

  if new.status in ('sent', 'viewed', 'signed') then
    update public.crm_deals
       set stage = 'proposal',
           value_cents = coalesce(value_cents, nullif(new.total_cents, 0))
     where id = new.crm_deal_id and stage in ('lead', 'contacted');
  end if;

  if new.status = 'signed' then
    select contact_id into cid from public.crm_deals where id = new.crm_deal_id;
    if cid is not null then
      insert into public.crm_activities (contact_id, deal_id, kind, body, metadata)
      values (cid, new.crm_deal_id, 'note',
              'Signed the proposal “' || new.title || '” — the deal is won once they pay.',
              jsonb_build_object('proposal_id', new.id, 'signed', true));
    end if;
  end if;
  return null;
end $$;

create or replace function public.crm_follow_estimate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if new.status is not distinct from old.status or new.crm_deal_id is null then return null; end if;

  if new.status in ('sent', 'accepted') then
    update public.crm_deals
       set stage = 'proposal',
           value_cents = coalesce(value_cents, nullif(new.total_cents, 0))
     where id = new.crm_deal_id and stage in ('lead', 'contacted');
  end if;

  if new.status = 'accepted' then
    select contact_id into cid from public.crm_deals where id = new.crm_deal_id;
    if cid is not null then
      insert into public.crm_activities (contact_id, deal_id, kind, body, metadata)
      values (cid, new.crm_deal_id, 'note',
              'Accepted estimate ' || new.estimate_number
                || coalesce(' (' || nullif(new.title, '') || ')', '')
                || ' — the deal is won once they pay.',
              jsonb_build_object('estimate_id', new.id, 'accepted', true));
    end if;
  end if;
  return null;
end $$;

-- Backfill: open Won deals that got there by a signing/acceptance and have
-- nothing paid go back to Quote sent. Deals marked Won by hand (no accepted
-- estimate or signed proposal on them) and anything paid are left alone. The
-- early "→ Won" timeline entry is removed rather than logging a step back.
do $$
declare
  d record;
begin
  for d in
    select cd.id
      from public.crm_deals cd
     where cd.stage = 'won' and cd.closed_at is null
       and (exists (select 1 from public.estimates e where e.crm_deal_id = cd.id and e.status in ('accepted', 'invoiced'))
            or exists (select 1 from public.proposals p where p.crm_deal_id = cd.id and p.status = 'signed'))
       and not exists (select 1 from public.portal_invoices i
                        where i.crm_deal_id = cd.id and (i.status = 'paid' or i.deposit_paid_at is not null))
  loop
    update public.crm_deals set stage = 'proposal' where id = d.id;
    insert into public.crm_activities (contact_id, deal_id, kind, body, metadata, created_at)
    select cd.contact_id, cd.id, 'note',
           'Accepted estimate ' || e.estimate_number || coalesce(' (' || nullif(e.title, '') || ')', '') || ' — the deal is won once they pay.',
           jsonb_build_object('estimate_id', e.id, 'accepted', true), coalesce(e.accepted_at, now())
      from public.estimates e join public.crm_deals cd on cd.id = e.crm_deal_id
     where e.crm_deal_id = d.id and e.status in ('accepted', 'invoiced')
       and not exists (select 1 from public.crm_activities a where a.metadata->>'estimate_id' = e.id::text and a.metadata ? 'accepted');
    delete from public.crm_activities
     where deal_id = d.id and kind = 'stage'
       and (metadata->>'to' = 'won' or (metadata->>'from' = 'won' and metadata->>'to' = 'proposal' and created_at >= now()));
  end loop;
end $$;
