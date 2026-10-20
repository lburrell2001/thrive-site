import styles from '../proposal.module.css';
import { Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { SignatureBlock } from '@/types/proposal';

/**
 * A coloured panel: who prepared it on the left, and a white field for the
 * client to sign on the right. Straight after the pricing block it joins the
 * total as one panel, as on the printed proposals. The field is deliberately
 * blank on the page — approval happens in the browser, and this is what a
 * printed copy is signed on.
 */
export function SignatureBlockView({ block, ctx, startsPage }: BlockProps<SignatureBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;
  const agencyMeta = [c.agencySignerName, c.agencySignerTitle, ctx.headerNote]
    .filter(Boolean)
    .join(' · ');

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="signature">
      <div className={styles.signaturePanel}>
        <div className={styles.signatureGrid}>
          <div>
            <p className={styles.signatureName}>{ctx.agencyName}</p>
            <p className={styles.signatureMeta}>{agencyMeta}</p>
          </div>

          <div className={styles.signatureField}>
            <div className={styles.signatureBox} />
            <div className={styles.signatureFieldLabels}>
              <span className={styles.signatureLabel}>{c.clientSignerLabel}</span>
              <span>{ctx.clientName ? `${ctx.clientName} | Date` : 'Signature | Date'}</span>
            </div>
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
      </div>
    </Page>
  );
}
