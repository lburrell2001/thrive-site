'use client';

import { useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { SMS_CONSENT_LABEL, SMS_CONSENT_SUMMARY, SMS_CONSENT_TEXT } from '@/lib/smsConsent';

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

const inp: React.CSSProperties = {
  border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '9px 12px',
  fontFamily: `var(--font-inter), 'Inter', sans-serif`, fontSize: 14,
  outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff', color: '#0a0a0a',
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
  const [phone,        setPhone]        = useState('');
  const [smsOptIn,     setSmsOptIn]     = useState(false);
  const [userId,       setUserId]       = useState('');


  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? '');
      const { data } = await supabasePortal
        .from('portal_clients').select('full_name, company_name, initials, phone, sms_opt_in')
        .eq('id', user.id).single();
      if (data) {
        setFullName(data.full_name ?? '');
        setCompanyName(data.company_name ?? '');
        setInitials(data.initials ?? '');
        setPhone(formatPhone(data.phone));
        setSmsOptIn(Boolean(data.sms_opt_in));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const normalizedPhone = normalizePhone(phone);
    if (phone.trim() && !normalizedPhone) {
      setSaveErr('Enter a valid mobile number, e.g. (555) 123-4567');
      return;
    }
    setSaving(true); setSaveMsg(''); setSaveErr('');
    const { error: upErr } = await supabasePortal
      .from('portal_clients')
      .update({
        full_name: fullName.trim(),
        company_name: companyName.trim(),
        initials: initials.trim().slice(0, 2).toUpperCase(),
        phone: normalizedPhone,
        // No number, nothing to text.
        sms_opt_in: Boolean(normalizedPhone) && smsOptIn,
      })
      .eq('id', userId);
    if (upErr) { setSaveErr(upErr.message); setSaving(false); return; }
    setSaveMsg('Profile updated.');
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mobile</label>
                  <input style={inp} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                </div>
              </div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: F.inter, fontSize: 13, color: phone.trim() ? '#0a0a0a' : '#bfbfbf', lineHeight: 1.5 }}>
                <input type="checkbox" checked={smsOptIn && Boolean(phone.trim())} disabled={!phone.trim()} onChange={e => setSmsOptIn(e.target.checked)} style={{ marginTop: 3, accentColor: '#e40586' }} />
                <span>
                  <strong>{SMS_CONSENT_LABEL}</strong> — {SMS_CONSENT_SUMMARY}
                  <span style={{ display: 'block', fontSize: 11, color: '#808080' }}>
                    {SMS_CONSENT_TEXT} <a href="/sms" target="_blank" style={{ color: '#808080' }}>Terms</a> · <a href="/privacy" target="_blank" style={{ color: '#808080' }}>Privacy</a>
                  </span>
                </span>
              </label>

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

    </div>
  );
}
