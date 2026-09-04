import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Make one template the default.
 *
 * A partial unique index enforces that at most one row has is_default set, so
 * the previous default has to be cleared before the new one is written —
 * setting the new one first would violate the constraint.
 */
export async function setDefaultTemplate(
  db: SupabaseClient,
  templateId: string,
): Promise<string | null> {
  const cleared = await db
    .from('proposal_templates')
    .update({ is_default: false })
    .eq('is_default', true)
    .neq('id', templateId);
  if (cleared.error) return cleared.error.message;

  const set = await db
    .from('proposal_templates')
    .update({ is_default: true })
    .eq('id', templateId);
  return set.error?.message ?? null;
}
