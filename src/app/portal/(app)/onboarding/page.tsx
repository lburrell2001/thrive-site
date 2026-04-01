'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabasePortal } from '@/lib/supabasePortal';

interface DbStep {
  id: string; step_number: number; title: string;
  description: string; completed: boolean;
  action_label: string | null; action_href: string | null;
}

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

export default function OnboardingPage() {
  const [steps,   setSteps]   = useState<DbStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;
      const { data, error: qErr } = await supabasePortal.from('portal_onboarding_steps').select('*').eq('client_id', user.id).order('step_number', { ascending: true });
      if (qErr) { setError(true); setLoading(false); return; }
      setSteps(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount     = steps.length;
  const pct            = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16, background:'#f6f5f4', minHeight:'100%' }}>

      {/* Error */}
      {error && (
        <div style={{ background:'#fff0f8', border:'1px solid #e40586', borderRadius:12, padding:'14px 20px', fontFamily:F.inter, fontSize:14, color:'#e40586' }}>
          Something went wrong loading onboarding steps — please refresh.
        </div>
      )}

      {/* Progress bar */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e5e5', padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontFamily:F.inter, fontSize:14, fontWeight:700, color:'#0a0a0a' }}>
            {loading ? '—' : `${pct}% Complete`}
          </span>
          <span style={{ fontFamily:F.inter, fontSize:12, color:'#808080' }}>
            {loading ? '' : `${completedCount} of ${totalCount} steps done`}
          </span>
        </div>
        <div style={{ height:10, borderRadius:999, background:'#f1f0ef', overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:999, background:'#0cf574', width:`${pct}%`, transition:'width .4s ease' }} />
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && [1,2,3].map(i => (
        <div key={i} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e5e5', height:80, opacity:0.4 }} />
      ))}

      {/* Empty state */}
      {!loading && !error && steps.length === 0 && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e5e5', padding:'56px 40px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:14 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="6" y="8" width="28" height="24" rx="4" stroke="#d0d0d0" strokeWidth="1.5"/><path d="M13 18h14M13 24h8" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="18" r="2" fill="#d0d0d0"/><circle cx="10" cy="24" r="2" fill="#d0d0d0"/></svg>
          <p style={{ fontFamily:F.inter, fontSize:14, color:'#bfbfbf', margin:0 }}>
            Your onboarding steps haven&apos;t been configured yet — your Thrive team will set these up for you.
          </p>
        </div>
      )}

      {/* Steps */}
      {!loading && !error && steps.map(step => (
        <div
          key={step.id}
          style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', overflow: 'hidden',
            borderLeft: step.completed ? '4px solid #0cf574' : '4px solid #e5e5e5',
          }}
        >
          <div style={{ padding:'20px 24px', display:'flex', alignItems:'flex-start', gap:16 }}>

            {/* Circle */}
            <div style={{
              width:36, height:36, borderRadius:'50%', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background: step.completed ? '#0cf574' : 'transparent',
              border: step.completed ? 'none' : '2px solid #ccc',
            }}>
              {step.completed
                ? <span style={{ fontFamily:F.inter, fontWeight:700, fontSize:16, color:'#0a0a0a' }}>✓</span>
                : <span style={{ fontFamily:F.inter, fontWeight:700, fontSize:14, color:'#808080' }}>{step.step_number}</span>
              }
            </div>

            {/* Content */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                <div>
                  <span style={{ fontFamily:F.inter, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color: step.completed ? '#808080' : '#bfbfbf' }}>
                    Step {step.step_number}
                  </span>
                  <h3 style={{ fontFamily:F.inter, fontSize:14, fontWeight:700, color: step.completed ? '#808080' : '#0a0a0a', margin:'3px 0 4px' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontFamily:F.inter, fontSize:13, color: step.completed ? '#bfbfbf' : '#808080', margin:0 }}>
                    {step.description}
                  </p>
                </div>
                <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
                  {step.completed && (
                    <span style={{ fontFamily:F.inter, fontSize:11, fontWeight:700, background:'#0cf57418', color:'#0a7a3a', padding:'4px 12px', borderRadius:999 }}>
                      Completed
                    </span>
                  )}
                  {!step.completed && step.action_label && step.action_href && (
                    <Link href={step.action_href} style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color:'#fff', background:'#e40586', borderRadius:8, padding:'8px 16px', textDecoration:'none' }}>
                      {step.action_label}
                    </Link>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      ))}

      {/* Help banner */}
      <div style={{ background:'#0a0a0a', borderRadius:16, padding:'24px 28px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16, marginTop:8 }}>
        <div>
          <h3 style={{ fontFamily:F.bungee, fontSize:16, color:'#fff', margin:'0 0 4px', letterSpacing:'-0.02em' }}>NEED HELP WITH ONBOARDING?</h3>
          <p style={{ fontFamily:F.inter, fontSize:13, color:'#808080', margin:0 }}>Our team is here to help you get started smoothly.</p>
        </div>
        <Link href="/contact" style={{ fontFamily:F.inter, fontSize:13, fontWeight:700, color:'#0a0a0a', background:'#f6f5f4', borderRadius:8, padding:'10px 20px', textDecoration:'none', flexShrink:0 }}>
          Contact Us
        </Link>
      </div>

    </div>
  );
}
