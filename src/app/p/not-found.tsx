/**
 * Shown for a bad slug and a bad token alike. The copy is deliberately the
 * same either way — this page must not tell a stranger whether a proposal
 * with that slug exists.
 */
export default function ProposalNotFound() {
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#000',
        color: '#fff',
        fontFamily: 'var(--font-proposal), "Bai Jamjuree", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#fd6100',
          }}
        >
          Thrive Creative Studios
        </p>
        <h1
          style={{
            margin: '0 0 12px',
            fontFamily: 'var(--font-proposal), "Bai Jamjuree", sans-serif',
            fontSize: 'clamp(28px, 7vw, 44px)',
            lineHeight: 0.9,
            textTransform: 'uppercase',
          }}
        >
          Link not valid
        </h1>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6 }}>
          This proposal link is incorrect or is no longer active. Check that you copied the
          whole link, including everything after the question mark — or reply to the email it
          came in and we will send a fresh one.
        </p>
      </div>
    </main>
  );
}
