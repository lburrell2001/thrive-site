'use client';

import { useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

const inp: React.CSSProperties = {
  border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '9px 12px',
  fontFamily: `var(--font-inter), 'Inter', sans-serif`, fontSize: 14,
  outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff',
};

export default function SettingsPage() {
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState('');
  const [saveErr,   setSaveErr]   = useState('');

  const [fullName,     setFullName]     = useState('');
  const [companyName,  setCompanyName]  = useState('');
  const [initials,     setInitials]     = useState('');
  const [email,        setEmail]        = useState('');
  const [userId,       setUserId]       = useState('');

  const [seeding,  setSeeding]  = useState(false);
  const [seedMsg,  setSeedMsg]  = useState('');
  const [seedErr,  setSeedErr]  = useState('');

  const [removing,   setRemoving]   = useState(false);
  const [removeMsg,  setRemoveMsg]  = useState('');
  const [removeErr,  setRemoveErr]  = useState('');
  const [confirmRem, setConfirmRem] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? '');
      const { data } = await supabasePortal
        .from('portal_clients').select('full_name, company_name, initials')
        .eq('id', user.id).single();
      if (data) {
        setFullName(data.full_name ?? '');
        setCompanyName(data.company_name ?? '');
        setInitials(data.initials ?? '');
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true); setSaveMsg(''); setSaveErr('');
    const { error: upErr } = await supabasePortal
      .from('portal_clients')
      .update({ full_name: fullName.trim(), company_name: companyName.trim(), initials: initials.trim().slice(0, 2).toUpperCase() })
      .eq('id', userId);
    if (upErr) { setSaveErr(upErr.message); setSaving(false); return; }
    setSaveMsg('Profile updated.');
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function handleSeedData() {
    setSeeding(true); setSeedMsg(''); setSeedErr('');
    try {
      const { data: { session } } = await supabasePortal.auth.getSession();
      if (!session) { setSeedErr('Not logged in.'); return; }
      const res  = await fetch('/api/portal/admin/seed', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json() as { seeded?: boolean; message?: string; error?: string };
      if (!res.ok)      { setSeedErr(data.error ?? 'Seed failed.'); return; }
      if (!data.seeded) { setSeedMsg(data.message ?? 'Data already exists — no changes made.'); return; }
      setSeedMsg('Demo data added! Refresh any page to see it.');
    } catch (e) {
      setSeedErr(e instanceof Error ? e.message : 'Unexpected error.');
    } finally {
      setSeeding(false);
    }
  }

  async function handleRemoveData() {
    setRemoving(true); setRemoveMsg(''); setRemoveErr('');
    try {
      const { data: { session } } = await supabasePortal.auth.getSession();
      if (!session) { setRemoveErr('Not logged in.'); return; }
      const res  = await fetch('/api/portal/admin/unseed', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setRemoveErr(data.error ?? 'Remove failed.'); return; }
      setRemoveMsg('Demo data removed. Portal is now clean.');
      setConfirmRem(false);
    } catch (e) {
      setRemoveErr(e instanceof Error ? e.message : 'Unexpected error.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: '#f6f5f4', minHeight: '100%' }}>

      {/* Profile section */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
        <div style={{ height: 3, background: '#e40586' }} />
        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{ fontFamily: F.bungee, fontSize: 13, color: '#0a0a0a', letterSpacing: '-0.01em', marginBottom: 4 }}>PROFILE</div>
          <div style={{ fontFamily: F.inter, fontSize: 13, color: '#808080', marginBottom: 20 }}>Update your name, company, and contact information.</div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 38, borderRadius: 8, background: '#f1f0ef' }} />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</label>
                  <input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company</label>
                  <input style={inp} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Initials</label>
                  <input style={inp} value={initials} onChange={e => setInitials(e.target.value.slice(0, 2))} placeholder="AB" maxLength={2} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
                  <input style={{ ...inp, background: '#f9f9f9', color: '#808080' }} value={email} readOnly />
                </div>
              </div>

              {saveErr && (
                <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', background: '#fff0f8', border: '1px solid #fbc8e8', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{saveErr}</p>
              )}
              {saveMsg && (
                <p style={{ fontFamily: F.inter, fontSize: 13, color: '#0a7a3a', background: '#f0fff8', border: '1px solid #0cf574', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{saveMsg}</p>
              )}

              <div>
                <button type="submit" disabled={saving} style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#fff', background: saving ? '#ccc' : '#e40586', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: saving ? 'default' : 'pointer', transition: 'background .15s' }}>
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Demo data seeder */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
        <div style={{ height: 3, background: '#0cf574' }} />
        <div style={{ padding: '24px' }}>
          <div style={{ fontFamily: F.bungee, fontSize: 13, color: '#0a0a0a', letterSpacing: '-0.01em', marginBottom: 6 }}>DEMO DATA</div>
          <p style={{ fontFamily: F.inter, fontSize: 13, color: '#808080', margin: '0 0 16px', lineHeight: 1.6 }}>
            Populate your portal with sample projects, invoices, requests, milestones, and onboarding steps so you can see how everything looks with real data. This only runs once — it won&apos;t overwrite existing records.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={handleSeedData}
              disabled={seeding}
              style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#fff', background: seeding ? '#ccc' : '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: seeding ? 'default' : 'pointer', transition: 'background .15s' }}
            >
              {seeding ? 'Adding data…' : 'Add Demo Data'}
            </button>
            {!confirmRem ? (
              <button
                onClick={() => setConfirmRem(true)}
                disabled={removing}
                style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#c0006a', background: '#fff0f8', border: '1.5px solid #f5b8d8', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', transition: 'background .15s' }}
              >
                Remove Demo Data
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff0f8', border: '1px solid #f5b8d8', borderRadius: 8, padding: '8px 14px' }}>
                <span style={{ fontFamily: F.inter, fontSize: 13, color: '#c0006a', fontWeight: 600 }}>Remove all data?</span>
                <button
                  onClick={handleRemoveData}
                  disabled={removing}
                  style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#fff', background: removing ? '#ccc' : '#e40586', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: removing ? 'default' : 'pointer' }}
                >
                  {removing ? 'Removing…' : 'Yes, remove'}
                </button>
                <button
                  onClick={() => setConfirmRem(false)}
                  style={{ fontFamily: F.inter, fontSize: 13, color: '#808080', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          {seedMsg && (
            <p style={{ fontFamily: F.inter, fontSize: 13, color: '#0a7a3a', background: '#f0fff8', border: '1px solid #0cf574', borderRadius: 8, padding: '10px 14px', margin: '14px 0 0' }}>{seedMsg}</p>
          )}
          {seedErr && (
            <p style={{ fontFamily: F.inter, fontSize: 13, color: '#c0006a', background: '#fff0f8', border: '1px solid #f5b8d8', borderRadius: 8, padding: '10px 14px', margin: '14px 0 0' }}>{seedErr}</p>
          )}
          {removeMsg && (
            <p style={{ fontFamily: F.inter, fontSize: 13, color: '#0a7a3a', background: '#f0fff8', border: '1px solid #0cf574', borderRadius: 8, padding: '10px 14px', margin: '14px 0 0' }}>{removeMsg}</p>
          )}
          {removeErr && (
            <p style={{ fontFamily: F.inter, fontSize: 13, color: '#c0006a', background: '#fff0f8', border: '1px solid #f5b8d8', borderRadius: 8, padding: '10px 14px', margin: '14px 0 0' }}>{removeErr}</p>
          )}
        </div>
      </div>

    </div>
  );
}
