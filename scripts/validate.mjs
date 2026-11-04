// Checks data/opportunities.yaml against the rules in rules/funding-rules.md.
// Errors fail the build; warnings are printed. Run: npm run validate
import { loadAll } from './lib/load.mjs';
import { todayAmsterdam, addDays } from './lib/core.mjs';

export function validate({ config, taxonomy, opportunities }, today = todayAmsterdam()) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const vocab = (name, values, list, id) => {
    for (const v of values || []) if (!(v in (taxonomy[list] || {}))) errors.push(`${id}: unknown ${name} "${v}" (add it to taxonomy.yaml → ${list})`);
  };
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));

  for (const op of opportunities) {
    const id = op.id || '(missing id)';
    if (!/^[a-z0-9][a-z0-9-]*$/.test(op.id || '')) errors.push(`${id}: id must be lowercase letters, digits and hyphens`);
    if (ids.has(op.id)) errors.push(`${id}: duplicate id`);
    ids.add(op.id);
    for (const f of ['title', 'funder', 'url', 'summary', 'last_verified']) if (!op[f]) errors.push(`${id}: missing ${f}`);
    if (op.url && !/^https:\/\//.test(op.url)) errors.push(`${id}: url must be https and point to the funder's own page`);
    if (!op.areas?.length) errors.push(`${id}: needs at least one area`);
    if (!op.stages?.length) errors.push(`${id}: needs at least one stage`);
    vocab('area', op.areas, 'areas', id);
    vocab('stage', op.stages, 'stages', id);
    vocab('flag', op.flags, 'flags', id);
    vocab('funding type', [op.funding_type].filter(Boolean), 'funding_types', id);
    if (!op.funding_type) errors.push(`${id}: missing funding_type`);
    const e = op.eligibility || {};
    if (!e.utrecht) errors.push(`${id}: eligibility.utrecht is required — say who in Utrecht can apply and how`);
    vocab('applicant', e.applicants, 'applicants', id);
    vocab('requirement', e.requires, 'requires', id);
    if (e.gender && e.gender !== 'women') errors.push(`${id}: eligibility.gender may only be "women"`);

    if (!isDate(op.last_verified)) errors.push(`${id}: last_verified must be YYYY-MM-DD`);
    else {
      if (op.last_verified > today) errors.push(`${id}: last_verified is in the future`);
      const age = (Date.parse(today) - Date.parse(op.last_verified)) / 864e5;
      if (age > config.verify_fail_days) errors.push(`${id}: last verified ${Math.round(age)} days ago — re-check the source`);
      else if (age > config.verify_warn_days) warnings.push(`${id}: last verified ${Math.round(age)} days ago`);
    }

    const dls = op.deadlines || [];
    for (const d of dls) {
      if (!isDate(d.date)) errors.push(`${id}: deadline date "${d.date}" is not YYYY-MM-DD`);
      if (d.time && !/^\d{2}:\d{2}$/.test(d.time)) errors.push(`${id}: deadline time "${d.time}" must be HH:MM`);
      if (d.time && !d.tz) errors.push(`${id}: deadline ${d.date} has a time but no tz`);
    }
    const future = dls.filter(d => isDate(d.date) && d.date >= today);
    if (dls.length && !op.source_quote) errors.push(`${id}: deadlines need a source_quote copied from the funder's page`);
    if (!dls.length && !op.rolling && !op.next_round) errors.push(`${id}: give deadlines, rolling: true, or next_round`);
    if (op.rolling && !op.rolling_note) warnings.push(`${id}: rolling without rolling_note (how are applications handled?)`);
    if (dls.length && !future.length && !op.rolling && !op.next_round)
      warnings.push(`${id}: all deadlines have passed — add next_round or archive the entry`);
    for (const d of future) if (d.date > addDays(today, 730)) warnings.push(`${id}: deadline ${d.date} is over two years out — typo?`);
  }
  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = loadAll();
  const { errors, warnings } = validate(data);
  for (const w of warnings) console.warn('warn ', w);
  for (const e of errors) console.error('ERROR', e);
  console.log(`${data.opportunities.length} opportunities, ${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}
