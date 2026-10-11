'use client';

// Tagged links: the same page, with utm_ tags that tell the dashboard
// exactly which bio link, story, post or email a visit came from.
// Takes a path on this site or a full URL to any site; tags on another
// site show up in that site's own analytics, not here.

import { useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './analytics.module.css';

const SITE = 'https://thrivecreativestudios.org';

const PRESETS: { label: string; source: string; medium: string; campaign: string }[] = [
  { label: 'Instagram bio', source: 'instagram', medium: 'bio', campaign: 'link_in_bio' },
  { label: 'Instagram story', source: 'instagram', medium: 'story', campaign: '' },
  { label: 'LinkedIn post', source: 'linkedin', medium: 'social', campaign: '' },
  { label: 'Email signature', source: 'email', medium: 'email', campaign: 'signature' },
  { label: 'Google Business Profile', source: 'gbp', medium: 'organic', campaign: 'business_profile' },
  { label: 'Newsletter', source: 'newsletter', medium: 'email', campaign: '' },
];

const slug = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// A path, a bare domain or a full URL → a URL, keeping any query and hash.
function toUrl(raw: string): URL | null {
  const v = raw.trim() || '/';
  try {
    if (v.startsWith('/')) return new URL(v, SITE);
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.hostname.includes('.') ? url : null;
  } catch {
    return null;
  }
}

export function LinkBuilder({ pages }: { pages: string[] }) {
  const [page, setPage] = useState('/');
  const [source, setSource] = useState('instagram');
  const [medium, setMedium] = useState('bio');
  const [campaign, setCampaign] = useState('link_in_bio');
  const [copied, setCopied] = useState(false);

  const options = [...new Set(['/', '/contact', '/services', '/portfolio', ...pages])];
  const target = toUrl(page);
  const ours = target?.hostname.replace(/^www\./, '') === new URL(SITE).hostname;
  if (target) {
    for (const [key, value] of [['utm_source', source], ['utm_medium', medium], ['utm_campaign', campaign]]) {
      if (slug(value)) target.searchParams.set(key, slug(value));
      else target.searchParams.delete(key);
    }
  }
  const url = target ? target.toString() : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className={s.presets}>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={`${p.filterChip} ${source === preset.source && medium === preset.medium ? p.filterChipOn : ''}`}
            onClick={() => { setSource(preset.source); setMedium(preset.medium); setCampaign(preset.campaign); }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className={s.builderGrid}>
        <label>
          <span className={s.miniLabel}>Page or any URL</span>
          <input
            className={p.input}
            list="link-builder-pages"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="/work/… or https://example.com"
          />
          <datalist id="link-builder-pages">
            {options.map((o) => <option key={o} value={o} />)}
          </datalist>
        </label>
        <label>
          <span className={s.miniLabel}>Where it is shared</span>
          <input className={p.input} value={source} onChange={(e) => setSource(e.target.value)} placeholder="instagram" />
        </label>
        <label>
          <span className={s.miniLabel}>Type</span>
          <input className={p.input} value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="bio, story, post, email" />
        </label>
        <label>
          <span className={s.miniLabel}>Campaign (optional)</span>
          <input className={p.input} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="spring_branding" />
        </label>
      </div>
      <div className={s.output}>
        <code>{url || 'Enter a page path or a full URL.'}</code>
        <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={copy} disabled={!url}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      {target && (ours ? (
        <p className={s.panelSub} style={{ marginTop: 8 }}>
          Visits from this link show up as <strong>{slug(source) ? source : 'its source'}</strong>
          {slug(campaign) ? <> under the campaign <strong>{slug(campaign)}</strong></> : null} in the tables above.
        </p>
      ) : (
        <p className={s.panelSub} style={{ marginTop: 8 }}>
          This link goes to <strong>{target.hostname}</strong>, so its visits show up in that site’s analytics (Google Analytics, Vercel and the like), not on this page.
        </p>
      ))}
    </div>
  );
}
