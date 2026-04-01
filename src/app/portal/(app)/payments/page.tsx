'use client';

import { useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

interface DbInvoice {
  id: string; invoice_number: string; project_name: string;
  amount_cents: number; invoice_date: string; due_date: string; status: string;
}

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

function fmtCurrency(c: number) {
  return (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Skel({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, background: '#f1f0ef' }} />;
}

export default function PaymentsPage() {
  const [paid,    setPaid]    = useState<DbInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;
      const { data, error: qErr } = await supabasePortal
        .from('portal_invoices').select('*')
        .eq('client_id', user.id).eq('status', 'paid')
        .order('invoice_date', { ascending: false });
      if (qErr) { setError(true); setLoading(false); return; }
      setPaid(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const totalPaid = paid.reduce((s, i) => s + i.amount_cents, 0);
  const lastPayment = paid[0] ?? null;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, background: '#f6f5f4', minHeight: '100%' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}.skel{animation:pulse 1.5s ease-in-out infinite}`}</style>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[
          { label: 'Total Paid',   value: loading ? '—' : fmtCurrency(totalPaid),                                   color: '#0cf574' },
          { label: 'Last Payment', value: loading ? '—' : (lastPayment ? fmtDate(lastPayment.invoice_date) : '—'),  color: '#1e3add' },
          { label: 'Payments Made', value: loading ? '—' : String(paid.length),                                     color: '#fd6100' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
            <div style={{ height: 3, background: c.color }} />
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#808080' }}>{c.label}</div>
              <div style={{ fontFamily: F.bungee, fontSize: 28, color: '#0a0a0a', marginTop: 8, opacity: loading ? 0.3 : 1 }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fff0f8', border: '1px solid #e40586', borderRadius: 12, padding: '14px 20px', fontFamily: F.inter, fontSize: 14, color: '#e40586' }}>
          Something went wrong loading payment history — please refresh.
        </div>
      )}

      {/* Payment history table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px' }}>
          <h2 style={{ fontFamily: F.bungee, fontSize: 13, color: '#0a0a0a', letterSpacing: '-0.01em', margin: 0 }}>PAYMENT HISTORY</h2>
        </div>
        <div style={{ height: 1, background: '#f1f0ef' }} />

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 120px', gap: 12, padding: '10px 24px', background: '#fafafa' }}>
          {['Invoice #', 'Project', 'Amount', 'Date'].map(col => (
            <span key={col} style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#808080' }}>{col}</span>
          ))}
        </div>

        {/* Loading */}
        {loading && [1, 2, 3].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 120px', gap: 12, padding: '14px 24px', borderTop: '1px solid #f1f0ef', alignItems: 'center' }}>
            <Skel w={50} h={13} /><Skel w="60%" h={13} /><Skel w={70} h={13} /><Skel w={80} h={13} />
          </div>
        ))}

        {/* Empty */}
        {!loading && !error && paid.length === 0 && (
          <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <p style={{ fontFamily: F.inter, fontSize: 14, color: '#bfbfbf', margin: 0 }}>No payments yet</p>
          </div>
        )}

        {/* Rows */}
        {!loading && !error && paid.map((inv, i) => (
          <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 120px', gap: 12, padding: '14px 24px', borderTop: '1px solid #f1f0ef', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>{inv.invoice_number}</span>
            <span style={{ fontFamily: F.inter, fontSize: 14, color: '#0a0a0a' }}>{inv.project_name}</span>
            <span style={{ fontFamily: F.inter, fontSize: 14, fontWeight: 600, color: '#0a7a3a' }}>{fmtCurrency(inv.amount_cents)}</span>
            <span style={{ fontFamily: F.inter, fontSize: 13, color: '#808080' }}>{fmtDate(inv.invoice_date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
