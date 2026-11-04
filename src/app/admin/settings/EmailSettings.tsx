'use client';

// Settings → Email: the mailing address every marketing email carries, how
// replies are caught (Outlook or Resend's inbound webhook), and the Outlook
// and Google Voice connections (../crm/emails/Connections.tsx).

import { useCallback, useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { useCrm } from '../crm/CrmContext';
import { Connections, type OutlookStatus } from '../crm/emails/Connections';

interface MailSettings {
  address: string | null;
  inbound: { domain: string | null; webhook: boolean };
}

const urlParam = (key: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key));

export function EmailSettings() {
  const { notify } = useCrm();
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [outlook, setOutlook] = useState<OutlookStatus | null>(null);
  const [address, setAddress] = useState('');

  const loadOutlook = useCallback(async () => {
    setOutlook(await apiGet<OutlookStatus>('/api/outlook').catch(() => null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGet<MailSettings>('/api/newsletters/settings')
      .then((s) => { if (!cancelled) { setSettings(s); setAddress(s.address ?? ''); } })
      .catch((e) => notify(e instanceof Error ? e.message : 'Could not load settings', 'error'));
    apiGet<OutlookStatus>('/api/outlook').then((o) => { if (!cancelled) setOutlook(o); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [notify]);

  // Back from the Microsoft sign-in.
  useEffect(() => {
    const ok = urlParam('outlook');
    const failed = urlParam('outlook_error');
    if (!ok && !failed) return;
    if (ok) notify('Outlook connected. Mail with your contacts will show up within 5 minutes.');
    else notify(`Outlook didn’t connect: ${failed}`, 'error');
    window.history.replaceState(null, '', '/admin/settings?tab=email');
  }, [notify]);

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiSend('/api/newsletters/settings', 'PATCH', { address });
      setSettings((s) => (s ? { ...s, address: address.trim() } : s));
      notify('Mailing address saved.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save', 'error');
    }
  }

  const outlookOn = Boolean(outlook?.connection && !outlook.connection.last_error?.startsWith('Reconnect'));
  const resendOn = Boolean(settings?.inbound.domain && settings.inbound.webhook);

  return (
    <>
      <div className={w.grid2}>
        <form className={w.card} onSubmit={saveAddress}>
          <div className={w.cardHead}><h2 className={w.cardTitle}>Mailing address</h2></div>
          <div style={{ padding: 18 }}>
            <p className={w.muted} style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.55 }}>
              US law (CAN-SPAM) requires a physical address in every marketing email, newsletters and cold outreach alike. A PO box or registered mailbox is fine.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className={p.input} style={{ flex: '1 1 220px' }} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="PO Box 123, Dallas, TX 75201" aria-label="Mailing address" />
              <button type="submit" className={p.btn} disabled={!settings || !address.trim() || address.trim() === (settings.address ?? '')}>Save</button>
            </div>
          </div>
        </form>

        <section className={w.card}>
          <div className={w.cardHead}>
            <h2 className={w.cardTitle}>Catching replies</h2>
            <span className={`${w.pill} ${outlookOn || resendOn ? w.pillClient : w.pillMuted}`} style={{ marginLeft: 'auto' }}>{outlookOn || resendOn ? 'On' : 'Off'}</span>
          </div>
          <div style={{ padding: 18, fontSize: 13.5, lineHeight: 1.6 }}>
            {outlookOn ? (
              <p style={{ margin: 0 }}>
                Through Outlook: emails you send from the CRM come from {outlook?.connection?.send_from ?? outlook?.connection?.account_email}, so replies land in your inbox and the CRM picks them up from there. Newsletters still go through Resend.
              </p>
            ) : resendOn ? (
              <p style={{ margin: 0 }}>
                Replies go to <code>reply-…@{settings?.inbound.domain}</code>. Each one is logged on the person, forwarded to your inbox, and a prospect who replies becomes a New lead.
              </p>
            ) : (
              <p style={{ margin: 0 }}>Connect Outlook below so replies come to your inbox and are logged here.</p>
            )}
            {settings?.inbound.domain && !settings.inbound.webhook && <p style={{ color: '#b45309' }}>RESEND_INBOUND_DOMAIN is set but RESEND_WEBHOOK_SECRET isn’t, so replies to newsletters would be refused.</p>}
          </div>
        </section>
      </div>

      <Connections status={outlook} onChange={loadOutlook} notify={notify} />
    </>
  );
}
