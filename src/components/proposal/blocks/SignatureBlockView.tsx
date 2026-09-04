import styles from '../proposal.module.css';
import { Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { SignatureBlock } from '@/types/proposal';

/**
 * Who prepared it on the left, and a white field for the client to sign on
 * the right. The field is deliberately blank on the page — approval happens
 * in the browser, and this is what a printed copy is signed on.
 */
export function SignatureBlockView({ block, ctx, startsPage }: BlockProps<SignatureBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="signature">
      <div className={styles.signatureGrid}>
        <div>
          <p className={styles.signatureName}>{ctx.agencyName}</p>
          <p className={styles.signatureMeta}>
            {[c.agencySignerName, c.agencySignerTitle].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className={styles.signatureField}>
          <span className={styles.signatureLabel}>{c.clientSignerLabel}</span>
          <div className={styles.signatureBox} />
          <p className={styles.signatureMeta}>Signature · Date</p>
        </div>
      </div>

      {c.termsUrl && (
        <p className={styles.signatureTerms}>
          Approval is subject to the{' '}
          <a href={c.termsUrl} rel="noopener noreferrer">
            terms of engagement
          </a>
          .
        </p>
      )}
    </Page>
  );
}
