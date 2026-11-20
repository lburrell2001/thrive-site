-- 072: a billing address on the CRM contact too, so anyone (not only portal
-- clients) can have one: set in the contact panel's Details. Kept in step
-- with their portal account's (071) when either is saved in admin, copied to
-- a new portal login, and printed on their estimate/invoice PDFs and
-- receipts. Re-runnable.

alter table public.crm_contacts
  add column if not exists billing_address text;

-- Portal clients who already have one: onto their contact.
update public.crm_contacts c
   set billing_address = pc.billing_address
  from public.portal_clients pc
 where c.portal_client_id = pc.id
   and pc.billing_address is not null
   and c.billing_address is null;
