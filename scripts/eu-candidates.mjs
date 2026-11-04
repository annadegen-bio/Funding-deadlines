// Lists open and forthcoming EU Funding & Tenders topics in programmes relevant to Utrecht that
// are NOT yet in data/opportunities.yaml, as a review list. Nothing is added automatically.
// Run: node scripts/eu-candidates.mjs > candidates/eu-topics.md
import { loadAll } from './lib/load.mjs';
import { todayAmsterdam } from './lib/core.mjs';

const PREFIXES = [
  'ERC-', 'HORIZON-EIC-', 'HORIZON-MSCA-', 'HORIZON-HLTH-', 'HORIZON-MISS-', 'HORIZON-JU-IHI-',
  'HORIZON-CL4-', 'HORIZON-CL5-', 'HORIZON-CL6-', 'HORIZON-EIT-', 'EU4H-',
];
const API = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***';
const STATUS = { 31094501: 'Forthcoming', 31094502: 'Open' };

async function page(n) {
  const fd = new FormData();
  fd.append('query', new Blob([JSON.stringify({ bool: { must: [
    { terms: { type: ['1', '2', '8'] } },
    { terms: { status: Object.keys(STATUS) } },
  ] } })], { type: 'application/json' }));
  fd.append('languages', new Blob(['["en"]'], { type: 'application/json' }));
  const res = await fetch(`${API}&pageSize=100&pageNumber=${n}`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`EU search API: HTTP ${res.status}`);
  return (await res.json()).results || [];
}

const { opportunities } = loadAll();
const known = new Set(opportunities.map(o => o.url.split('/').pop().toUpperCase()));
const today = todayAmsterdam();
const rows = new Map();
for (let n = 1; n <= 15; n++) {
  const results = await page(n);
  if (!results.length) break;
  for (const r of results) {
    const m = r.metadata || {};
    const id = (m.identifier || [''])[0];
    if (!PREFIXES.some(p => id.startsWith(p)) || known.has(id.toUpperCase()) || rows.has(id)) continue;
    const deadlines = (m.deadlineDate || []).map(d => d.slice(0, 10)).filter(d => d >= today);
    if (!deadlines.length) continue;
    rows.set(id, { id, title: (m.title || [''])[0], deadlines, status: STATUS[(m.status || [''])[0]] || '?' });
  }
}

const sorted = [...rows.values()].sort((a, b) => a.deadlines[0].localeCompare(b.deadlines[0]) || a.id.localeCompare(b.id));
console.log(`# EU topics not yet in the calendar (${sorted.length})\n`);
console.log(`Generated ${today}. Review, pick what fits Utrecht, and add it to data/opportunities.yaml after`);
console.log('checking the topic page (deadline, time, eligibility). The search API can lag the portal.\n');
console.log('| Deadline(s) | Status | Topic | Title |\n|---|---|---|---|');
for (const r of sorted) {
  const url = `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${r.id}`;
  console.log(`| ${r.deadlines.join(', ')} | ${r.status} | [${r.id}](${url}) | ${r.title.replace(/\|/g, '/')} |`);
}
