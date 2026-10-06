// Delete contacts, or move them to Leads / Prospects — from the contact
// panel or a list's select bar. Asks first where it can't be undone, then
// reports what happened. The rules live in src/lib/crmBulk.ts.

import { apiSend } from '../proposals/adminApi';

export type ContactAction = { action: 'delete' } | { action: 'move'; to: 'lead' | 'prospect' };

interface Result { changed: number; skipped: number; note: string | null }

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

/** `who` names them in the confirm: a person's name, or "3 people". Resolves true if anything changed. */
export async function runContactAction(
  act: ContactAction,
  ids: string[],
  who: string,
  notify: (message: string, tone?: 'ok' | 'error') => void,
): Promise<boolean> {
  const question = act.action === 'delete'
    ? `Delete ${who}? Their deals, notes and tasks are deleted too. Inquiries, proposals, invoices and portal accounts stay. This can’t be undone.`
    : act.to === 'prospect'
      ? `Move ${who} to Prospects? Open deals are closed as Lost (“Moved to Prospects”) and come off the pipeline. Clients aren’t moved.`
      : null;
  if (question && !window.confirm(question)) return false;
  try {
    const r = await apiSend<Result>('/api/crm/contacts/bulk', 'POST', { ...act, ids });
    const done = act.action === 'delete' ? `Deleted ${people(r.changed)}.`
      : `Moved ${people(r.changed)} to ${act.to === 'lead' ? 'Leads' : 'Prospects'}.`;
    notify(r.skipped ? `${done} ${r.skipped} left as is — ${r.note ?? 'nothing to change'}.` : done);
    return r.changed > 0;
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Could not update', 'error');
    return false;
  }
}
