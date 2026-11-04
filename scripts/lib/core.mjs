// Shared logic: used by the build (Node), the website (browser) and the worker (Cloudflare).
// Keep it free of Node or DOM imports.

/** Today's date in Amsterdam as YYYY-MM-DD. */
export function todayAmsterdam(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(now);
}

export function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TZ_LABEL = {
  'Europe/Amsterdam': 'Amsterdam time',
  'Europe/Brussels': 'Brussels time',
  'Europe/London': 'UK time',
  'America/New_York': 'US Eastern time',
  'UTC': 'UTC',
};

export function deadlineTimeLabel(dl) {
  if (!dl.time) return 'time not stated — assume start of day';
  return `${dl.time} ${TZ_LABEL[dl.tz] || dl.tz || ''}`.trim();
}

/**
 * Adds computed fields to an opportunity: status, upcoming deadlines, next deadline.
 * status: open | invite-only | rolling | expected | closed
 */
export function enrich(op, today) {
  const upcoming = (op.deadlines || [])
    .filter(d => d.date >= today)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const publicUpcoming = upcoming.filter(d => !d.invite_only);
  let status;
  if (publicUpcoming.length) status = 'open';
  else if (op.rolling) status = 'rolling';
  else if (upcoming.length) status = 'invite-only';
  else if (op.next_round) status = 'expected';
  else status = 'closed';
  return {
    ...op,
    status,
    upcoming,
    next_deadline: publicUpcoming[0] || null,
  };
}

/** Does an opportunity match a feed/page filter? Empty filter lists match everything. */
export function matches(op, { areas = [], stages = [], flags = [] } = {}) {
  if (areas.length && !op.areas.includes('any') && !op.areas.some(a => areas.includes(a))) return false;
  if (stages.length && !op.stages.some(s => stages.includes(s))) return false;
  if (flags.length && !(op.flags || []).some(f => flags.includes(f))) return false;
  return true;
}

/**
 * Eligibility check against the visitor's answers. Never excludes on missing answers.
 * Returns { verdict: 'match' | 'check' | 'unlikely', reasons: [string] }.
 *
 * answers: {
 *   role: 'researcher'|'phd'|'student'|'founder'|'startup'|'sme',
 *   yearsPostPhd: number, age: number, companyAgeYears: number,
 *   gender: 'woman'|'man'|'nonbinary'|'', holds: ['erc-grant', ...], hasCompanyPartner: bool
 * }
 */
export function checkEligibility(op, a = {}) {
  const e = op.eligibility || {};
  const no = [];
  const check = [];
  if (a.role && e.applicants?.length && !e.applicants.includes(a.role)) {
    // A researcher can usually be part of a consortium; a founder can usually become a start-up.
    const soft = (a.role === 'researcher' && e.applicants.includes('consortium')) ||
                 (a.role === 'founder' && e.applicants.includes('startup'));
    (soft ? check : no).push('applicant type');
  }
  const y = e.years_post_phd;
  if (y && Number.isFinite(a.yearsPostPhd)) {
    if (y.min != null && a.yearsPostPhd < y.min) no.push(`at least ${y.min} years after PhD`);
    if (y.max != null && a.yearsPostPhd > y.max) check.push(`up to ${y.max} years after PhD (extensions for leave may apply)`);
  }
  if (e.max_age != null && Number.isFinite(a.age) && a.age > e.max_age) no.push(`age limit ${e.max_age}`);
  if (e.max_company_age_years != null && Number.isFinite(a.companyAgeYears) && a.companyAgeYears > e.max_company_age_years)
    no.push(`company younger than ${e.max_company_age_years} years`);
  if (e.gender === 'women' && a.gender && a.gender !== 'woman') check.push('women-led teams or women applicants');
  for (const r of e.requires || []) {
    if (r === 'invitation') continue;
    if (r === 'company-partner') { if (a.hasCompanyPartner === false) check.push('needs a company partner'); continue; }
    if (['erc-grant', 'nwo-zonmw-grant'].includes(r) && a.holds && !a.holds.includes(r)) no.push(r === 'erc-grant' ? 'requires an ERC grant' : 'requires earlier NWO/ZonMw funding');
  }
  if (no.length) return { verdict: 'unlikely', reasons: no.concat(check) };
  if (check.length) return { verdict: 'check', reasons: check };
  return { verdict: 'match', reasons: [] };
}

// ---------------------------------------------------------------- iCalendar

function esc(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold to 75 octets per RFC 5545 §3.1. */
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (curLen + n > limit) { out.push(cur); cur = ''; curLen = 0; }
    cur += ch; curLen += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = iso => iso.replace(/-/g, '');

function stamp(now) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function alarmLabel(days) {
  if (days % 7 === 0) { const w = days / 7; return `${w} week${w > 1 ? 's' : ''}`; }
  return `${days} day${days > 1 ? 's' : ''}`;
}

function describe(op, dl, pageUrl) {
  const lines = [];
  lines.push(`DEADLINE: ${dl.date}, ${deadlineTimeLabel(dl)}${dl.label ? ` — ${dl.label}` : ''}`);
  lines.push(`Funder: ${op.funder}`);
  if (op.amount) lines.push(`Amount: ${op.amount}`);
  if (op.summary) lines.push('', op.summary.trim());
  if (op.eligibility?.utrecht) lines.push('', `Eligibility for Utrecht: ${op.eligibility.utrecht.trim()}`);
  lines.push('', `Official page (always check here first): ${op.url}`);
  lines.push(`Last verified by Utrecht Holdings: ${op.last_verified}`);
  if (pageUrl) lines.push(`All opportunities: ${pageUrl}`);
  return lines.join('\n');
}

/**
 * Build a VCALENDAR string.
 * events: [{ op, dl }]
 * opts: { name, description, reminderDays: [42,7], reminderEntries: bool,
 *         rollingCheckins: [{date, ops}], pageUrl, now, refreshHours }
 */
export function buildICS(events, opts = {}) {
  const now = opts.now || new Date();
  const ds = stamp(now);
  const reminderDays = opts.reminderDays ?? [42, 7];
  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Utrecht Holdings//Funding & Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  if (opts.name) L.push(`X-WR-CALNAME:${esc(opts.name)}`);
  if (opts.description) L.push(`X-WR-CALDESC:${esc(opts.description)}`);
  L.push('X-WR-TIMEZONE:Europe/Amsterdam');
  if (opts.refreshHours) {
    L.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshHours}H`);
    L.push(`X-PUBLISHED-TTL:PT${opts.refreshHours}H`);
  }
  const today = todayAmsterdam(now);

  for (const { op, dl } of events) {
    const uidBase = `${op.id}-${ymd(dl.date)}${dl.key ? '-' + dl.key : ''}`;
    const time = dl.time ? ` ${dl.time}` : '';
    const summary = `⏳ Deadline${time}: ${op.title}${dl.label ? ` (${dl.label})` : ''}`;
    const desc = describe(op, dl, opts.pageUrl);
    L.push('BEGIN:VEVENT',
      `UID:${uidBase}@funding-deadlines.utrechtholdings`,
      `DTSTAMP:${ds}`,
      `DTSTART;VALUE=DATE:${ymd(dl.date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(dl.date, 1))}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(desc)}`,
      `URL:${esc(op.url)}`,
      `CATEGORIES:${['Funding deadline', ...op.stages].map(esc).join(',')}`,
      'TRANSP:TRANSPARENT');
    for (const d of reminderDays) {
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY',
        `DESCRIPTION:${esc(`${alarmLabel(d)} to deadline: ${op.title}`)}`,
        `TRIGGER:-P${d}D`, 'END:VALARM');
    }
    L.push('END:VEVENT');

    // Subscribed calendars in Google and Outlook drop VALARMs, so feeds can carry the
    // reminders as entries of their own.
    if (opts.reminderEntries) {
      for (const d of reminderDays) {
        const day = addDays(dl.date, -d);
        if (day < today) continue;
        L.push('BEGIN:VEVENT',
          `UID:${uidBase}-r${d}@funding-deadlines.utrechtholdings`,
          `DTSTAMP:${ds}`,
          `DTSTART;VALUE=DATE:${ymd(day)}`,
          `DTEND;VALUE=DATE:${ymd(addDays(day, 1))}`,
          `SUMMARY:${esc(`⏰ ${alarmLabel(d)} to deadline: ${op.title}`)}`,
          `DESCRIPTION:${esc(desc)}`,
          `URL:${esc(op.url)}`,
          'CATEGORIES:Funding reminder',
          'TRANSP:TRANSPARENT',
          'END:VEVENT');
      }
    }
  }

  for (const c of opts.rollingCheckins || []) {
    if (!c.ops.length) continue;
    const body = ['Funding you can apply for at any time, matching this calendar:', '',
      ...c.ops.map(o => `• ${o.title} (${o.funder}) — ${o.url}`),
      '', opts.pageUrl ? `Full list: ${opts.pageUrl}` : ''].join('\n');
    L.push('BEGIN:VEVENT',
      `UID:rolling-${ymd(c.date)}-${c.key || 'all'}@funding-deadlines.utrechtholdings`,
      `DTSTAMP:${ds}`,
      `DTSTART;VALUE=DATE:${ymd(c.date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(c.date, 1))}`,
      `SUMMARY:${esc(`🔁 Rolling funding check-in (${c.ops.length} open year-round)`)}`,
      `DESCRIPTION:${esc(body)}`,
      'CATEGORIES:Rolling funding',
      'TRANSP:TRANSPARENT',
      'END:VEVENT');
  }

  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

/** Deadline events (public, upcoming) for a list of enriched opportunities. */
export function deadlineEvents(ops) {
  const out = [];
  for (const op of ops) for (const dl of op.upcoming || []) if (!dl.invite_only) out.push({ op, dl });
  return out.sort((a, b) => a.dl.date.localeCompare(b.dl.date));
}

/** First working day of each given month over the next 12 months. */
export function rollingCheckinDates(today, months = [1, 4, 7, 10]) {
  const out = [];
  const [y] = today.split('-').map(Number);
  for (const year of [y, y + 1]) for (const m of months) {
    const d = new Date(Date.UTC(year, m - 1, 1, 12));
    // Skip weekends and New Year's Day.
    while ([0, 6].includes(d.getUTCDay()) || (d.getUTCMonth() === 0 && d.getUTCDate() === 1)) d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    if (iso >= today && iso <= addDays(today, 366)) out.push(iso);
  }
  return out;
}

/** Links that add a subscription URL to common calendar apps. */
export function subscribeLinks(httpsUrl, name) {
  const webcal = httpsUrl.replace(/^https?:/, 'webcal:');
  return {
    https: httpsUrl,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(name)}`,
    outlookcom: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(name)}`,
  };
}

/** Path of the static preset feed for one area (or 'all') and one stage (or 'all'). */
export function presetFeedPath(area = 'all', stage = 'all', reminders = true) {
  return `feeds/${area}/${stage}${reminders ? '' : '-no-reminders'}.ics`;
}
