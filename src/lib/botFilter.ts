// Which recorded visits were bots. /api/track already drops anything whose
// user agent says it's a bot; this catches the ones that pretend to be a
// browser, so the admin reports count only real people.
//
// Judged per session, in this order:
//   1. A session that sent an inquiry or booked a call is a person.
//   2. A session from a data-center town is a bot (Google, Microsoft, Meta
//      and Amazon run their crawlers and ad checkers from these).
//   3. Since migration 035 the tracker records whether anyone scrolled,
//      tapped, clicked or typed: yes → person, no → bot.
//   4. Older views (interacted is null): one page with under a second on
//      it is a bot.

export interface BotCheckView {
  session_id: string;
  city: string | null;
  engaged_ms: number | null;
  interacted?: boolean | null;
}

/** US towns that are mostly server farms. Lower case. Towns that share a
 * name with a real city (Quincy, Altoona) are left out on purpose. */
const DATA_CENTER_TOWNS = new Set([
  'council bluffs', // Google
  'the dalles', // Google
  'lenoir', // Google
  'moncks corner', // Google
  'pryor', // Google
  'boydton', // Microsoft
  'prineville', // Meta
  'forest city', // Meta
  'ashburn', // Amazon and most of the industry
  'dulles town center',
  'boardman', // Amazon
]);

const MIN_ENGAGED_MS = 1_000;

export function isDataCenterTown(city: string | null) {
  return city ? DATA_CENTER_TOWNS.has(city.trim().toLowerCase()) : false;
}

/** Session ids that look like bots. `people` are sessions known to be real. */
export function botSessions(views: BotCheckView[], people: Set<string> = new Set()): Set<string> {
  const bySession = new Map<string, BotCheckView[]>();
  for (const v of views) {
    const list = bySession.get(v.session_id);
    if (list) list.push(v);
    else bySession.set(v.session_id, [v]);
  }

  const bots = new Set<string>();
  for (const [sid, list] of bySession) {
    if (people.has(sid)) continue;
    if (list.some((v) => isDataCenterTown(v.city))) { bots.add(sid); continue; }
    if (list.some((v) => v.interacted === true)) continue;
    if (list.some((v) => v.interacted === false)) { bots.add(sid); continue; }
    const engaged = list.reduce((sum, v) => sum + (v.engaged_ms ?? 0), 0);
    if (list.length === 1 && engaged < MIN_ENGAGED_MS) bots.add(sid);
  }
  return bots;
}

/** Views with the bots' sessions taken out, and how many sessions went. */
export function withoutBots<T extends BotCheckView>(views: T[], people?: Set<string>) {
  const bots = botSessions(views, people);
  return { views: bots.size ? views.filter((v) => !bots.has(v.session_id)) : views, botVisits: bots.size };
}
