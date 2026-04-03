'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bungee, Bai_Jamjuree } from 'next/font/google';
import { supabasePortal } from '@/lib/supabasePortal';

const bungee = Bungee({ weight: '400', subsets: ['latin'], variable: '--font-bungee' });
const baiJamjuree = Bai_Jamjuree({ weight: ['400', '600', '700'], subsets: ['latin'], variable: '--font-inter', display: 'swap' });

type Step = 'contact' | 'verify';

/* ─── Error banner ────────────────────────────────────── */
function ErrorBox({ message }: { message: string }) {
  return (
    <p style={{
      fontFamily: 'var(--font-inter)',
      fontSize: 13,
      color: '#c0006a',
      background: '#fff0f8',
      border: '1px solid #f5b8d8',
      borderRadius: 10,
      padding: '10px 14px',
      margin: 0,
    }}>
      {message}
    </p>
  );
}

/* ─── Main page ───────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep]       = useState<Step>('contact');
  const [contact, setContact] = useState('');
  const [code, setCode]       = useState(['', '', '', '', '', '', '', '']);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === 'verify') {
      setTimeout(() => codeRefs.current[0]?.focus(), 80);
    }
  }, [step]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: otpError } = await supabasePortal.auth.signInWithOtp({
      email: contact.trim(),
      options: { shouldCreateUser: false },
    });

    setLoading(false);
    if (otpError) {
      console.error('signInWithOtp error:', otpError);
      const notFound = otpError.message.toLowerCase().includes('not found') ||
                       otpError.message.toLowerCase().includes('signups not allowed') ||
                       otpError.status === 422;
      setError(notFound
        ? "We don't recognise that email. Contact your Thrive team to get set up."
        : `Error: ${otpError.message}`);
      return;
    }
    setStep('verify');
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const otpCode = code.join('');
    const userEmail = contact.trim();

    try {
      const { data, error: verifyError } = await supabasePortal.auth.verifyOtp({
        email: userEmail,
        token: otpCode,
        type: 'email',
      });

      setLoading(false);
      if (verifyError) {
        console.error('OTP verify error:', verifyError);
        setError(`Verify failed: ${verifyError.message}`);
        setCode(['', '', '', '', '', '', '', '']);
        setTimeout(() => codeRefs.current[0]?.focus(), 50);
        return;
      }
      console.log('OTP verify success:', data);
      router.push('/portal/dashboard');
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      console.error('verifyOtp threw:', err);
      setError(`Caught: ${msg}`);
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
    }
  }

  function handleCodeInput(i: number, raw: string) {
    if (raw.length > 1) {
      const digits = raw.replace(/\D/g, '').slice(0, 8).split('');
      const next = [...code];
      digits.forEach((d, idx) => { next[idx] = d; });
      setCode(next);
      codeRefs.current[Math.min(digits.length, 7)]?.focus();
      return;
    }
    const digit = raw.replace(/\D/g, '');
    const next = [...code];
    next[i] = digit;
    setCode(next);
    if (digit && i < 7) codeRefs.current[i + 1]?.focus();
  }

  function handleCodeKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[i] && i > 0) codeRefs.current[i - 1]?.focus();
  }

  const codeComplete = code.every(Boolean);

  /* ── Shared text helpers ── */
  const F = {
    bungee: `var(--font-bungee), 'Bungee', sans-serif` as const,
    inter:  `var(--font-inter), 'Inter', sans-serif`  as const,
  };

  return (
    <>
      {/* Responsive style injected inline — no Tailwind needed for layout */}
      <style>{`
        .portal-login-wrap {
          display: flex;
          flex-direction: row;
          min-height: 100dvh;
          width: 100%;
        }
        .portal-login-left {
          width: 50%;
          flex-shrink: 0;
          background: #0A0A0A;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 52px;
          box-sizing: border-box;
          position: relative;
        }
        .portal-login-right {
          width: 50%;
          flex-shrink: 0;
          background: #F7F5F2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 52px;
          box-sizing: border-box;
        }
        @media (max-width: 767px) {
          .portal-login-wrap  { flex-direction: column; }
          .portal-login-left  { width: 100%; padding: 36px 28px; min-height: 50dvh; }
          .portal-login-left p[style] { left: 28px !important; bottom: 24px !important; }
          .portal-login-right { width: 100%; padding: 36px 28px; }
        }
        .portal-otp-box {
          width: 100%;
          aspect-ratio: 1;
          max-width: 44px;
          border: 2px solid #ccc;
          border-radius: 12px;
          font-family: var(--font-bungee), sans-serif;
          font-size: 24px;
          text-align: center;
          color: #0A0A0A;
          background: #fff;
          outline: none;
          transition: border-color .15s, background .15s;
        }
        .portal-otp-box:focus { border-color: #E50586; }
        .portal-input {
          width: 100%;
          box-sizing: border-box;
          border: 2px solid #0A0A0A;
          border-radius: 10px;
          padding: 13px 16px;
          font-size: 14px;
          font-family: var(--font-inter), sans-serif;
          color: #0A0A0A;
          background: #fff;
          outline: none;
          transition: border-color .15s;
        }
        .portal-input:focus { border-color: #E50586; }
        .portal-input::placeholder { color: #aaa; }
        .portal-btn-primary {
          width: 100%;
          background: #E50586;
          color: #fff;
          font-family: var(--font-bungee), sans-serif;
          font-size: 16px;
          border: none;
          border-radius: 10px;
          padding: 15px 0;
          cursor: pointer;
          transition: opacity .15s;
          letter-spacing: -0.03em;
        }
        .portal-btn-primary:disabled { opacity: 0.45; cursor: default; }
        .portal-btn-primary:not(:disabled):hover { opacity: 0.88; }
      `}</style>

      <div className={`${bungee.variable} ${baiJamjuree.variable} portal-login-wrap`}>

        {/* ══ LEFT — dark brand panel ══════════════════════ */}
        <div className="portal-login-left">

          
          {/* Middle: logo mark + headline */}
          <div>
            {/* <img src="/new-thrive/logo-mark.svg" alt="Thrive Creative Studios" width={40} height={40} style={{ display: 'block' }} /> */}
            <h2 style={{
              fontFamily: F.bungee,
              fontSize: 'clamp(36px, 15vw, 64px)',
              color: '#fff',
              lineHeight: 1.05,
              marginTop: 36,
              marginBottom: 0,
              letterSpacing: '-0.02em',
            }}>
              YOUR CREATIVE<br />WORKSPACE<br />AWAITS.
            </h2>
            <p style={{
              fontFamily: F.inter,
              fontSize: 14,
              color: '#666',
              lineHeight: 1.7,
              marginTop: 20,
              maxWidth: 320,
            }}>
              Track projects, pay invoices, submit requests, and stay in sync with your Thrive team — all in one place.
            </p>
          </div>

          {/* Bottom: copyright + homepage link */}
          <div style={{ position: 'absolute', bottom: 48, left: 52, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a
              href="/"
              style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 600, color: '#E50586', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              ← Return to Homepage
            </a>
            <p style={{ fontFamily: F.inter, fontSize: 12, color: '#444', margin: 0 }}>
              © 2025 Thrive Creative Studios
            </p>
          </div>
        </div>

        {/* ══ RIGHT — form panel ═══════════════════════════ */}
        <div className="portal-login-right">
          <div style={{ width: '100%', maxWidth: 420 }}>

            {/* Logo */}
            <div style={{ marginBottom: 40 }}>
              <img src="/new-thrive/logo.svg" alt="Thrive Creative Studios" height={12} style={{ display: 'block', width: '250px' }} />
            </div>

            {/* Heading */}
            {step === 'contact' ? (
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontFamily: F.bungee, fontSize: 40, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  SIGN IN
                </h1>
                <p style={{ fontFamily: F.inter, fontSize: 14, color: '#888', marginTop: 10, marginBottom: 0 }}>
                  Enter your email and we'll send you a code.
                </p>
              </div>
            ) : (
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontFamily: F.bungee, fontSize: 36, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  CHECK YOUR<br />EMAIL
                </h1>
                <p style={{ fontFamily: F.inter, fontSize: 14, color: '#888', marginTop: 10, marginBottom: 0 }}>
                  We sent an 8-digit code to{' '}
                  <strong style={{ color: '#0A0A0A' }}>{contact}</strong>.
                </p>
              </div>
            )}

            {/* ── Step 1 ── */}
            {step === 'contact' && (
              <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontFamily: F.inter, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0A0A0A' }}>
                    Email address
                  </label>
                  <input
                    className="portal-input"
                    type="email"
                    required
                    autoFocus
                    value={contact}
                    onChange={e => setContact(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {error && <ErrorBox message={error} />}

                <button type="submit" className="portal-btn-primary" disabled={loading || !contact.trim()}>
                  {loading ? 'SENDING…' : 'SEND CODE →'}
                </button>
              </form>
            )}

            {/* ── Step 2 ── */}
            {step === 'verify' && (
              <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* OTP boxes */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { codeRefs.current[i] = el; }}
                      className="portal-otp-box"
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      value={digit}
                      onChange={e => handleCodeInput(i, e.target.value)}
                      onKeyDown={e => handleCodeKey(i, e)}
                      style={{ borderColor: digit ? '#0A0A0A' : '#ccc', background: digit ? '#f5f5f5' : '#fff' }}
                    />
                  ))}
                </div>

                {error && <ErrorBox message={error} />}

                <button type="submit" className="portal-btn-primary" disabled={loading || !codeComplete}>
                  {loading ? 'VERIFYING…' : 'VERIFY & SIGN IN →'}
                </button>

                <p style={{ fontFamily: F.inter, fontSize: 13, color: '#888', textAlign: 'center', margin: 0 }}>
                  Didn't get it?{' '}
                  <button
                    type="button"
                    onClick={() => { setStep('contact'); setCode(['', '', '', '', '', '', '', '']); setError(''); }}
                    style={{ fontFamily: F.inter, fontSize: 13, fontWeight: 700, color: '#E50586', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}
                  >
                    Go back
                  </button>
                </p>
              </form>
            )}

            {/* Footer note */}
            <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #E5E5E5' }}>
              <p style={{ fontFamily: F.inter, fontSize: 12, color: '#aaa', margin: 0, lineHeight: 1.6 }}>
                Don't have an account? Contact us at{' '}
                <a href="mailto:hello@thrivecreativestudios.org" style={{ color: '#888', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  hello@thrivecreativestudios.org
                </a>
              </p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
