'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
  return (c/100).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0});
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
const STATUS_COLOR: Record<string,string> = { due:'#fd6100', paid:'#0cf574', overdue:'#e40586' };
const STATUS_BG:    Record<string,string> = { due:'#fff4ec', paid:'#edfff6', overdue:'#fff0f8' };
const STATUS_LABEL: Record<string,string> = { due:'Due', paid:'Paid', overdue:'Overdue' };

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const justPaid     = searchParams.get('paid') === 'true';

  const [invoices,    setInvoices]    = useState<DbInvoice[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [dueInvoice,  setDueInvoice]  = useState<DbInvoice | null>(null);
  const [payLoading,  setPayLoading]  = useState(false);
  const [payError,    setPayError]    = useState('');
  const [statCards,   setStatCards]   = useState<{label:string;value:string;color:string}[]>([]);

  const loadInvoices = useCallback(async () => {
    const { data: { user } } = await supabasePortal.auth.getUser();
    if (!user) return;
    const { data } = await supabasePortal.from('portal_invoices').select('*').eq('client_id', user.id).order('invoice_date', { ascending: false });
    const rows: DbInvoice[] = data ?? [];
    setInvoices(rows);
    const totalPaid   = rows.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount_cents,0);
    const outstanding = rows.filter(i=>i.status==='due').reduce((s,i)=>s+i.amount_cents,0);
    const overdue     = rows.filter(i=>i.status==='overdue').reduce((s,i)=>s+i.amount_cents,0);
    const nextDue     = rows.filter(i=>i.status==='due').sort((a,b)=>new Date(a.due_date).getTime()-new Date(b.due_date).getTime())[0];
    setStatCards([
      { label:'Total Paid',  value:fmtCurrency(totalPaid),   color:'#0cf574' },
      { label:'Outstanding', value:fmtCurrency(outstanding), color:'#fd6100' },
      { label:'Overdue',     value:fmtCurrency(overdue),     color:'#e40586' },
      { label:'Next Due',    value:nextDue ? fmtDate(nextDue.due_date) : '—', color:'#1e3add' },
    ]);
    setDueInvoice(nextDue ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);
  useEffect(() => { if (justPaid) loadInvoices(); }, [justPaid, loadInvoices]);

  async function handleExportPDF(inv: DbInvoice) {
    const { generateInvoicePDF } = await import('@/lib/invoicePDF');
    await generateInvoicePDF(inv);
  }

  async function handlePay(invoiceId: string, amountCents: number, description: string) {
    setPayLoading(true); setPayError('');
    try {
      const res  = await fetch('/api/portal/stripe', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ invoiceId, amount:amountCents/100, description }) });
      const data = await res.json() as { url?:string; error?:string };
      if (!res.ok || !data.url) { setPayError(data.error ?? 'Failed to initiate payment.'); return; }
      window.location.href = data.url;
    } catch { setPayError('An unexpected error occurred.'); }
    finally  { setPayLoading(false); }
  }

  const displayStats = statCards.length > 0 ? statCards : [
    {label:'Total Paid',value:'—',color:'#0cf574'},
    {label:'Outstanding',value:'—',color:'#fd6100'},
    {label:'Overdue',value:'—',color:'#e40586'},
    {label:'Next Due',value:'—',color:'#1e3add'},
  ];

  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:24, background:'#f6f5f4', minHeight:'100%' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
        .skel{animation:pulse 1.5s ease-in-out infinite;background:#f1f0ef;border-radius:6px;}
        .inv-stats { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
        .inv-table-head { display:grid; grid-template-columns:90px 1fr 100px 100px 100px 110px 130px; gap:12px; padding:10px 24px; background:#fafafa; }
        .inv-table-row  { display:grid; grid-template-columns:90px 1fr 100px 100px 100px 110px 130px; gap:12px; padding:14px 24px; border-top:1px solid #f1f0ef; align-items:center; }
        .inv-card { display:none; }
        @media (min-width:900px) { .inv-stats { grid-template-columns:repeat(4,1fr); } }
        @media (max-width:680px) {
          .inv-table-head { display:none; }
          .inv-table-row  { display:none; }
          .inv-card       { display:block; padding:16px; border-top:1px solid #f1f0ef; }
        }
      `}</style>

      {justPaid && (
        <div style={{ background:'#f0fff8', border:'1px solid #0cf574', borderRadius:12, padding:'14px 20px', fontFamily:F.inter, fontSize:14, fontWeight:600, color:'#0a7a3a' }}>
          Payment received — your invoice has been updated.
        </div>
      )}

      {/* Stat cards */}
      <div className="inv-stats">
        {displayStats.map(c => (
          <div key={c.label} style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e5e5', overflow:'hidden' }}>
            <div style={{ height:4, background:c.color }} />
            <div style={{ padding:'16px 20px' }}>
              <p style={{ fontFamily:F.inter, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#808080', margin:0 }}>{c.label}</p>
              <p style={{ fontFamily:F.bungee, fontSize:28, color:'#0a0a0a', margin:'8px 0 0', opacity:loading?0.3:1 }}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e5e5', overflow:'hidden' }}>
        <div style={{ padding:'20px 24px 16px' }}>
          <h2 style={{ fontFamily:F.bungee, fontSize:13, color:'#0a0a0a', letterSpacing:'-0.01em', margin:0 }}>INVOICE HISTORY</h2>
        </div>
        <div style={{ height:1, background:'#f1f0ef' }} />

        {/* Desktop column headers */}
        <div className="inv-table-head">
          {['Invoice #','Project','Amount','Date','Due Date','Status',''].map(col => (
            <span key={col} style={{ fontFamily:F.inter, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#808080' }}>{col}</span>
          ))}
        </div>

        {/* Loading */}
        {loading && [1,2,3].map(i => (
          <div key={i} style={{ height:60, borderTop:'1px solid #f1f0ef', background:i%2===0?'#fff':'#fafafa', opacity:0.4 }} />
        ))}

        {/* Empty */}
        {!loading && invoices.length === 0 && (
          <div style={{ padding:'40px 24px', textAlign:'center' }}>
            <p style={{ fontFamily:F.inter, fontSize:14, color:'#808080', margin:0 }}>No invoices yet.</p>
          </div>
        )}

        {/* Rows */}
        {!loading && invoices.map((inv, i) => {
          const sc     = STATUS_COLOR[inv.status] ?? '#808080';
          const sbg    = STATUS_BG[inv.status]    ?? '#f1f0ef';
          const canPay = inv.status === 'due' || inv.status === 'overdue';

          return (
            <div key={inv.id}>
              {/* Desktop row */}
              <div className="inv-table-row" style={{ background:i%2===0?'#fff':'#fafafa' }}>
                <span style={{ fontFamily:F.inter, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{inv.invoice_number}</span>
                <span style={{ fontFamily:F.inter, fontSize:14, color:'#0a0a0a' }}>{inv.project_name}</span>
                <span style={{ fontFamily:F.inter, fontSize:14, fontWeight:600, color:'#0a0a0a' }}>{fmtCurrency(inv.amount_cents)}</span>
                <span style={{ fontFamily:F.inter, fontSize:13, color:'#808080' }}>{fmtDate(inv.invoice_date)}</span>
                <span style={{ fontFamily:F.inter, fontSize:13, color:'#808080' }}>{fmtDate(inv.due_date)}</span>
                <span style={{ fontFamily:F.inter, fontSize:11, fontWeight:700, color:sc, background:sbg, padding:'3px 8px', borderRadius:999, width:'fit-content' }}>
                  {STATUS_LABEL[inv.status] ?? inv.status}
                </span>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => handleExportPDF(inv)}
                    style={{ fontFamily:F.inter, fontSize:12, fontWeight:700, color:'#808080', background:'#f1f0ef', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
                    PDF
                  </button>
                  {canPay && (
                    <button onClick={() => handlePay(inv.id, inv.amount_cents, `Invoice ${inv.invoice_number} — ${inv.project_name}`)} disabled={payLoading}
                      style={{ fontFamily:F.inter, fontSize:12, fontWeight:700, color:'#fff', background:'#e40586', border:'none', borderRadius:8, padding:'6px 16px', cursor:'pointer', opacity:payLoading?0.6:1 }}>
                      {payLoading ? '…' : 'PAY'}
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile card */}
              <div className="inv-card" style={{ background:i%2===0?'#fff':'#fafafa' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:8 }}>
                  <div>
                    <div style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color:'#0a0a0a' }}>{inv.invoice_number}</div>
                    <div style={{ fontFamily:F.inter, fontSize:13, color:'#808080', marginTop:2 }}>{inv.project_name}</div>
                  </div>
                  <span style={{ fontFamily:F.inter, fontSize:11, fontWeight:700, color:sc, background:sbg, padding:'3px 10px', borderRadius:999, flexShrink:0 }}>
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontFamily:F.bungee, fontSize:22, color:'#0a0a0a' }}>{fmtCurrency(inv.amount_cents)}</div>
                    <div style={{ fontFamily:F.inter, fontSize:12, color:'#bfbfbf', marginTop:2 }}>
                      Issued {fmtDate(inv.invoice_date)} · Due {fmtDate(inv.due_date)}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <button onClick={() => handleExportPDF(inv)}
                      style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color:'#808080', background:'#f1f0ef', border:'none', borderRadius:10, padding:'10px 16px', cursor:'pointer' }}>
                      PDF
                    </button>
                    {canPay && (
                      <button onClick={() => handlePay(inv.id, inv.amount_cents, `Invoice ${inv.invoice_number} — ${inv.project_name}`)} disabled={payLoading}
                        style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color:'#fff', background:'#e40586', border:'none', borderRadius:10, padding:'10px 20px', cursor:'pointer', opacity:payLoading?0.6:1 }}>
                        {payLoading ? '…' : 'PAY NOW'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {payError && (
        <div style={{ background:'#fff0f8', border:'1px solid #e40586', borderRadius:12, padding:'14px 20px', fontFamily:F.inter, fontSize:14, color:'#e40586' }}>
          {payError}
        </div>
      )}

      {/* Due invoice CTA */}
      {!loading && dueInvoice && (
        <div style={{ background:'#0a0a0a', borderRadius:16, borderLeft:'4px solid #e40586', padding:'24px 28px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div>
            <h3 style={{ fontFamily:F.bungee, fontSize:18, color:'#fff', margin:'0 0 4px', letterSpacing:'-0.02em' }}>
              INVOICE {dueInvoice.invoice_number} IS DUE {fmtDate(dueInvoice.due_date).toUpperCase()}
            </h3>
            <p style={{ fontFamily:F.inter, fontSize:14, color:'#bfbfbf', margin:0 }}>
              {fmtCurrency(dueInvoice.amount_cents)} outstanding — pay now to keep your project on track
            </p>
          </div>
          <button
            onClick={() => handlePay(dueInvoice.id, dueInvoice.amount_cents, `Invoice ${dueInvoice.invoice_number} — ${dueInvoice.project_name}`)}
            disabled={payLoading}
            style={{ fontFamily:F.inter, fontSize:14, fontWeight:700, color:'#fff', background:'#e40586', border:'none', borderRadius:10, padding:'12px 24px', cursor:'pointer', flexShrink:0, opacity:payLoading?0.6:1, width:'100%', maxWidth:320 }}>
            {payLoading ? 'Loading…' : `PAY ${fmtCurrency(dueInvoice.amount_cents)} NOW`}
          </button>
        </div>
      )}
    </div>
  );
}
