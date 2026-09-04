// PDF generation.
//
// There is one renderer in this system, so the PDF is produced by loading the
// real /p/[slug]/print page in headless Chrome and printing it. No second
// layout engine, no duplicated block components — what the client reads and
// what they download are the same code path.

import 'server-only';
import type { Browser } from 'puppeteer-core';

/**
 * Chrome differs by environment:
 *
 *  - On Vercel there is no browser, so @sparticuz/chromium ships one built
 *    for the Lambda filesystem.
 *  - Locally that binary is Linux-only and will not run, so we point at the
 *    Chrome the developer already has installed.
 *
 * PUPPETEER_EXECUTABLE_PATH overrides both, which is what CI would set.
 */
const LOCAL_CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

async function localChromePath(): Promise<string | null> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const { existsSync } = await import('node:fs');
  return LOCAL_CHROME_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

async function launch(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default;
  const local = await localChromePath();

  if (local) {
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    });
  }

  // Serverless. The import is dynamic so local development never has to load
  // a 50 MB Linux binary it cannot execute.
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    args: [...chromium.args, '--font-render-hinting=none'],
    defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 2 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export interface PdfOptions {
  /** Absolute URL of the print page, including the access token. */
  url: string;
  /** Cookies or headers are not needed — the token in the URL is the gate. */
  timeoutMs?: number;
}

/**
 * Render the print page to a Letter-size PDF.
 *
 * `@page { size: Letter; margin: 0 }` lives in the print stylesheet, so this
 * passes `preferCSSPageSize` and lets the document decide its own geometry
 * rather than imposing a second, conflicting page size here.
 */
export async function renderProposalPdf({ url, timeoutMs = 45_000 }: PdfOptions): Promise<Buffer> {
  const browser = await launch();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });

    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: timeoutMs });
    if (!response || !response.ok()) {
      throw new Error(`Print page returned ${response?.status() ?? 'no response'}`);
    }

    // Archivo Black sets the display headings, and the oversized second line
    // is clipped by overflow:hidden at whatever width it actually renders.
    // Capturing before the face swaps in would crop it somewhere else.
    await page.evaluateHandle('document.fonts.ready');

    // Signed image URLs are fetched by the page; networkidle0 covers them,
    // but give lazily-decoded images a beat to paint.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );

    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      // The document is black with colour accents. Without backgrounds it is
      // not the same document.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      timeout: timeoutMs,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Filename-safe version of a proposal title. */
export function pdfFilename(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'proposal';
  return `${base}.pdf`;
}
