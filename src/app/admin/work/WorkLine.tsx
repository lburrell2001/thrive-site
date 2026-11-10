'use client';

// One row on Work in progress (and Home): project, client, what needs doing, progress.

import Link from 'next/link';
import w from '../crm/workspace.module.css';
import k from './work.module.css';

export type WorkRow = {
  id: string; name: string; client_id: string; client: string; kind: string | null; status: string; progress: number;
  archived: boolean; completed_at: string | null; created_at: string; done: number; total: number;
  social: boolean; needs_start_stats: boolean; report_sent_at: string | null;
};

export function WorkLine({ row }: { row: WorkRow }) {
  const pct = row.total ? Math.round((row.done / row.total) * 100) : row.progress;
  return (
    <Link href={`/admin/work/${row.id}`} className={k.line}>
      <span className={k.lineMain}>
        <strong>{row.name}</strong>
        <span className={w.muted}>{row.client}{row.social ? ' · social media' : ''}</span>
        {row.needs_start_stats && <span className={k.flag}>Add starting stats</span>}
        {!row.completed_at && row.total > 0 && row.done === row.total && <span className={k.flagGreen}>Done · send the report</span>}
        {row.completed_at && <span className={k.flagDone}>Report sent</span>}
      </span>
      <span className={k.lineProgress}>
        <span className={k.bar}><span style={{ width: `${pct}%` }} /></span>
        <span className={k.count}>{row.total ? `${row.done} of ${row.total}` : `${pct}%`}</span>
      </span>
    </Link>
  );
}

