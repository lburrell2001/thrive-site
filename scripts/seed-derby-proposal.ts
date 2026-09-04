/**
 * Seeds the Dallas Derby Day 2026 reference proposal.
 *
 *   npx tsx scripts/seed-derby-proposal.ts
 *
 * Idempotent: fixed IDs mean re-running replaces the blocks and line items
 * in place rather than creating a second proposal. The access token is
 * generated once and preserved on subsequent runs so a link already sent
 * to a client keeps working.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { parseBlocks } from '../src/lib/proposalSchemas';
import {
  DERBY_BLOCKS,
  DERBY_LINE_ITEMS,
  DERBY_PROPOSAL_ID,
  DERBY_SLUG,
  DERBY_THEME,
  DERBY_UPLOADS,
} from '../src/lib/seeds/derbyProposal';

const ROOT = path.resolve(__dirname, '..');
const BUCKET = 'proposal-media';
const CLIENT_ID = 'd0000000-0000-4000-8000-0000000000a1';

// --------------------------------------------------------------- env

function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local.',
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

// -------------------------------------------------------------- helpers

function newAccessToken() {
  return randomBytes(24).toString('base64url').slice(0, 32);
}

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function uploadAssets() {
  let uploaded = 0;
  let missing = 0;

  for (const asset of DERBY_UPLOADS) {
    const abs = path.join(ROOT, asset.localPath);
    if (!existsSync(abs)) {
      console.warn(`  ! missing local file, skipped: ${asset.localPath}`);
      missing += 1;
      continue;
    }

    const body = await readFile(abs);
    const { error } = await db.storage.from(BUCKET).upload(asset.storagePath, body, {
      contentType: CONTENT_TYPES[path.extname(abs).toLowerCase()] ?? 'application/octet-stream',
      upsert: true,
    });

    if (error) throw new Error(`Upload failed for ${asset.storagePath}: ${error.message}`);
    uploaded += 1;
  }

  console.log(`  uploaded ${uploaded} asset(s)${missing ? `, ${missing} missing` : ''}`);
}

// ----------------------------------------------------------------- run

async function main() {
  // Validate before touching the database. A malformed block should fail the
  // seed, not land in a client-facing proposal.
  // Positions are taken from array order, so inserting a block in the middle
  // of DERBY_BLOCKS cannot leave the literals out of step with each other.
  const blocks = parseBlocks(DERBY_BLOCKS.map((block, index) => ({ ...block, position: index })));
  console.log(`Validated ${blocks.length} blocks.`);

  const { error: clientError } = await db.from('proposal_clients').upsert(
    {
      id: CLIENT_ID,
      name: 'Shiattin Makor',
      company: 'Dallas Derby Day',
      email: 'shiattin@dallasderbyday.com',
      phone: '214-293-8800',
    },
    { onConflict: 'id' },
  );
  if (clientError) throw new Error(`proposal_clients: ${clientError.message}`);

  // Preserve an already-issued token so a link in a client's inbox keeps working.
  const { data: existing } = await db
    .from('proposals')
    .select('access_token')
    .eq('id', DERBY_PROPOSAL_ID)
    .maybeSingle();

  const accessToken = existing?.access_token ?? newAccessToken();

  const { error: proposalError } = await db.from('proposals').upsert(
    {
      id: DERBY_PROPOSAL_ID,
      slug: DERBY_SLUG,
      access_token: accessToken,
      title: 'Dallas Derby Day — Event Marketing & Promotion',
      client_id: CLIENT_ID,
      status: 'draft',
      proposal_date: '2026-04-21',
      valid_until: '2026-05-02',
      currency: 'USD',
      deposit_percent: 50,
      theme: DERBY_THEME,
    },
    { onConflict: 'id' },
  );
  if (proposalError) throw new Error(`proposals: ${proposalError.message}`);

  // Replace children wholesale — simpler and safer than diffing positions
  // against the deferred unique(proposal_id, position) constraint.
  await db.from('proposal_blocks').delete().eq('proposal_id', DERBY_PROPOSAL_ID);
  await db.from('proposal_line_items').delete().eq('proposal_id', DERBY_PROPOSAL_ID);

  const { error: blockError } = await db.from('proposal_blocks').insert(
    blocks.map((block) => ({
      id: block.id,
      proposal_id: DERBY_PROPOSAL_ID,
      type: block.type,
      position: block.position,
      visible: block.visible,
      accent: block.accent ?? null,
      content: block.content,
    })),
  );
  if (blockError) throw new Error(`proposal_blocks: ${blockError.message}`);

  const { error: itemError } = await db.from('proposal_line_items').insert(
    DERBY_LINE_ITEMS.map((item) => ({ ...item, proposal_id: DERBY_PROPOSAL_ID })),
  );
  if (itemError) throw new Error(`proposal_line_items: ${itemError.message}`);

  console.log('Uploading assets…');
  await uploadAssets();

  // total_cents is set by the trigger on proposal_line_items, never by us.
  const { data: final } = await db
    .from('proposals')
    .select('total_cents, deposit_percent')
    .eq('id', DERBY_PROPOSAL_ID)
    .single();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  console.log('\nSeeded Dallas Derby Day 2026.');
  console.log(`  total   $${((final?.total_cents ?? 0) / 100).toLocaleString('en-US')}`);
  console.log(
    `  deposit $${(((final?.total_cents ?? 0) * (final?.deposit_percent ?? 0)) / 10000).toLocaleString('en-US')} (${final?.deposit_percent}%)`,
  );
  console.log(`  view    ${site}/p/${DERBY_SLUG}?t=${accessToken}`);
}

main().catch((error) => {
  console.error('\nSeed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
