// Utrecht Funding & Deadlines — website. Works standalone (index.html) and embedded in
// WordPress (see wordpress/funding-block.html). Mounts into #uh-funding.
// Visual language follows the Science-to-Impact events calendar embed: same tokens,
// chips, timeline and expandable cards. Nothing the visitor enters leaves the browser.
import {
  matches, checkEligibility, buildICS, deadlineEvents, subscribeLinks, presetFeedPath,
  deadlineTimeLabel, rollingCheckinDates, todayAmsterdam,
} from './lib/core.mjs';

const BASE = new URL('./', import.meta.url).href;
const STORE = 'uh-funding-v1';
const root = document.getElementById('uh-funding');

const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const save = s => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* private mode */ } };

const saved = load();
const state = {
  areas: saved.areas || [], stages: saved.stages || [], flags: saved.flags || [],
  types: saved.types || [], q: '',
  answers: saved.answers || {}, hideUnlikely: saved.hideUnlikely ?? false,
  reminderEntries: saved.reminderEntries ?? true,
  reminders: saved.reminders || null,
  remember: saved.remember ?? false,
  view: saved.view || 'compact',
};
const expanded = new Set();

let DATA;
const h = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = iso => new Date(iso + 'T12:00:00Z');
const fmtDate = iso => D(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const daysUntil = iso => Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(DATA.today + 'T12:00:00Z')) / 864e5);

// ---------------------------------------------------------------- colour helpers
// Same method as the events calendar: tint the brand colour for a background, then
// darken the hue until text on that tint clears 4.5:1.
const hexToRgb = hex => { const x = hex.replace('#', ''); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)); };
const toWhite = (rgb, a) => rgb.map(c => Math.round(c + (255 - c) * a));
const darken = (rgb, a) => rgb.map(c => Math.round(c * (1 - a)));
const css = rgb => `rgb(${rgb.join(',')})`;
const lum = rgb => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
function palette(hex) {
  const base = hexToRgb(hex);
  const bg = toWhite(base, 0.85);
  let fg = base;
  for (let a = 0.15; a <= 0.9; a += 0.05) { fg = darken(base, a); if (contrast(lum(fg), lum(bg)) >= 4.5) break; }
  return { color: hex, bg: css(bg), fg: css(fg) };
}
const NEUTRAL = '#6D6E71';
let STAGE = {};
const stageOf = op => STAGE[op.stages[0]] || palette(NEUTRAL);

init().catch(err => {
  root.innerHTML = `<p class="uhf-error">Couldn't load the funding overview right now (${h(err.message)}). Please refresh, or check back shortly.</p>`;
});

async function init() {
  root.classList.add('uhf');
  root.innerHTML = '<p class="uhf-loading">Loading funding opportunities…</p>';
  const res = await fetch(BASE + 'data/opportunities.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  DATA = await res.json();
  if (!state.reminders) state.reminders = DATA.config.default_reminders_days.slice();
  root.classList.toggle('uhf-mode-full', state.view === 'full');
  STAGE = Object.fromEntries(Object.entries(DATA.taxonomy.stages).map(([k, v]) => [k, { ...palette(v.color || NEUTRAL), label: v.label }]));
  renderShell();
  update();
}

// ------------------------------------------------------------------ shell

function chips(name, entries, selected, withSwatch) {
  return entries.map(([k, v]) => {
    const p = withSwatch ? STAGE[k] : null;
    const style = p ? ` style="--chip-bg:${p.bg};--chip-fg:${p.fg}"` : '';
    return `<label class="uhf-chip${p ? ' uhf-chip-colour' : ''}"${style}>
      <input type="checkbox" name="${name}" value="${h(k)}" ${selected.includes(k) ? 'checked' : ''}>
      <span>${p ? `<i class="uhf-swatch" style="background:${p.color}"></i>` : ''}${h(v.label)}</span></label>`;
  }).join('');
}

function contactLink() {
  const url = DATA.config.contact_url;
  const text = url.startsWith('mailto:') ? url.slice(7).split('?')[0] : url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `<a href="${h(url)}"${url.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener"'}>${h(text)}</a>`;
}

function renderShell() {
  const t = DATA.taxonomy;
  const areas = Object.entries(t.areas).filter(([, v]) => v.feed !== false);
  const a = state.answers;
  root.innerHTML = `
  <div class="uhf-welcome">
    <h2 class="uhf-welcome-title">Welcome to the Utrecht Funding &amp; Deadlines overview</h2>
    <p>Great science deserves the means to reach impact. This overview brings together research grants,
      proof-of-concept funding, transition and pre-seed financing, and pitch competitions that help researchers,
      founders and innovators move ideas from lab to life – from a first feasibility study to a spin-off's first investment.</p>
    <p>Everything listed is open to Utrecht-based research groups or start-ups, wherever the money comes from. Each entry
      links to the funder's own page, shows the deadline with date and time, and explains who can apply.
      <strong>Always check the details on the funder's page before you apply.</strong></p>
    <p>Filter by stage and area, check what fits you, and subscribe to your selection: your calendar stays up to date
      and reminds you 6 weeks and 1 week before each deadline. Schemes without a fixed deadline are listed
      under <em>Open year-round</em>.</p>
    <p><strong>Know of funding we're missing?</strong> If you're aware of a grant, programme, competition or deadline
      that should be here, let us know at ${contactLink()} – we'd love to include it.</p>
  </div>

  <div class="uhf-controls-bar">
    <p class="uhf-updated">Updated ${h(fmtDate(DATA.today))}</p>
    <div class="uhf-view-toggle" role="group" aria-label="Level of detail">
      <button type="button" data-view="compact" class="${state.view === 'compact' ? 'on' : ''}">Overview</button>
      <button type="button" data-view="full" class="${state.view === 'full' ? 'on' : ''}">Full details</button>
    </div>
  </div>

  <div class="uhf-filter-bar">
    <div class="uhf-search-row">
      <label class="uhf-filter-label" for="uhfSearch">Search</label>
      <input type="search" id="uhfSearch" name="q" placeholder="e.g. ATMP, Take-off, organoids, oncology">
    </div>
    <p class="uhf-filter-label">Stage</p>
    <div class="uhf-chips">${chips('stages', Object.entries(t.stages), state.stages, true)}</div>
    <p class="uhf-filter-label">Area</p>
    <div class="uhf-chips">${chips('areas', areas, state.areas, false)}</div>
    <details class="uhf-more" ${state.flags.length || state.types.length ? 'open' : ''}>
      <summary>Specific topics and type of funding</summary>
      <p class="uhf-filter-label">Topic</p>
      <div class="uhf-chips">${chips('flags', Object.entries(t.flags), state.flags, false)}</div>
      <p class="uhf-filter-label">Type of funding</p>
      <div class="uhf-chips">${chips('types', Object.entries(t.funding_types), state.types, false)}</div>
    </details>
  </div>

  <details class="uhf-panel uhf-elig-panel" ${Object.keys(a).length ? 'open' : ''}>
    <summary><span class="uhf-panel-title">Check what fits you</span> <span class="uhf-optional">optional · stays in your browser</span></summary>
    <div class="uhf-form">
      <label>I am applying as
        <select name="role">
          <option value="">—</option>
          ${Object.entries(t.applicants).filter(([k]) => k !== 'consortium').map(([k, v]) => `<option value="${k}" ${a.role === k ? 'selected' : ''}>${h(v.label)}</option>`).join('')}
        </select></label>
      <label>Organisation
        <select name="org">
          <option value="">—</option>
          ${['Utrecht University', 'UMC Utrecht', 'HU University of Applied Sciences Utrecht', 'Hubrecht Institute', 'Princess Máxima Center', 'Other Utrecht institute', 'Utrecht start-up / company', 'Other']
            .map(o => `<option ${a.org === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select></label>
      <label>Years since PhD <input type="number" name="yearsPostPhd" min="0" max="50" value="${a.yearsPostPhd ?? ''}"></label>
      <label>Company age (years) <input type="number" name="companyAgeYears" min="0" max="50" value="${a.companyAgeYears ?? ''}"></label>
      <label>Age <input type="number" name="age" min="15" max="100" value="${a.age ?? ''}"></label>
      <label>Gender <small>only used to show women-focused schemes</small>
        <select name="gender">
          <option value="">Prefer not to say</option>
          <option value="woman" ${a.gender === 'woman' ? 'selected' : ''}>Woman</option>
          <option value="man" ${a.gender === 'man' ? 'selected' : ''}>Man</option>
          <option value="nonbinary" ${a.gender === 'nonbinary' ? 'selected' : ''}>Non-binary</option>
        </select></label>
      <fieldset class="uhf-holds"><legend>I hold (or recently held)</legend>
        <label><input type="checkbox" name="holds" value="erc-grant" ${a.holds?.includes('erc-grant') ? 'checked' : ''}> an ERC grant</label>
        <label><input type="checkbox" name="holds" value="nwo-zonmw-grant" ${a.holds?.includes('nwo-zonmw-grant') ? 'checked' : ''}> NWO / ZonMw funding</label>
      </fieldset>
      <label>Company partner on board?
        <select name="hasCompanyPartner">
          <option value="">—</option>
          <option value="yes" ${a.hasCompanyPartner === true ? 'selected' : ''}>Yes</option>
          <option value="no" ${a.hasCompanyPartner === false ? 'selected' : ''}>Not yet</option>
        </select></label>
    </div>
    <div class="uhf-row">
      <label class="uhf-toggle"><input type="checkbox" name="hideUnlikely" ${state.hideUnlikely ? 'checked' : ''}> Hide what probably doesn't fit</label>
      <label class="uhf-toggle"><input type="checkbox" name="remember" ${state.remember ? 'checked' : ''}> Remember my answers on this device</label>
      <button type="button" class="uhf-text-btn" data-act="clear">Clear answers</button>
    </div>
  </details>

  <section class="uhf-panel uhf-subscribe" aria-labelledby="uhfSubTitle">
    <p class="uhf-panel-title" id="uhfSubTitle">Subscribe or download</p>
    <div class="uhf-sub-body"></div>
  </section>

  <div class="uhf-results" aria-live="polite"></div>`;

  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('click', onClick);
}

function onInput(e) {
  const el = e.target;
  if (!el.name) return;
  const multi = ['areas', 'stages', 'flags', 'types'];
  if (multi.includes(el.name)) state[el.name] = [...root.querySelectorAll(`input[name="${el.name}"]:checked`)].map(i => i.value);
  else if (el.name === 'q') state.q = el.value.trim().toLowerCase();
  else if (['hideUnlikely', 'remember', 'reminderEntries'].includes(el.name)) state[el.name] = el.checked;
  else if (el.name === 'reminders') state.reminders = parseReminders(el.value);
  else if (el.name === 'holds') state.answers.holds = [...root.querySelectorAll('input[name="holds"]:checked')].map(i => i.value);
  else if (['yearsPostPhd', 'companyAgeYears', 'age'].includes(el.name)) state.answers[el.name] = el.value === '' ? undefined : Number(el.value);
  else if (el.name === 'hasCompanyPartner') state.answers.hasCompanyPartner = el.value === '' ? undefined : el.value === 'yes';
  else if (['role', 'org', 'gender'].includes(el.name)) state.answers[el.name] = el.value || undefined;
  else return;
  persist();
  update(el.name);
}

function onClick(e) {
  const view = e.target.closest('[data-view]');
  if (view) {
    state.view = view.dataset.view;
    expanded.clear();
    root.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b === view));
    root.classList.toggle('uhf-mode-full', state.view === 'full');
    persist(); update('view');
    return;
  }
  const row = e.target.closest('.uhf-row-btn');
  if (row) {
    const card = row.closest('.uhf-card');
    const id = card.dataset.key;
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    card.classList.toggle('expanded');
    row.setAttribute('aria-expanded', card.classList.contains('expanded'));
    return;
  }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  if (act.dataset.act === 'clear') {
    state.answers = {};
    root.querySelectorAll('.uhf-form input, .uhf-form select').forEach(i => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
    persist(); update();
  } else if (act.dataset.act === 'download-selection') {
    downloadICS(selectionEvents(), `${DATA.config.calendar_name} (selection)`, 'utrecht-funding-selection.ics');
  } else if (act.dataset.act === 'download-one') {
    const op = DATA.opportunities.find(o => o.id === act.dataset.id);
    const dl = op.upcoming.find(d => d.date === act.dataset.date && (d.label || '') === (act.dataset.label || ''));
    downloadICS([{ op, dl }], op.title, `${op.id}-${dl.date}.ics`);
  } else if (act.dataset.act === 'copy') {
    navigator.clipboard?.writeText(act.dataset.url).then(() => { act.textContent = 'Copied'; setTimeout(() => (act.textContent = 'Copy link'), 1500); });
  }
}

function persist() {
  const s = { areas: state.areas, stages: state.stages, flags: state.flags, types: state.types, view: state.view,
    hideUnlikely: state.hideUnlikely, reminderEntries: state.reminderEntries, reminders: state.reminders, remember: state.remember };
  if (state.remember) s.answers = state.answers;
  save(s);
}

function parseReminders(text) {
  const out = [];
  for (const part of text.split(/[,;]+/)) {
    const m = part.trim().toLowerCase().match(/^(\d+)\s*(w|wk|weeks?|d|days?)?$/);
    if (!m) continue;
    const n = Number(m[1]) * (m[2]?.startsWith('w') ? 7 : 1);
    if (n > 0 && n <= 365) out.push(n);
  }
  return [...new Set(out)].sort((a, b) => b - a);
}
const remindersText = days => days.map(d => (d % 7 === 0 ? `${d / 7}w` : `${d}d`)).join(', ');

// ------------------------------------------------------------------ filtering

function filtered() {
  const f = { areas: state.areas, stages: state.stages, flags: state.flags };
  return DATA.opportunities
    .filter(op => matches(op, f))
    .filter(op => !state.types.length || state.types.includes(op.funding_type))
    .filter(op => !state.q || [op.title, op.funder, op.summary, op.eligibility?.utrecht, ...(op.flags || []).map(x => DATA.taxonomy.flags[x]?.label)]
      .join(' ').toLowerCase().includes(state.q))
    .map(op => ({ ...op, fit: checkEligibility(op, state.answers) }))
    .filter(op => !(state.hideUnlikely && op.fit.verdict === 'unlikely'));
}

function selectionEvents() { return deadlineEvents(filtered()); }

// ------------------------------------------------------------------ render

function update(changed) {
  const list = filtered();
  if (changed !== 'reminders') renderResults(list);
  renderSubscribe(list);
}

const hasAnswers = () => Object.values(state.answers).some(v => v !== undefined && !(Array.isArray(v) && !v.length));

function fitBadge(fit) {
  if (!hasAnswers()) return '';
  const label = { match: 'Fits your answers', check: 'Check eligibility', unlikely: "Probably doesn't fit" }[fit.verdict];
  return `<span class="uhf-fit uhf-fit-${fit.verdict}">${label}${fit.reasons.length ? ': ' + h(fit.reasons.join('; ')) : ''}</span>`;
}

const TYPE_BADGE = { grant: 'free', fellowship: 'free', loan: 'pay', equity: 'pay', prize: 'prize', programme: 'reg', tax: 'reg' };

/**
 * One expandable card. `dl` is the deadline this card sits on in the timeline
 * (null for rolling / expected entries).
 */
function card(op, dl) {
  const t = DATA.taxonomy;
  const p = stageOf(op);
  const key = `${op.id}|${dl ? dl.date + (dl.label || '') : 's'}`;
  const isOpen = state.view === 'full' || expanded.has(key);
  const time = dl ? (dl.time || 'All day') : op.status === 'rolling' ? 'Any time' : op.status === 'expected' ? 'Expected' : 'Invite';
  const stageTags = op.stages.map(s => `<span class="uhf-cat-tag" style="background:${STAGE[s].bg};color:${STAGE[s].fg}">${h(STAGE[s].label)}</span>`).join('');

  let flag = '';
  if (dl) {
    const n = daysUntil(dl.date);
    const when = n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
    flag = `<div class="uhf-deadline-flag${n <= 14 ? ' soon' : ''}">⏳ Deadline ${h(fmtDate(dl.date))}, ${h(deadlineTimeLabel(dl))}${dl.label ? ' · ' + h(dl.label) : ''} · ${when}</div>`;
    const others = op.upcoming.filter(d => d !== dl && !(d.date === dl.date && d.label === dl.label));
    if (others.length) flag += `<p class="uhf-other-dl">Also: ${others.map(d => `${h(fmtDate(d.date))}${d.label ? ' (' + h(d.label) + ')' : ''}${d.invite_only ? ' · by invitation' : ''}`).join('; ')}</p>`;
  } else if (op.status === 'invite-only') {
    flag = `<div class="uhf-deadline-flag uhf-flag-muted">By invitation: ${op.upcoming.map(d => `${h(fmtDate(d.date))}${d.label ? ' (' + h(d.label) + ')' : ''}`).join('; ')}</div>`;
  }
  const rolling = op.rolling ? `<p class="uhf-note-box">🔁 ${h(op.rolling_note || 'Apply at any time.')}</p>` : '';
  const next = (op.status === 'expected' || op.status === 'invite-only') && op.next_round ? `<p class="uhf-note-box">Next round: ${h(op.next_round)}</p>` : '';

  const badges = [
    `<span class="uhf-badge ${TYPE_BADGE[op.funding_type] || 'reg'}">${h(t.funding_types[op.funding_type].label)}</span>`,
    ...op.areas.map(a => `<span class="uhf-badge area">${h(t.areas[a].label)}</span>`),
    ...(op.flags || []).map(f => `<span class="uhf-badge flag">${h(t.flags[f].label)}</span>`),
  ].join('');

  const actions = [`<a class="uhf-action primary" href="${h(op.url)}" target="_blank" rel="noopener">Official page ↗</a>`];
  if (dl && !dl.invite_only) {
    actions.push(`<a class="uhf-action" href="${BASE}ics/${h(op.id)}/${dl.date}.ics" download title="Reminders ${remindersText(DATA.config.default_reminders_days)} before">+ Add to calendar</a>`);
    actions.push(`<button type="button" class="uhf-action" data-act="download-one" data-id="${h(op.id)}" data-date="${dl.date}" data-label="${h(dl.label || '')}">Custom reminders</button>`);
  }

  return `<article class="uhf-card${isOpen ? ' expanded' : ''}" data-key="${h(key)}" style="--stage:${p.color}">
    <button type="button" class="uhf-row-btn" aria-expanded="${isOpen}">
      <span class="uhf-row-time">${h(time)}</span>
      <span class="uhf-row-dot" style="background:${p.color}"></span>
      <span class="uhf-row-title">${h(op.title)}</span>
      <span class="uhf-row-funder">${h(op.funder)}</span>
      <span class="uhf-row-chevron" aria-hidden="true"></span>
    </button>
    <div class="uhf-body">
      <div class="uhf-card-top">${stageTags}</div>
      <h4 class="uhf-card-title"><a href="${h(op.url)}" target="_blank" rel="noopener">${h(op.title)}</a></h4>
      <p class="uhf-card-meta">${h(op.funder)}${op.amount ? ' · ' + h(op.amount) : ''}</p>
      ${flag}${rolling}${next}
      ${fitBadge(op.fit)}
      <p class="uhf-card-desc">${h(op.summary)}</p>
      <p class="uhf-card-elig"><strong>Who can apply:</strong> ${h(op.eligibility.utrecht)}</p>
      <div class="uhf-badges">${badges}</div>
      <div class="uhf-actions">${actions.join('')}<span class="uhf-checked">checked ${h(fmtDate(op.last_verified))}</span></div>
    </div>
  </article>`;
}

function timeline(list) {
  // One timeline entry per public upcoming deadline, grouped by month then day.
  const items = [];
  for (const op of list) for (const dl of op.upcoming) if (!dl.invite_only) items.push({ op, dl });
  items.sort((a, b) => (a.dl.date + (a.dl.time || '')).localeCompare(b.dl.date + (b.dl.time || '')));
  let html = '';
  let month = '';
  let i = 0;
  while (i < items.length) {
    const date = items[i].dl.date;
    const m = date.slice(0, 7);
    if (m !== month) {
      month = m;
      html += `<p class="uhf-month-sep">${D(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>`;
    }
    const day = [];
    while (i < items.length && items[i].dl.date === date) day.push(items[i++]);
    const n = daysUntil(date);
    html += `<div class="uhf-day-group${n <= 14 ? ' is-soon' : ''}">
      <div class="uhf-day-marker">
        <div class="uhf-day-num">${D(date).getUTCDate()}</div>
        <div class="uhf-day-dow">${D(date).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</div>
        <span class="uhf-node"></span>
      </div>
      <div class="uhf-day-col">${day.map(x => card(x.op, x.dl)).join('')}</div>
    </div>`;
  }
  return html;
}

function renderResults(list) {
  const open = list.filter(o => o.status === 'open');
  const nDeadlines = open.reduce((n, o) => n + o.upcoming.filter(d => !d.invite_only).length, 0);
  const groups = [
    ['rolling', 'Open year-round', 'No fixed deadline: apply when you are ready. Calendar subscribers get a quarterly reminder of these.',
      list.filter(o => o.status === 'rolling')],
    ['expected', 'Expected', 'Recurring schemes whose next date is not published yet. They join the calendar as soon as it is.',
      list.filter(o => o.status === 'expected')],
    ['invite-only', 'Invitation stage', 'Pre-proposal rounds have closed. Listed so you can plan for the next round.',
      list.filter(o => o.status === 'invite-only')],
  ];
  let out = '';
  if (open.length) {
    out += `<section class="uhf-group">
      <h3 class="uhf-column-title">Upcoming deadlines <span class="uhf-count">${nDeadlines}</span></h3>
      <div class="uhf-timeline">${timeline(open)}</div></section>`;
  }
  out += groups.filter(g => g[3].length).map(([k, title, note, items]) => `
    <section class="uhf-group uhf-group-${k}">
      <h3 class="uhf-column-title">${title} <span class="uhf-count">${items.length}</span></h3>
      <p class="uhf-group-note">${note}</p>
      <div class="uhf-list">${items.map(op => card(op, null)).join('')}</div>
    </section>`).join('');
  root.querySelector('.uhf-results').innerHTML = out || '<p class="uhf-empty">No funding matches the selected filters. Try fewer filters or a broader stage.</p>';
}

function renderSubscribe(list) {
  const t = DATA.taxonomy;
  const cfg = DATA.config;
  const simple = !state.flags.length && !state.types.length && !state.q && state.areas.length <= 1 && state.stages.length <= 1;
  const area = state.areas[0] || 'all';
  const stage = state.stages[0] || 'all';
  const desc = [state.areas.map(a => t.areas[a].label).join(' + ') || 'All areas',
    state.stages.map(s => t.stages[s].label).join(' + ') || 'all stages'].join(' · ');
  const nEvents = deadlineEvents(list).length;

  let url = '';
  let kind = '';
  const custom = state.reminders.join(',') !== cfg.default_reminders_days.join(',');
  if (cfg.worker_url && (!simple || custom)) {
    const p = new URLSearchParams();
    if (state.areas.length) p.set('areas', state.areas.join(','));
    if (state.stages.length) p.set('stages', state.stages.join(','));
    if (state.flags.length) p.set('flags', state.flags.join(','));
    if (state.types.length) p.set('types', state.types.join(','));
    p.set('r', state.reminders.join(','));
    if (!state.reminderEntries) p.set('entries', '0');
    url = cfg.worker_url.replace(/\/$/, '') + '/feed.ics?' + p;
    kind = 'custom';
  } else if (simple) {
    url = BASE + presetFeedPath(area, stage, state.reminderEntries);
    kind = 'preset';
  }

  const name = `${cfg.calendar_name} — ${desc}`;
  let subscribeHtml;
  if (url) {
    const L = subscribeLinks(url, name);
    subscribeHtml = `
      <p class="uhf-sub-lead">Subscribe to <strong>${h(desc)}</strong> · ${nEvents} deadline${nEvents === 1 ? '' : 's'} now. The calendar updates itself when entries are added or corrected.</p>
      <div class="uhf-actions uhf-actions-lg">
        <a class="uhf-action primary" href="${h(L.google)}" target="_blank" rel="noopener">Google Calendar</a>
        <a class="uhf-action primary" href="${h(L.webcal)}">Apple / iPhone</a>
        <a class="uhf-action primary" href="${h(L.outlook)}" target="_blank" rel="noopener">Outlook (work)</a>
        <a class="uhf-action primary" href="${h(L.outlookcom)}" target="_blank" rel="noopener">Outlook.com</a>
        <button type="button" class="uhf-action" data-act="copy" data-url="${h(url)}">Copy link</button>
      </div>
      ${kind === 'preset' && custom ? '<p class="uhf-hint">Custom reminder times apply to downloads. Subscriptions use the standard 6 weeks and 1 week.</p>' : ''}`;
  } else {
    subscribeHtml = `
      <p class="uhf-sub-lead">A subscription follows <strong>one area and one stage</strong> (or all of them). For this selection, download below, or subscribe to a broader calendar:</p>
      <div class="uhf-actions uhf-actions-lg">
        ${state.stages.length === 1 ? `<a class="uhf-action" href="${h(subscribeLinks(BASE + presetFeedPath('all', stage, state.reminderEntries), name).webcal)}">All areas · ${h(t.stages[stage].label)}</a>` : ''}
        ${state.areas.length === 1 ? `<a class="uhf-action" href="${h(subscribeLinks(BASE + presetFeedPath(area, 'all', state.reminderEntries), name).webcal)}">${h(t.areas[area].label)} · all stages</a>` : ''}
        <a class="uhf-action" href="${h(subscribeLinks(BASE + presetFeedPath('all', 'all', state.reminderEntries), cfg.calendar_name).webcal)}">Everything</a>
      </div>`;
  }

  root.querySelector('.uhf-sub-body').innerHTML = `
    ${subscribeHtml}
    <div class="uhf-row">
      <label class="uhf-toggle"><input type="checkbox" name="reminderEntries" ${state.reminderEntries ? 'checked' : ''}>
        Add reminder entries before each deadline <small>(recommended: Google and Outlook ignore alarms in subscribed calendars)</small></label>
    </div>
    <div class="uhf-row">
      <label class="uhf-inline">Reminders <input name="reminders" value="${h(remindersText(state.reminders))}" size="12" aria-describedby="uhfRemHelp"></label>
      <small id="uhfRemHelp">e.g. <code>6w, 1w</code> or <code>8w, 2w, 3d</code></small>
      <button type="button" class="uhf-action" data-act="download-selection" ${nEvents ? '' : 'disabled'}>Download these ${nEvents} deadlines (.ics)</button>
    </div>
    <p class="uhf-hint">A download is a one-off copy with alarms at your chosen times. It does not update; subscribe above to stay current.</p>`;
}

function downloadICS(events, name, filename) {
  const today = todayAmsterdam();
  const rolling = filtered().filter(o => o.status === 'rolling');
  const ics = buildICS(events, {
    name, reminderDays: state.reminders, reminderEntries: false, pageUrl: location.href,
    rollingCheckins: events.length > 1 ? rollingCheckinDates(today, DATA.config.rolling_checkin_months).map(date => ({ date, ops: rolling })) : [],
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
