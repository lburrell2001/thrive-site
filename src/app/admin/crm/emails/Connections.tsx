'use client';

// Settings → Email: the Outlook connection (outlook.ts, outlookSync.ts) and
// how Google Voice alerts reach the CRM (googleVoice.ts).

import { useState } from 'react';
import p from '../../proposals/proposals.module.css';
import w from '../workspace.module.css';
import { apiSend } from '../../proposals/adminApi';
import { formatPhone } from '@/lib/phone';
import { formatWhen } from '@/lib/scheduleTime';

export interface OutlookStatus {
  configured: boolean;
  ready: boolean;
  connection: {
    account_email: string;
    shared_mailboxes: string[];
    send_from: string | null;
    connected_at: string;
    last_sync_at: string | null;
    last_error: string | null;
    /** Migration 043; undefined before it. */
    granted_scopes?: string | null;
    calendar_synced_at?: string | null;
  } | null;
  voiceNumber: boolean;
  unmatchedVoice: { id: string; kind: 'text' | 'voicemail' | 'missed_call'; phone: string | null; caller_name: string | null; body: string; occurred_at: string }[];
}

const VOICE_KIND = { text: 'Text', voicemail: 'Voicemail', missed_call: 'Missed call' } as const;

export function Connections({ status, onChange, notify }: {
  status: OutlookStatus | null;
  onChange: () => Promise<void>;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | 'mailbox' | null>(null);
  const [newMailbox, setNewMailbox] = useState('');

  async function mailbox(action: 'add_mailbox' | 'remove_mailbox' | 'send_from', email: string) {
    if (action === 'remove_mailbox' && !window.confirm(`Stop reading ${email}? Mail already logged stays.`)) return;
    setBusy('mailbox');
    try {
      await apiSend('/api/outlook', 'POST', { action, email });
      if (action === 'add_mailbox') { setNewMailbox(''); notify(`Reading ${email.trim().toLowerCase()} too. Its mail shows up at the next sync.`); }
      if (action === 'send_from') notify(`CRM emails now go from ${email}.`);
      await onChange();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Something went wrong', 'error');
    }
    setBusy(null);
  }

  async function run(action: 'connect' | 'sync' | 'disconnect') {
    if (action === 'disconnect' && !window.confirm('Disconnect Outlook? CRM emails go back to sending through Resend, and new mail stops being logged.')) return;
    setBusy(action);
    try {
      if (action === 'connect') {
        const { url } = await apiSend<{ url: string }>('/api/outlook', 'POST', { action });
        window.location.assign(url);
        return;
      }
      const r = await apiSend<{ replies: number; sent: number; voice: number; meetings?: number; calendar?: string } | { skipped: string } | null>('/api/outlook', 'POST', { action });
      if (action === 'sync' && r && 'replies' in r) {
        const cal = r.meetings !== undefined ? `, ${r.meetings} calendar event${r.meetings === 1 ? '' : 's'}` : '';
        notify(`Synced: ${r.replies} from contacts, ${r.sent} you sent, ${r.voice} Google Voice${cal}.`);
      } else if (action === 'disconnect') {
        notify('Outlook disconnected.');
      }
      await onChange();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Something went wrong', 'error');
    }
    setBusy(null);
  }

  const conn = status?.connection ?? null;
  const broken = Boolean(conn?.last_error);
  const calendarOn = Boolean(conn?.granted_scopes?.split(' ').some((x) => x.toLowerCase() === 'calendars.read'));

  return (
    <div className={w.grid2} style={{ marginTop: 16 }}>
      <section className={w.card}>
        <div className={w.cardHead}>
          <h2 className={w.cardTitle}>Outlook</h2>
          <span className={`${w.pill} ${conn && !broken ? w.pillClient : w.pillMuted}`} style={{ marginLeft: 'auto' }}>
            {conn ? (broken ? 'Needs attention' : 'Connected') : 'Off'}
          </span>
        </div>
        <div style={{ padding: 18, fontSize: 13.5, lineHeight: 1.6 }}>
          {!status ? <p className={w.muted} style={{ margin: 0 }}>Loading…</p> : conn ? (
            <>
              <p style={{ margin: '0 0 10px' }}>
                Signed in as <strong>{conn.account_email}</strong>. Every 5 minutes, mail to and from your contacts in these mailboxes is added to their timeline, and a prospect who writes becomes a New lead.
              </p>
              <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0 }}>
                {[conn.account_email, ...conn.shared_mailboxes].map((m) => (
                  <li key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid #e6e6e6' }}>
                    <span style={{ flex: 1 }}>{m}{m === conn.account_email && <span className={w.muted}> · signed in</span>}</span>
                    {m !== conn.account_email && (
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy !== null} onClick={() => mailbox('remove_mailbox', m)}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
              <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 12px' }}
                onSubmit={(e) => { e.preventDefault(); if (newMailbox.trim()) void mailbox('add_mailbox', newMailbox); }}>
                <input className={p.input} style={{ flex: '1 1 200px' }} value={newMailbox} onChange={(e) => setNewMailbox(e.target.value)}
                  placeholder="hello@thrivecreativestudios.org" aria-label="Another mailbox to read" />
                <button type="submit" className={p.btn} disabled={busy !== null || !newMailbox.trim()}>{busy === 'mailbox' ? 'Checking…' : 'Add mailbox'}</button>
              </form>
              <p className={w.muted} style={{ margin: '0 0 6px' }}>You need Full Access to a mailbox before it can be added.</p>
              <label style={{ display: 'block', margin: '0 0 12px' }}>
                <span className={p.label}>CRM emails and reminders send from</span>
                <select className={p.select} value={conn.send_from ?? conn.account_email} disabled={busy !== null}
                  onChange={(e) => mailbox('send_from', e.target.value)}>
                  {[conn.account_email, ...conn.shared_mailboxes].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {conn.send_from && <span className={w.muted} style={{ display: 'block', marginTop: 4 }}>Sending as {conn.send_from} needs “Send as” for {conn.account_email} on that mailbox in Exchange.</span>}
              </label>
              <div style={{ margin: '0 0 12px', padding: '10px 12px', background: '#f5f5f5', borderRadius: 8 }}>
                <strong>Calendar</strong>{' '}
                {conn.granted_scopes === undefined ? (
                  <span className={w.muted}>— run migration 043 in Supabase, then reconnect Outlook.</span>
                ) : calendarOn ? (
                  <span className={w.muted}>
                    — on. Meetings on your calendar for the next 60 days show on Home, Calls and the contact&apos;s timeline (matched by an invitee&apos;s email, or a contact&apos;s name in the title).
                    {conn.calendar_synced_at && ` Last read ${formatWhen(conn.calendar_synced_at)}.`}
                  </span>
                ) : (
                  <>
                    <span className={w.muted}>— off. Reconnect once to let the CRM read your calendar too.</span>{' '}
                    <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={busy !== null} onClick={() => run('connect')}>Reconnect with calendar</button>
                  </>
                )}
              </div>
              <p className={w.muted} style={{ margin: '0 0 12px' }}>
                {conn.last_sync_at ? `Last checked ${formatWhen(conn.last_sync_at)}.` : 'Not checked yet.'}
              </p>
              {conn.last_error && <p style={{ margin: '0 0 12px', color: '#e50586' }}>{conn.last_error}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {broken && conn.last_error?.startsWith('Reconnect') ? (
                  <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={busy !== null} onClick={() => run('connect')}>Reconnect Outlook</button>
                ) : (
                  <button type="button" className={p.btn} disabled={busy !== null} onClick={() => run('sync')}>{busy === 'sync' ? 'Checking…' : 'Sync now'}</button>
                )}
                <button type="button" className={`${p.btn} ${p.btnDanger}`} disabled={busy !== null} onClick={() => run('disconnect')}>Disconnect</button>
              </div>
            </>
          ) : status.configured ? (
            <>
              <p style={{ margin: '0 0 12px' }}>
                Connect the mailbox that gets your Thrive email. CRM emails will send from it (they show in your Sent folder and replies come straight to you), and mail with your contacts is logged on their timeline. Only mail involving a CRM contact is saved.
              </p>
              {!status.ready && <p style={{ margin: '0 0 12px', color: '#e50586' }}>Run migration 040 in Supabase first.</p>}
              <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={busy !== null || !status.ready} onClick={() => run('connect')}>
                {busy === 'connect' ? 'Opening Microsoft…' : 'Connect Outlook'}
              </button>
            </>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>In the Microsoft Entra admin center → App registrations, add an app (accounts in this organization only) with the web redirect URI <code>https://thrivecreativestudios.org/api/outlook/callback</code>.</li>
              <li>Under API permissions, add Microsoft Graph delegated <code>Mail.Read</code>, <code>Mail.Send</code>, <code>Mail.Read.Shared</code>, <code>Mail.Send.Shared</code>, <code>offline_access</code> and <code>User.Read</code>.</li>
              <li>Under Certificates &amp; secrets, add a client secret.</li>
              <li>In Vercel, set <code>MS_TENANT_ID</code>, <code>MS_CLIENT_ID</code> and <code>MS_CLIENT_SECRET</code>, then redeploy and come back here to connect.</li>
            </ol>
          )}
        </div>
      </section>

      <section className={w.card}>
        <div className={w.cardHead}>
          <h2 className={w.cardTitle}>Google Voice</h2>
        </div>
        <div style={{ padding: 18, fontSize: 13.5, lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 10px' }}>
            Google Voice can’t be read directly, but it emails you texts, voicemails and missed calls. Send those to your Outlook inbox and the CRM logs them on the contact with that phone number, with a task to call or text back.
          </p>
          <ol style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li>In Google Voice → Settings, turn on email for messages, voicemail and missed calls.</li>
            <li>In Gmail → Settings → Forwarding, add your Outlook address and enter the code Gmail sends there.</li>
            <li>In Gmail, make a filter for <code>from:(txt.voice.google.com OR voice-noreply@google.com)</code> that forwards to that address.</li>
            <li>Optional: set <code>GOOGLE_VOICE_NUMBER</code> in Vercel to your Voice number so it’s never mistaken for a caller.</li>
          </ol>
          <p className={w.muted} style={{ margin: 0 }}>
            Calls you make, texts you send and calls you answer aren’t emailed by Google. Log those with Log call or the Text note on the contact.
          </p>
          {status && status.unmatchedVoice.length > 0 && (
            <>
              <h3 style={{ margin: '16px 0 6px', fontSize: 13.5 }}>From numbers not in the CRM</h3>
              <p className={w.muted} style={{ margin: '0 0 6px' }}>Add the number to a contact and these move onto their timeline at the next sync.</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {status.unmatchedVoice.map((v) => (
                  <li key={v.id} style={{ padding: '6px 0', borderTop: '1px solid #e6e6e6' }}>
                    <strong>{v.caller_name || formatPhone(v.phone) || 'Unknown'}</strong>
                    <span className={w.muted}> · {VOICE_KIND[v.kind]} · {formatWhen(v.occurred_at)}</span>
                    {v.body && <div className={w.muted} style={{ whiteSpace: 'pre-line' }}>{v.body.slice(0, 200)}</div>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
