'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import s from '../../proposals.module.css';
import t from './tune.module.css';
import { apiGet } from '../../adminApi';
import { Toast, useToast } from '../../Toast';
import {
  ALL_TUNABLES,
  TUNABLE_GROUPS,
  exportCss,
  initialValues,
} from './tunables';
import { ProposalRenderer } from '@/components/proposal/ProposalRenderer';
import { proposalFontClass } from '@/lib/proposalFonts';
import type { Proposal, ProposalBlock, ProposalLineItem } from '@/types/proposal';
import { HEADING_WEIGHTS } from '@/lib/displayMetrics';

/** Letter at 96dpi — the preview is rendered at true print size and scaled. */
const SHEET_WIDTH = 816;
const SHEET_HEIGHT = 1056;

interface LoadResponse {
  proposal: Proposal;
  blocks: ProposalBlock[];
  lineItems: ProposalLineItem[];
  imageUrls: Record<string, string>;
}

interface SheetFit {
  label: string;
  height: number;
}

/**
 * Design-time tuner.
 *
 * The proposal is rendered at true Letter width and scaled to fit, so what
 * you see is what prints. Clicking anything in it selects the group of knobs
 * that governs it; the sliders write CSS custom properties straight onto the
 * live document.
 *
 * Nothing here is saved to a proposal. The output is a block of CSS to paste
 * into styles/proposal-tokens.css once the template is right — then it is
 * locked, and every proposal inherits it.
 */
export default function TunePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast, show } = useToast();

  const [doc, setDoc] = useState<LoadResponse | null>(null);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, number>>(initialValues);
  const [activeGroup, setActiveGroup] = useState<string>('heading');
  const [zoom, setZoom] = useState(0.62);
  const [fits, setFits] = useState<SheetFit[]>([]);
  const [stageHeight, setStageHeight] = useState(0);

  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<LoadResponse>(`/api/proposals/${id}`);
        if (!cancelled) setDoc(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this proposal');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** The live overrides, at higher specificity than the token file. */
  const css = useMemo(() => {
    const lines = ALL_TUNABLES.filter(
      (k) => values[k.variable] !== k.initial && !k.variable.startsWith('--heading-weight'),
    ).map((k) => `  ${k.variable}: ${k.render(values[k.variable])};`);
    return lines.length ? `.tuneStage .thriveProposal {\n${lines.join('\n')}\n}` : '';
  }, [values]);

  /*
   * Weight is handed to the renderer rather than injected as CSS. A heading is
   * sized from its own measured width and that width depends on weight, so if
   * the tuner changed only the CSS the preview would render at the new weight
   * while still being sized for the old one.
   */
  const headingWeights = useMemo(
    () => ({
      line1: values['--heading-weight-1'] ?? HEADING_WEIGHTS.line1,
      line2: values['--heading-weight-2'] ?? HEADING_WEIGHTS.line2,
    }),
    [values],
  );

  /**
   * Measure each page group against a Letter sheet. This is the readout that
   * matters — a group taller than 1056px spills onto a second sheet.
   */
  const measure = useCallback(() => {
    const root = stage.current;
    if (!root) return;
    const sections = [...root.querySelectorAll('section')];
    const out: SheetFit[] = [];
    let top: number | null = null;
    let bottom = 0;
    let label = '';
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const starts = section.className.includes('pageStart');
      if (starts) {
        if (top !== null) out.push({ label, height: Math.round((bottom - top) / zoom) });
        top = rect.top;
        bottom = rect.bottom;
        const l1 = section.querySelector('[class*="headingLine1"]')?.textContent ?? '';
        const l2 = section.querySelector('[class*="headingLine2"]')?.textContent ?? '';
        label = [l1, l2].filter(Boolean).join(' ').trim() || 'Page';
      } else {
        bottom = Math.max(bottom, rect.bottom);
      }
    }
    if (top !== null) out.push({ label, height: Math.round((bottom - top) / zoom) });
    setFits(out);
    setStageHeight(root.scrollHeight * zoom);
  }, [zoom]);

  useEffect(() => {
    const timer = setTimeout(measure, 120);
    return () => clearTimeout(timer);
  }, [measure, values, doc]);

  /** Click anything in the document to jump to the knobs that govern it. */
  function handleStageClick(event: React.MouseEvent) {
    let node = event.target as HTMLElement | null;
    while (node && node !== stage.current) {
      const className = typeof node.className === 'string' ? node.className : '';
      const group = TUNABLE_GROUPS.find((g) => g.matches.some((m) => className.includes(m)));
      if (group) {
        setActiveGroup(group.id);
        return;
      }
      node = node.parentElement;
    }
  }

  async function copyCss() {
    try {
      await navigator.clipboard.writeText(exportCss(values));
      show('CSS copied. Paste it into proposal-tokens.css to lock it in.');
    } catch {
      show('Could not reach the clipboard', 'error');
    }
  }

  if (error) {
    return (
      <div className={s.screen}>
        <div className={s.wrap}>
          <p className={s.empty}>{error}</p>
          <Link href="/admin/proposals" className={s.btn}>
            Back to proposals
          </Link>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className={s.screen}>
        <p className={s.empty}>Loading…</p>
      </div>
    );
  }

  const group = TUNABLE_GROUPS.find((g) => g.id === activeGroup) ?? TUNABLE_GROUPS[0];
  const changed = ALL_TUNABLES.filter((k) => values[k.variable] !== k.initial).length;

  return (
    <div className={t.screen}>
      <div className={t.controls}>
        <div className={t.head}>
          <Link href={`/admin/proposals/${id}/edit`} className={`${s.btn} ${s.btnSmall}`}>
            ← Editor
          </Link>
          <span className={t.changedCount}>
            {changed === 0 ? 'No changes' : `${changed} changed`}
          </span>
        </div>

        <p className={t.intro}>
          Click anything in the document to jump to its controls. Everything here is a
          proportion, so what you set holds on Letter, on a phone, and in the PDF.
        </p>

        <div className={t.tabs}>
          {TUNABLE_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`${t.tab} ${g.id === activeGroup ? t.tabOn : ''}`}
              onClick={() => setActiveGroup(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className={t.sliders}>
          {group.tunables.map((k) => (
            <div key={k.variable} className={t.slider}>
              <div className={t.sliderHead}>
                <label htmlFor={`tune${k.variable}`}>{k.label}</label>
                <span className={t.value}>
                  {(k.format ?? String)(values[k.variable])}
                </span>
              </div>
              <input
                id={`tune${k.variable}`}
                type="range"
                min={k.min}
                max={k.max}
                step={k.step}
                value={values[k.variable]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [k.variable]: Number(e.target.value) }))
                }
              />
              {k.hint && <p className={t.hint}>{k.hint}</p>}
            </div>
          ))}
        </div>

        <div className={t.fits}>
          <div className={t.fitsHead}>Sheet fit — Letter is 1056px</div>
          {fits.map((fit, i) => (
            <div key={i} className={t.fitRow}>
              <span className={t.fitLabel}>{fit.label}</span>
              <span className={fit.height > SHEET_HEIGHT ? t.fitOver : t.fitOk}>
                {fit.height}px
              </span>
            </div>
          ))}
        </div>

        <div className={t.actions}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={copyCss}>
            Copy CSS
          </button>
          <button
            type="button"
            className={s.btn}
            onClick={() => setValues(initialValues())}
            disabled={changed === 0}
          >
            Reset
          </button>
        </div>

        <details className={t.exportBox}>
          <summary>Show CSS</summary>
          <pre>{exportCss(values)}</pre>
        </details>
      </div>

      <div className={t.stageWrap}>
        <div className={t.zoomBar}>
          <label htmlFor="tune-zoom">Zoom</label>
          <input
            id="tune-zoom"
            type="range"
            min={0.3}
            max={1}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <span className={t.value}>{Math.round(zoom * 100)}%</span>
        </div>

        {/* Rendered at true Letter width, then scaled — so the sheet-fit
            numbers above are the real ones, not an approximation. */}
        <div className={t.scroller}>
          <style>{css}</style>
          <div
            className={t.scaler}
            style={{ width: SHEET_WIDTH * zoom, height: stageHeight || undefined }}
            onClick={handleStageClick}
          >
            <div
              ref={stage}
              className={`tuneStage ${t.stage} ${proposalFontClass}`}
              style={{ width: SHEET_WIDTH, transform: `scale(${zoom})` }}
            >
              <ProposalRenderer
                blocks={doc.blocks}
                theme={doc.proposal.theme ?? {}}
                mode="print"
                currency={doc.proposal.currency}
                totalCents={doc.proposal.total_cents}
                lineItems={doc.lineItems}
                imageUrls={doc.imageUrls}
                headerNote={doc.proposal.theme?.headerNote}
                headingWeights={headingWeights}
              />
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
