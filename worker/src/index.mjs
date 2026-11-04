// Optional Cloudflare Worker: personal subscription feeds with any combination of filters
// and any reminder times. GitHub Pages can only serve the fixed preset feeds; this
// builds a feed on request from the same data, with the same code.
//
//   GET /feed.ics?areas=life-sciences,medtech&stages=valorisation&flags=atmp&r=56,14,3&entries=1
//
// Deploy: see worker/README.md. Then put the worker URL in data/config.yaml → worker_url.
import { matches, buildICS, deadlineEvents, rollingCheckinDates, todayAmsterdam, enrich } from '../../scripts/lib/core.mjs';

const list = v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : []);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/feed.ics') return new Response('Not found', { status: 404 });

    const base = env.DATA_URL || 'https://annadegen-bio.github.io/Funding-deadlines/data/opportunities.json';
    const res = await fetch(base, { cf: { cacheTtl: 900, cacheEverything: true } });
    if (!res.ok) return new Response('Data unavailable', { status: 502 });
    const data = await res.json();

    const p = url.searchParams;
    const filter = { areas: list(p.get('areas')), stages: list(p.get('stages')), flags: list(p.get('flags')) };
    const types = list(p.get('types'));
    const reminders = list(p.get('r')).map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 365).slice(0, 6);
    const reminderDays = reminders.length ? reminders : data.config.default_reminders_days;
    const today = todayAmsterdam();

    // Re-derive status for today (the JSON may be up to a day old).
    const ops = data.opportunities.map(op => enrich(op, today))
      .filter(op => op.status !== 'closed')
      .filter(op => matches(op, filter))
      .filter(op => !types.length || types.includes(op.funding_type));
    const rolling = ops.filter(op => op.status === 'rolling');

    const parts = [filter.areas.map(a => data.taxonomy.areas[a]?.label).filter(Boolean).join(' + '),
      filter.stages.map(s => data.taxonomy.stages[s]?.label).filter(Boolean).join(' + ')].filter(Boolean);
    const ics = buildICS(deadlineEvents(ops), {
      name: data.config.calendar_name + (parts.length ? ` — ${parts.join(', ')}` : ' — my selection'),
      reminderDays,
      reminderEntries: p.get('entries') !== '0',
      rollingCheckins: rollingCheckinDates(today, data.config.rolling_checkin_months).map(date => ({ date, ops: rolling })),
      pageUrl: data.config.base_url,
      refreshHours: 12,
    });
    return new Response(ics, {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
    });
  },
};
