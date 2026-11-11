'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabasePortal } from '@/lib/supabasePortal';
import { dueNow, remainingCents } from '@/lib/invoiceDeposit';
import { portalApi } from '@/lib/portalApi';
import { portalTrack } from '@/lib/portalTrack';

interface DbInvoice {
  id: string; invoice_number: string; project_name: string;
  amount_cents: number; invoice_date: string; due_date: string; status: string;
  deposit_cents?: number | null; deposit_due_date?: string | null; deposit_paid_at?: string | null; balance_open?: boolean | null;
  /** Accepted or declined here (migration 058). */
  accepted_at?: string | null; declined_at?: string | null; decline_reason?: string | null;
}

/** Nothing paid on it and not answered yet: they can accept or decline it. */
const canDecide = (inv: DbInvoice) => inv.status !== 'paid' && !inv.deposit_paid_at && !inv.accepted_at && !inv.declined_at;

const F = {
  bungee: `var(--font-bungee), sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

function fmtCurrency(c: number) {
  return (c/100).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits: c % 100 ? 2 : 0});
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
// With a deposit (migration 048) the part due now has its own amount and date;
// once the deposit is paid the balance waits ("held") until Thrive opens it.
function effectiveStatus(inv: DbInvoice): string {
  const due = dueNow(inv);
  if (due.kind === 'paid') return 'paid';
  if (due.kind === 'held') return 'held';
  if (due.kind === 'declined') return 'declined';
  if (due.dueDate && due.dueDate < new Date().toISOString().slice(0, 10)) return 'overdue';
  return 'due';
}
/** What the Pay button pays right now. */
function payNow(inv: DbInvoice): { cents: number; label: string; date: string } | null {
  const due = dueNow(inv);
  if (due.kind !== 'pay') return null;
  return { cents: due.cents, label: due.part === 'deposit' ? 'deposit' : due.part === 'balance' ? 'balance' : '', date: due.dueDate ?? inv.due_date };
}
function statusLabel(inv: DbInvoice): string {
  const es = effectiveStatus(inv);
  const part = payNow(inv)?.label;
  if (es === 'held') return 'Deposit paid';
  if (part && es !== 'paid') return `${part[0].toUpperCase()}${part.slice(1)} ${es === 'overdue' ? 'overdue' : 'due'}`;
  return STATUS_LABEL[es] ?? es;
}
/** The line under the amount: what's due when, or that the rest comes later. */
function depositNote(inv: DbInvoice): string | null {
  if (!inv.deposit_cents || inv.status === 'paid') return null;
  const due = dueNow(inv);
  if (due.kind === 'pay' && due.part === 'deposit') return `Deposit ${fmtCurrency(due.cents)} due ${fmtDate(due.dueDate ?? inv.due_date)} · the rest later`;
  if (due.kind === 'held') return `Deposit received · ${fmtCurrency(due.cents)} balance, we’ll let you know when it’s ready`;
  if (due.kind === 'pay' && due.part === 'balance') return `Deposit received · ${fmtCurrency(due.cents)} balance due ${fmtDate(due.dueDate ?? inv.due_date)}`;
  return null;
}
// Solid brand colours with contrasting text (no pastels).
const STATUS_COLOR: Record<string,string> = { due:'#141414', paid:'#141414', overdue:'#fff', held:'#fff', declined:'#fff' };
const STATUS_BG:    Record<string,string> = { due:'#fd6100', paid:'#0cf574', overdue:'#e50586', held:'#141414', declined:'#141414' };
const STATUS_LABEL: Record<string,string> = { due:'Due', paid:'Paid', overdue:'Overdue', held:'Deposit paid', declined:'Declined' };

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const justPaid     = searchParams.get('paid') === 'true';
  const sessionId    = searchParams.get('session_id');

  const [invoices,    setInvoices]    = useState<DbInvoice[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [dueInvoice,  setDueInvoice]  = useState<DbInvoice | null>(null);
  const [payLoading,  setPayLoading]  = useState(false);
  const [payError,    setPayError]    = useState('');
  const [confirming,  setConfirming]  = useState(false);
  const [statCards,   setStatCards]   = useState<{label:string;value:string;color:string}[]>([]);
  const [filter,      setFilter]      = useState<'all'|'due'|'paid'|'overdue'>('all');
  // Accepting or declining an invoice (migration 058).
  const [deciding,    setDeciding]    = useState<{ inv: DbInvoice; mode: 'accept' | 'decline' } | null>(null);
  const [reason,      setReason]      = useState('');
  const [decideBusy,  setDecideBusy]  = useState(false);
  const [decideError, setDecideError] = useState('');
  const [decidedNote, setDecidedNote] = useState('');

  const loadInvoices = useCallback(async () => {
    const { data: { user } } = await supabasePortal.auth.getUser();
    if (!user) return;
    const { data } = await supabasePortal.from('portal_invoices').select('*').eq('client_id', user.id).order('invoice_date', { ascending: false });
    const rows: DbInvoice[] = data ?? [];
    setInvoices(rows);
    // Paid so far (paid deposits too), what's payable now, and what's late.
    const totalPaid   = rows.reduce((s,i)=>s+(i.amount_cents-remainingCents(i)),0);
    const outstanding = rows.filter(i=>effectiveStatus(i)==='due').reduce((s,i)=>s+(payNow(i)?.cents ?? 0),0);
    const overdue     = rows.filter(i=>effectiveStatus(i)==='overdue').reduce((s,i)=>s+(payNow(i)?.cents ?? 0),0);
    const nextDue     = rows.filter(i=>effectiveStatus(i)==='due').sort((a,b)=>(payNow(a)?.date ?? '').localeCompare(payNow(b)?.date ?? ''))[0];
    setStatCards([
      { label:'Total Paid',  value:fmtCurrency(totalPaid),   color:'#0cf574' },
      { label:'Outstanding', value:fmtCurrency(outstanding), color:'#fd6100' },
      { label:'Overdue',     value:fmtCurrency(overdue),     color:'#e50586' },
      { label:'Next Due',    value:nextDue ? fmtDate(payNow(nextDue)?.date ?? nextDue.due_date) : '—', color:'#3943b7' },
    ]);
    setDueInvoice(nextDue ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  useEffect(() => {
    if (!justPaid || !sessionId) return;
    let cancelled = false;
    (async () => {
      setConfirming(true);
      try {
        await fetch('/api/portal/stripe/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch { /* ignore — webhook is a fallback */ }
      if (!cancelled) {
        await loadInvoices();
        setConfirming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [justPaid, sessionId, loadInvoices]);

  async function handleExportPDF(inv: DbInvoice) {
    void portalTrack('action', { label: `Downloaded invoice ${inv.invoice_number} (PDF)` });
    const { generateInvoicePDF } = await import('@/lib/invoicePDF');
    await generateInvoicePDF(inv);
  }

  async function decide() {
    if (!deciding) return;
    setDecideBusy(true); setDecideError('');
    try {
      void portalTrack('action', { label: `${deciding.mode === 'accept' ? 'Accepted' : 'Declined'} invoice ${deciding.inv.invoice_number}` });
      await portalApi(`/api/portal/invoices/${deciding.inv.id}`, { body: deciding.mode === 'accept' ? { action: 'accept' } : { action: 'decline', reason: reason.trim() } });
      setDecidedNote(deciding.mode === 'accept'
        ? `Thanks! Invoice ${deciding.inv.invoice_number} is accepted. You can pay it whenever you’re ready.`
        : `Thanks for letting us know. Lauren has your note about invoice ${deciding.inv.invoice_number} and will be in touch.`);
      setDeciding(null); setReason('');
      await loadInvoices();
    } catch (e) {
      setDecideError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
    setDecideBusy(false);
  }

  /** Accept / Decline buttons, or what they chose. */
  function decideButtons(inv: DbInvoice, big = false) {
    const pad = big ? '10px 16px' : '6px 12px';
    if (inv.declined_at) return <span style={{ fontFamily:F.inter, fontSize:12, color:'#808080' }}>You declined this</span>;
    if (!canDecide(inv)) return null;
    return (<>
      <button onClick={() => { setDecideError(''); setDeciding({ inv, mode: 'decline' }); }}
        style={{ fontFamily:F.inter, fontSize:big?13:12, fontWeight:700, color:'#0a0a0a', background:'#fff', border:'1.5px solid #d4d4d4', borderRadius:big?10:8, padding:pad, cursor:'pointer' }}>
        Decline
      </button>
      <button onClick={() => { setDecideError(''); setDeciding({ inv, mode: 'accept' }); }}
        style={{ fontFamily:F.inter, fontSize:big?13:12, fontWeight:700, color:'#0a0a0a', background:'#0cf574', border:'none', borderRadius:big?10:8, padding:pad, cursor:'pointer' }}>
        Accept
      </button>
    </>);
  }

  async function handlePay(invoiceId: string, amountCents: number, description: string) {
    void portalTrack('action', { label: `Started paying: ${description}` });
    setPayLoading(true); setPayError('');
    try {
      const { data: { session } } = await supabasePortal.auth.getSession();
      if (!session) { setPayError('Please sign in again.'); return; }
      const res  = await fetch('/api/portal/stripe', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`}, body:JSON.stringify({ invoiceId }) });
      const data = await res.json() as { url?:string; error?:string };
      if (!res.ok || !data.url) { setPayError(data.error ?? 'Failed to initiate payment.'); return; }
      window.location.href = data.url;
    } catch { setPayError('An unexpected error occurred.'); }
    finally  { setPayLoading(false); }
  }

  const displayStats = statCards.length > 0 ? statCards : [
    {label:'Total Paid',value:'—',color:'#0cf574'},
    {label:'Outstanding',value:'—',color:'#fd6100'},
    {label:'Overdue',value:'—',color:'#e50586'},
    {label:'Next Due',value:'—',color:'#3943b7'},
  ];

  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:24, background:'#ffffff', minHeight:'100%' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
        .skel{animation:pulse 1.5s ease-in-out infinite;background:#f2f2f2;border-radius:6px;}
        .inv-stats { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
        .inv-table-head { display:grid; grid-template-columns:84px 1fr 90px 80px 80px 110px 250px; gap:12px; padding:10px 24px; background:#fafafa; }
        .inv-table-row  { display:grid; grid-template-columns:84px 1fr 90px 80px 80px 110px 250px; gap:12px; padding:14px 24px; border-top:1px solid #f2f2f2; align-items:center; }
        .inv-card { display:none; }
        @media (min-width:900px) { .inv-stats { grid-template-columns:repeat(4,1fr); } }
        @media (max-width:680px) {
          .inv-table-head { display:none; }
          .inv-table-row  { display:none; }
          .inv-card       { display:block; padding:16px; border-top:1px solid #f2f2f2; }
        }
      `}</style>

      {justPaid && (
        <div style={{ background:'#f5f5f5', border:'1px solid #0cf574', borderRadius:12, padding:'14px 20px', fontFamily:F.inter, fontSize:14, fontWeight:600, color:'#08b957' }}>
          {confirming ? 'Confirming payment…' : 'Payment received — your invoice has been updated.'}
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
        <div style={{ padding:'20px 24px 8px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <h2 style={{ fontFamily:F.bungee, fontSize:18, color:'#0a0a0a', letterSpacing:'0em', margin:0 }}>Invoices &amp; Payments</h2>
          <div role="tablist" aria-label="Filter invoices" style={{ display:'flex', gap:4, background:'#f2f2f2', borderRadius:999, padding:3 }}>
            {([
              { key:'all',     label:'All',      count: invoices.length },
              { key:'due',     label:'Due',      count: invoices.filter(i=>effectiveStatus(i)==='due').length },
              { key:'overdue', label:'Overdue',  count: invoices.filter(i=>effectiveStatus(i)==='overdue').length },
              { key:'paid',    label:'Paid',     count: invoices.filter(i=>effectiveStatus(i)==='paid').length },
            ] as const).map(t => {
              const active = filter === t.key;
              return (
                <button key={t.key} role="tab" aria-selected={active} onClick={() => setFilter(t.key)}
                  style={{ fontFamily:F.inter, fontSize:12, fontWeight:700, border:'none', borderRadius:999, padding:'6px 12px', cursor:'pointer',
                           background: active ? '#fff' : 'transparent',
                           color: active ? '#0a0a0a' : '#808080',
                           boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>
                  {t.label} <span style={{ color: active ? '#bfbfbf' : '#bfbfbf', fontWeight:600 }}>{t.count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ height:1, background:'#f2f2f2' }} />

        {/* Desktop column headers */}
        <div className="inv-table-head">
          {['Invoice #','Project','Amount','Date','Due Date','Status',''].map(col => (
            <span key={col} style={{ fontFamily:F.inter, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#808080' }}>{col}</span>
          ))}
        </div>

        {/* Loading */}
        {loading && [1,2,3].map(i => (
          <div key={i} style={{ height:60, borderTop:'1px solid #f2f2f2', background:i%2===0?'#fff':'#fafafa', opacity:0.4 }} />
        ))}

        {/* Empty */}
        {!loading && invoices.length === 0 && (
          <div style={{ padding:'40px 24px', textAlign:'center' }}>
            <p style={{ fontFamily:F.inter, fontSize:14, color:'#808080', margin:0 }}>No invoices yet.</p>
          </div>
        )}

        {/* Filtered-empty */}
        {!loading && invoices.length > 0 && invoices.filter(i => filter === 'all' || effectiveStatus(i) === filter || (filter === 'due' && effectiveStatus(i) === 'held')).length === 0 && (
          <div style={{ padding:'40px 24px', textAlign:'center' }}>
            <p style={{ fontFamily:F.inter, fontSize:14, color:'#808080', margin:0 }}>No {filter} invoices.</p>
          </div>
        )}

        {/* Rows */}
        {!loading && invoices.filter(i => filter === 'all' || effectiveStatus(i) === filter || (filter === 'due' && effectiveStatus(i) === 'held')).map((inv, i) => {
          const es     = effectiveStatus(inv);
          const sc     = STATUS_COLOR[es] ?? '#808080';
          const sbg    = STATUS_BG[es]    ?? '#f2f2f2';
          const canPay = es === 'due' || es === 'overdue';

          return (
            <div key={inv.id}>
              {/* Desktop row */}
              <div className="inv-table-row" style={{ background:i%2===0?'#fff':'#fafafa' }}>
                <span style={{ fontFamily:F.inter, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>{inv.invoice_number}</span>
                <span style={{ fontFamily:F.inter, fontSize:14, color:'#0a0a0a' }}>{inv.project_name}</span>
                <span style={{ fontFamily:F.inter, fontSize:14, fontWeight:600, color:'#0a0a0a' }}>
                  {fmtCurrency(inv.amount_cents)}
                  {depositNote(inv) && <span style={{ display:'block', fontSize:11, fontWeight:500, color:'#808080', marginTop:2 }}>{depositNote(inv)}</span>}
                  {inv.accepted_at && inv.status !== 'paid' && <span style={{ display:'block', fontSize:11, fontWeight:600, color:'#08b957', marginTop:2 }}>Accepted {fmtDate(inv.accepted_at)}</span>}
                </span>
                <span style={{ fontFamily:F.inter, fontSize:13, color:'#808080' }}>{fmtDate(inv.invoice_date)}</span>
                <span style={{ fontFamily:F.inter, fontSize:13, color:'#808080' }}>{fmtDate(inv.due_date)}</span>
                <span style={{ fontFamily:F.inter, fontSize:11, fontWeight:700, color:sc, background:sbg, padding:'3px 8px', borderRadius:999, width:'fit-content' }}>
                  {statusLabel(inv)}
                </span>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  {decideButtons(inv)}
                  <button onClick={() => handleExportPDF(inv)}
                    style={{ fontFamily:F.inter, fontSize:12, fontWeight:700, color:'#808080', background:'#f2f2f2', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>
                    PDF
                  </button>
                  {canPay && (
                    <button onClick={() => handlePay(inv.id, inv.amount_cents, `Invoice ${inv.invoice_number} — ${inv.project_name}`)} disabled={payLoading}
                      style={{ fontFamily:F.inter, fontSize:12, fontWeight:700, color:'#fff', background:'#e50586', border:'none', borderRadius:8, padding:'6px 16px', cursor:'pointer', opacity:payLoading?0.6:1 }}>
                      {payLoading ? '…' : payNow(inv)?.label ? `Pay ${payNow(inv)!.label}` : 'Pay'}
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
                    {statusLabel(inv)}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontFamily:F.bungee, fontSize:22, color:'#0a0a0a' }}>{fmtCurrency(inv.amount_cents)}</div>
                    <div style={{ fontFamily:F.inter, fontSize:12, color:'#bfbfbf', marginTop:2 }}>
                      {depositNote(inv) ?? `Issued ${fmtDate(inv.invoice_date)} · Due ${fmtDate(inv.due_date)}`}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                    {decideButtons(inv, true)}
                    <button onClick={() => handleExportPDF(inv)}
                      style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color:'#808080', background:'#f2f2f2', border:'none', borderRadius:10, padding:'10px 16px', cursor:'pointer' }}>
                      PDF
                    </button>
                    {canPay && (
                      <button onClick={() => handlePay(inv.id, inv.amount_cents, `Invoice ${inv.invoice_number} — ${inv.project_name}`)} disabled={payLoading}
                        style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color:'#fff', background:'#e50586', border:'none', borderRadius:10, padding:'10px 20px', cursor:'pointer', opacity:payLoading?0.6:1 }}>
                        {payLoading ? '…' : payNow(inv)?.label ? `Pay ${payNow(inv)!.label} ${fmtCurrency(payNow(inv)!.cents)}` : 'Pay now'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {decidedNote && (
        <div role="status" style={{ background:'#f5f5f5', border:'1px solid #0cf574', borderRadius:12, padding:'14px 20px', fontFamily:F.inter, fontSize:14, color:'#0a0a0a' }}>
          {decidedNote}
        </div>
      )}

      {deciding && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget && !decideBusy) setDeciding(null); }}
          style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(10,10,10,0.55)', display:'grid', placeItems:'center', padding:16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="decide-title" style={{ width:'min(440px, 100%)', background:'#fff', borderRadius:18, padding:24, display:'grid', gap:14 }}>
            <h2 id="decide-title" style={{ fontFamily:F.bungee, fontSize:20, margin:0, color:'#0a0a0a' }}>
              {deciding.mode === 'accept' ? `Accept invoice ${deciding.inv.invoice_number}?` : `Decline invoice ${deciding.inv.invoice_number}?`}
            </h2>
            {deciding.mode === 'accept' ? (
              <p style={{ fontFamily:F.inter, fontSize:14, color:'#404040', margin:0 }}>
                You agree to {fmtCurrency(deciding.inv.amount_cents)} for {deciding.inv.project_name}. Lauren is told, and you can pay it whenever you’re ready.
              </p>
            ) : (
              <label style={{ display:'grid', gap:6, fontFamily:F.inter, fontSize:13, fontWeight:600, color:'#0a0a0a' }}>
                What’s not right? Lauren will get back to you.
                <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
                  placeholder="e.g. The amount is different from what we agreed, or this was already paid"
                  style={{ fontFamily:F.inter, fontSize:14, padding:'10px 12px', borderRadius:10, border:'1.5px solid #d4d4d4', resize:'vertical' }} />
              </label>
            )}
            {decideError && <p role="alert" style={{ fontFamily:F.inter, fontSize:13, color:'#e50586', margin:0 }}>{decideError}</p>}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setDeciding(null)} disabled={decideBusy}
                style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color:'#0a0a0a', background:'#f2f2f2', border:'none', borderRadius:10, padding:'10px 16px', cursor:'pointer' }}>Cancel</button>
              <button onClick={decide} disabled={decideBusy || (deciding.mode === 'decline' && !reason.trim())}
                style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color: deciding.mode === 'accept' ? '#0a0a0a' : '#fff', background: deciding.mode === 'accept' ? '#0cf574' : '#e50586', border:'none', borderRadius:10, padding:'10px 18px', cursor:'pointer', opacity: decideBusy || (deciding.mode === 'decline' && !reason.trim()) ? 0.5 : 1 }}>
                {decideBusy ? 'Sending…' : deciding.mode === 'accept' ? 'Accept invoice' : 'Decline invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payError && (
        <div style={{ background:'#f5f5f5', border:'1px solid #e50586', borderRadius:12, padding:'14px 20px', fontFamily:F.inter, fontSize:14, color:'#e50586' }}>
          {payError}
        </div>
      )}

      {/* Due invoice CTA */}
      {!loading && dueInvoice && (
        <div style={{ background:'#0a0a0a', borderRadius:16, borderLeft:'4px solid #e50586', padding:'24px 28px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div>
            <h3 style={{ fontFamily:F.bungee, fontSize:18, color:'#fff', margin:'0 0 4px', letterSpacing:'0em' }}>
              {payNow(dueInvoice)?.label ? `The ${payNow(dueInvoice)!.label} on i` : 'I'}nvoice {dueInvoice.invoice_number} is due {fmtDate(payNow(dueInvoice)?.date ?? dueInvoice.due_date)}
            </h3>
            <p style={{ fontFamily:F.inter, fontSize:14, color:'#bfbfbf', margin:0 }}>
              {fmtCurrency(payNow(dueInvoice)?.cents ?? dueInvoice.amount_cents)} due now — pay now to keep your project on track
            </p>
          </div>
          <button
            onClick={() => handlePay(dueInvoice.id, dueInvoice.amount_cents, `Invoice ${dueInvoice.invoice_number} — ${dueInvoice.project_name}`)}
            disabled={payLoading}
            style={{ fontFamily:F.inter, fontSize:14, fontWeight:700, color:'#fff', background:'#e50586', border:'none', borderRadius:999, padding:'12px 24px', cursor:'pointer', flexShrink:0, opacity:payLoading?0.6:1, width:'100%', maxWidth:320 }}>
            {payLoading ? 'Loading…' : `Pay ${fmtCurrency(payNow(dueInvoice)?.cents ?? dueInvoice.amount_cents)} now`}
          </button>
        </div>
      )}
    </div>
  );
}
