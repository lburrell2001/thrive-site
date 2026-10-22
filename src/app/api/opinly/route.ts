export const runtime = 'nodejs';

import { Webhook } from 'svix';
import type { OpinlyWebhookEvent } from '@opinly/backend';
import { opinlyConfig } from '@opinly/next';
import { authorPath, categoryPath, postPath, tagPath } from '@opinly/shared';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Opinly's content.routes-changed webhook (sent through Svix, verified with
 * OPINLY_WEBHOOK_SIGNING_SECRET). Two caches go stale when a post is
 * published or edited, and both are cleared:
 *
 *   - the data cache: every Opinly fetch carries the 'opinly' tag, and
 *     { expire: 0 } drops it now (a named profile like 'max' would keep
 *     serving stale posts for up to a year while refreshing behind them);
 *   - the rendered pages that changed, with revalidatePath — on its own that
 *     is a silent no-op for dynamically rendered routes when self-hosted.
 */
export async function POST(request: Request) {
  const secret = process.env.OPINLY_WEBHOOK_SIGNING_SECRET;
  if (!secret) return new Response('Webhook not configured', { status: 503 });

  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (!id || !timestamp || !signature) return new Response('Invalid request', { status: 400 });

  let event: OpinlyWebhookEvent;
  try {
    event = new Webhook(secret).verify(Buffer.from(await request.arrayBuffer()), {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    }) as OpinlyWebhookEvent;
  } catch {
    return new Response('Error verifying webhook', { status: 400 });
  }

  // Opinly also sends the legacy content.paths-invalidated for the same change.
  if (event.type !== 'content.routes-changed') return new Response('ok', { status: 200 });

  revalidateTag('opinly', { expire: 0 });

  const config = opinlyConfig;
  for (const route of event.data.changed) {
    switch (route.type) {
      case 'post':
        revalidatePath(postPath(config, route));
        break;
      case 'category':
        revalidatePath(categoryPath(config, route.slug));
        break;
      case 'author':
        revalidatePath(authorPath(config, route.slug));
        revalidatePath(`${config.blogPrefix}/${config.authorPrefix ?? 'authors'}`);
        break;
      case 'tag':
        revalidatePath(tagPath(config, route.slug));
        break;
      case 'home':
        revalidatePath(config.blogPrefix);
        revalidatePath('/sitemap.xml');
        break;
    }
  }

  return new Response('ok', { status: 200 });
}
