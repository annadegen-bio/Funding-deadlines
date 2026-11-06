// Builds the website, the subscription feeds and the per-deadline downloads into dist/.
// Run: npm run build   (GitHub Actions runs it on every push and every night)
import { mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ROOT, loadAll } from './lib/load.mjs';
import { validate } from './validate.mjs';
import {
  todayAmsterdam, enrich, matches, buildICS, deadlineEvents, rollingCheckinDates, presetFeedPath,
} from './lib/core.mjs';

const OUT = join(ROOT, 'dist');
const now = new Date();
const today = todayAmsterdam(now);
const data = loadAll();
const { config, taxonomy } = data;

const { errors, warnings } = validate(data, today);
for (const w of warnings) console.warn('warn ', w);
if (errors.length) {
  for (const e of errors) console.error('ERROR', e);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
};

const ops = data.opportunities.map(op => enrich(op, today)).filter(op => op.status !== 'closed');
const pageUrl = config.base_url;
const checkinDates = rollingCheckinDates(today, config.rolling_checkin_months);

function feed(filter, name, reminderEntries) {
  const selected = ops.filter(op => matches(op, filter));
  const rolling = selected.filter(op => op.status === 'rolling');
  return buildICS(deadlineEvents(selected), {
    name,
    description: config.calendar_description,
    reminderDays: config.default_reminders_days,
    reminderEntries,
    rollingCheckins: checkinDates.map(date => ({ date, ops: rolling })),
    pageUrl,
    now,
    refreshHours: 12,
  });
}

// Preset feeds: every area × every stage, with and without reminder entries.
const areas = ['all', ...Object.keys(taxonomy.areas).filter(a => taxonomy.areas[a].feed !== false)];
const stages = ['all', ...Object.keys(taxonomy.stages)];
let feedCount = 0;
for (const area of areas) for (const stage of stages) for (const rem of [true, false]) {
  const filter = { areas: area === 'all' ? [] : [area], stages: stage === 'all' ? [] : [stage] };
  const parts = [area !== 'all' && taxonomy.areas[area].label, stage !== 'all' && taxonomy.stages[stage].label].filter(Boolean);
  const name = config.calendar_name + (parts.length ? ` — ${parts.join(', ')}` : '');
  write(presetFeedPath(area, stage, rem), feed(filter, name, rem));
  feedCount++;
}

// One download per deadline, with real alarms (honoured when a file is imported).
let fileCount = 0;
for (const { op, dl } of deadlineEvents(ops)) {
  write(`ics/${op.id}/${dl.date}.ics`, buildICS([{ op, dl }], {
    name: op.title, reminderDays: config.default_reminders_days, pageUrl, now,
  }));
  fileCount++;
}

// Data for the website and the worker.
write('data/opportunities.json', JSON.stringify({
  generated: now.toISOString(),
  today,
  config: {
    base_url: config.base_url, worker_url: config.worker_url, calendar_name: config.calendar_name, contact_url: config.contact_url, suggest_form_url: config.suggest_form_url,
    default_reminders_days: config.default_reminders_days, rolling_checkin_months: config.rolling_checkin_months,
  },
  taxonomy,
  opportunities: ops,
}, null, 1));

// The website itself, plus the shared library it imports.
cpSync(join(ROOT, 'site'), OUT, { recursive: true });
cpSync(join(ROOT, 'scripts/lib/core.mjs'), join(OUT, 'lib/core.mjs'));
write('.nojekyll', '');

const by = s => ops.filter(o => o.status === s).length;
console.log(`Built ${ops.length} opportunities (${by('open')} with open deadlines, ${by('rolling')} rolling, ` +
  `${by('expected')} expected, ${by('invite-only')} invite-only), ${feedCount} feeds, ${fileCount} deadline files → dist/`);
