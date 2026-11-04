// Utrecht Funding & Deadlines — website. Works standalone (index.html) and embedded in
// WordPress (see wordpress/funding-block.html). Mounts into #uh-funding.
// Nothing the visitor enters leaves the browser.
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
};

let DATA;
const h = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const daysUntil = iso => Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(DATA.today + 'T12:00:00Z')) / 864e5);

init().catch(err => {
  root.innerHTML = `<p class="uhf-error">Could not load the funding data (${h(err.message)}). Please try again later.</p>`;
});

async function init() {
  root.classList.add('uhf');
  root.innerHTML = '<p class="uhf-loading">Loading funding opportunities…</p>';
  const res = await fetch(BASE + 'data/opportunities.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  DATA = await res.json();
  if (!state.reminders) state.reminders = DATA.config.default_reminders_days.slice();
  renderShell();
  update();
}

// ------------------------------------------------------------------ shell

function chips(name, entries, selected) {
  return entries.map(([k, v]) => `
    <label class="uhf-chip"><input type="checkbox" name="${name}" value="${h(k)}" ${selected.includes(k) ? 'checked' : ''}>
    <span>${h(v.label)}</span></label>`).join('');
}

function renderShell() {
  const t = DATA.taxonomy;
  const areas = Object.entries(t.areas).filter(([, v]) => v.feed !== false);
  const a = state.answers;
  root.innerHTML = `
  <div class="uhf-intro">
    <p>Funding for Utrecht researchers and start-ups, from research grants to pitch competitions.
    Every entry links to the funder's own page. <strong>Always check the deadline there before you apply.</strong></p>
  </div>

  <section class="uhf-panel" aria-labelledby="uhf-f">
    <h3 id="uhf-f">1 · What are you looking for?</h3>
    <fieldset><legend>Area</legend><div class="uhf-chips">${chips('areas', areas, state.areas)}</div></fieldset>
    <fieldset><legend>Stage</legend><div class="uhf-chips">${chips('stages', Object.entries(t.stages), state.stages)}</div></fieldset>
    <details class="uhf-more" ${state.flags.length || state.types.length ? 'open' : ''}>
      <summary>Specific topics and type of funding</summary>
      <fieldset><legend>Topic</legend><div class="uhf-chips">${chips('flags', Object.entries(t.flags), state.flags)}</div></fieldset>
      <fieldset><legend>Type of funding</legend><div class="uhf-chips">${chips('types', Object.entries(t.funding_types), state.types)}</div></fieldset>
    </details>
    <label class="uhf-search">Search <input type="search" name="q" placeholder="e.g. ATMP, Take-off, organoids"></label>
  </section>

  <section class="uhf-panel" aria-labelledby="uhf-e">
    <h3 id="uhf-e">2 · Check what fits you <span class="uhf-optional">optional</span></h3>
    <p class="uhf-note">Your answers stay in this browser. Nothing is sent or stored on a server. Leave out anything you prefer not to share.</p>
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
      <label>Gender <small>(only used to show women-focused schemes)</small>
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
      <button type="button" class="uhf-link" data-act="clear">Clear answers</button>
    </div>
  </section>

  <section class="uhf-panel uhf-subscribe" aria-labelledby="uhf-s">
    <h3 id="uhf-s">3 · Subscribe or download</h3>
    <div class="uhf-sub-body"></div>
  </section>

  <div class="uhf-results" aria-live="polite"></div>
  <p class="uhf-foot">Curated by Utrecht Holdings. Missing something, or found a wrong date?
    <a href="${h(DATA.config.contact_url)}" target="_blank" rel="noopener">Let us know</a>.
    Data updated ${h(fmtDate(DATA.today))}.</p>`;

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
  const s = { areas: state.areas, stages: state.stages, flags: state.flags, types: state.types,
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

function badge(fit) {
  if (!Object.values(state.answers).some(v => v !== undefined && !(Array.isArray(v) && !v.length))) return '';
  const label = { match: 'Fits your answers', check: 'Check eligibility', unlikely: "Probably doesn't fit" }[fit.verdict];
  const why = fit.reasons.length ? ` title="${h(fit.reasons.join('; '))}"` : '';
  return `<span class="uhf-fit uhf-fit-${fit.verdict}"${why}>${label}${fit.reasons.length ? ': ' + h(fit.reasons.join('; ')) : ''}</span>`;
}

function card(op) {
  const t = DATA.taxonomy;
  const tags = [
    ...op.stages.map(s => `<span class="uhf-tag uhf-tag-stage">${h(t.stages[s].label)}</span>`),
    ...op.areas.map(a => `<span class="uhf-tag">${h(t.areas[a].label)}</span>`),
    ...(op.flags || []).map(f => `<span class="uhf-tag uhf-tag-flag">${h(t.flags[f].label)}</span>`),
  ].join('');
  let when = '';
  if (op.status === 'open' || op.status === 'invite-only') {
    when = op.upcoming.map(d => {
      const n = daysUntil(d.date);
      const soon = n <= 14 ? ' uhf-soon' : '';
      const dl = `<a href="${BASE}ics/${h(op.id)}/${d.date}.ics" download class="uhf-ics" title="Add to calendar with ${remindersText(DATA.config.default_reminders_days)} reminders">+ calendar</a>
        <button type="button" class="uhf-link" data-act="download-one" data-id="${h(op.id)}" data-date="${d.date}" data-label="${h(d.label || '')}">custom reminders</button>`;
      return `<li class="uhf-dl${soon}${d.invite_only ? ' uhf-invite' : ''}"><strong>${fmtDate(d.date)}</strong>
        <span>${h(deadlineTimeLabel(d))}${d.label ? ' · ' + h(d.label) : ''}${d.invite_only ? ' · by invitation' : ''}</span>
        <em>${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`}</em> ${d.invite_only ? '' : dl}</li>`;
    }).join('');
    when = `<ul class="uhf-dls">${when}</ul>`;
  }
  const rolling = op.rolling ? `<p class="uhf-roll">🔁 ${h(op.rolling_note || 'Apply at any time.')}</p>` : '';
  const next = op.status === 'expected' || op.status === 'invite-only' ? `<p class="uhf-next">Next round: ${h(op.next_round || '')}</p>` : '';
  return `<article class="uhf-card">
    <header><h4><a href="${h(op.url)}" target="_blank" rel="noopener">${h(op.title)}</a></h4>
      <p class="uhf-funder">${h(op.funder)} · ${h(t.funding_types[op.funding_type].label)}${op.amount ? ' · ' + h(op.amount) : ''}</p></header>
    ${badge(op.fit)}
    ${when}${rolling}${next}
    <p>${h(op.summary)}</p>
    <p class="uhf-elig"><strong>Who can apply:</strong> ${h(op.eligibility.utrecht)}</p>
    <div class="uhf-tags">${tags}</div>
    <p class="uhf-meta"><a href="${h(op.url)}" target="_blank" rel="noopener">Official page ↗</a> · checked ${fmtDate(op.last_verified)}</p>
  </article>`;
}

function renderResults(list) {
  const groups = [
    ['open', 'Upcoming deadlines', 'Sorted by the next deadline you can apply for.',
      list.filter(o => o.status === 'open').sort((a, b) => a.next_deadline.date.localeCompare(b.next_deadline.date))],
    ['rolling', 'Open year-round', 'No fixed deadline — apply when you are ready. Calendar subscribers get a quarterly reminder of these.',
      list.filter(o => o.status === 'rolling')],
    ['expected', 'Expected — next round not yet published', 'Recurring schemes whose next date is not confirmed. They join the calendar as soon as it is.',
      list.filter(o => o.status === 'expected')],
    ['invite-only', 'Invitation stage only', 'Pre-proposal rounds have closed; listed so you can plan for the next round.',
      list.filter(o => o.status === 'invite-only')],
  ];
  const out = groups.filter(g => g[3].length).map(([k, title, note, items]) => `
    <section class="uhf-group uhf-group-${k}">
      <h3>${title} <span class="uhf-count">${items.length}</span></h3>
      <p class="uhf-note">${note}</p>
      ${items.map(card).join('')}
    </section>`).join('');
  root.querySelector('.uhf-results').innerHTML = out || '<p class="uhf-empty">Nothing matches these filters. Try fewer filters, or a broader stage.</p>';
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
      <p>Subscribe to <strong>${h(desc)}</strong> (${nEvents} deadline${nEvents === 1 ? '' : 's'} now). The calendar updates itself as entries are added or corrected.</p>
      <div class="uhf-buttons">
        <a class="uhf-btn" href="${h(L.google)}" target="_blank" rel="noopener">Google Calendar</a>
        <a class="uhf-btn" href="${h(L.webcal)}">Apple / iPhone</a>
        <a class="uhf-btn" href="${h(L.outlook)}" target="_blank" rel="noopener">Outlook (work)</a>
        <a class="uhf-btn" href="${h(L.outlookcom)}" target="_blank" rel="noopener">Outlook.com</a>
        <button type="button" class="uhf-btn uhf-btn-ghost" data-act="copy" data-url="${h(url)}">Copy link</button>
      </div>
      ${kind === 'preset' && custom ? '<p class="uhf-note">Custom reminder times apply to downloads. Subscriptions use the standard 6 weeks and 1 week.</p>' : ''}`;
  } else {
    subscribeHtml = `
      <p>A subscription can follow <strong>one area and one stage</strong> (or all of them). For this combination, use the download below, or subscribe to the broader calendar:</p>
      <div class="uhf-buttons">
        ${state.stages.length === 1 ? `<a class="uhf-btn uhf-btn-ghost" href="${h(subscribeLinks(BASE + presetFeedPath('all', stage, state.reminderEntries), name).webcal)}">All areas · ${h(t.stages[stage].label)}</a>` : ''}
        ${state.areas.length === 1 ? `<a class="uhf-btn uhf-btn-ghost" href="${h(subscribeLinks(BASE + presetFeedPath(area, 'all', state.reminderEntries), name).webcal)}">${h(t.areas[area].label)} · all stages</a>` : ''}
        <a class="uhf-btn uhf-btn-ghost" href="${h(subscribeLinks(BASE + presetFeedPath('all', 'all', state.reminderEntries), cfg.calendar_name).webcal)}">Everything</a>
      </div>`;
  }

  root.querySelector('.uhf-sub-body').innerHTML = `
    ${subscribeHtml}
    <div class="uhf-row">
      <label class="uhf-toggle"><input type="checkbox" name="reminderEntries" ${state.reminderEntries ? 'checked' : ''}>
        Add reminder entries before each deadline <small>(recommended: Google and Outlook ignore alarms in subscribed calendars)</small></label>
    </div>
    <div class="uhf-row">
      <label>Reminders before each deadline <input name="reminders" value="${h(remindersText(state.reminders))}" size="14" aria-describedby="uhf-rem-help"></label>
      <small id="uhf-rem-help">e.g. <code>6w, 1w</code> or <code>8w, 2w, 3d</code></small>
      <button type="button" class="uhf-btn uhf-btn-ghost" data-act="download-selection" ${nEvents ? '' : 'disabled'}>Download these ${nEvents} deadlines (.ics)</button>
    </div>
    <p class="uhf-note">A download is a one-off copy with real alarms at your chosen times. It does not update, so download again later or subscribe above.</p>`;
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
