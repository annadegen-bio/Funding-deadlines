import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrich, matches, checkEligibility, buildICS, rollingCheckinDates, presetFeedPath } from '../lib/core.mjs';

const base = {
  id: 'x', title: 'Test call', funder: 'F', url: 'https://example.org', summary: 's', areas: ['medtech'],
  stages: ['valorisation'], flags: ['atmp'], funding_type: 'grant', last_verified: '2026-11-01',
  eligibility: { utrecht: 'u', applicants: ['researcher'] },
};

test('status: open, invite-only, rolling, expected, closed', () => {
  const t = '2026-11-04';
  assert.equal(enrich({ ...base, deadlines: [{ date: '2026-12-01' }] }, t).status, 'open');
  assert.equal(enrich({ ...base, deadlines: [{ date: '2026-12-01', invite_only: true }] }, t).status, 'invite-only');
  assert.equal(enrich({ ...base, deadlines: [], rolling: true }, t).status, 'rolling');
  assert.equal(enrich({ ...base, deadlines: [{ date: '2026-01-01' }], next_round: 'spring' }, t).status, 'expected');
  assert.equal(enrich({ ...base, deadlines: [{ date: '2026-01-01' }] }, t).status, 'closed');
  assert.equal(enrich({ ...base, deadlines: [{ date: '2026-11-04' }] }, t).status, 'open', 'deadline today is still open');
});

test('matches: any-area entries appear in every area; empty filters match all', () => {
  assert.ok(matches(base, {}));
  assert.ok(matches(base, { areas: ['medtech'], stages: ['valorisation'] }));
  assert.ok(!matches(base, { areas: ['chemistry'] }));
  assert.ok(matches({ ...base, areas: ['any'] }, { areas: ['chemistry'] }));
  assert.ok(matches(base, { flags: ['atmp', 'oncology'] }));
  assert.ok(!matches(base, { flags: ['oncology'] }));
});

test('eligibility: never excludes on missing answers', () => {
  assert.equal(checkEligibility(base, {}).verdict, 'match');
  const erc = { ...base, eligibility: { ...base.eligibility, requires: ['erc-grant'] } };
  assert.equal(checkEligibility(erc, { holds: [] }).verdict, 'unlikely');
  assert.equal(checkEligibility(erc, { holds: ['erc-grant'] }).verdict, 'match');
  const young = { ...base, eligibility: { ...base.eligibility, max_age: 34 } };
  assert.equal(checkEligibility(young, { age: 40 }).verdict, 'unlikely');
  const women = { ...base, eligibility: { ...base.eligibility, gender: 'women' } };
  assert.equal(checkEligibility(women, { gender: 'man' }).verdict, 'check');
  assert.equal(checkEligibility(women, {}).verdict, 'match');
});

test('ICS: CRLF, folded lines, alarms and reminder entries', () => {
  const op = enrich({ ...base, title: 'A very long title '.repeat(6), deadlines: [{ date: '2027-03-01', time: '14:00', tz: 'Europe/Amsterdam' }] }, '2026-11-04');
  const ics = buildICS([{ op, dl: op.upcoming[0] }], { reminderDays: [42, 7], reminderEntries: true, now: new Date('2026-11-04T10:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line}`);
  assert.match(ics, /DTSTART;VALUE=DATE:20270301/);
  assert.match(ics, /TRIGGER:-P42D/);
  assert.match(ics, /TRIGGER:-P7D/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270118/, '6-week reminder entry');
  assert.match(ics, /DTSTART;VALUE=DATE:20270222/, '1-week reminder entry');
});

test('ICS: reminder entries in the past are skipped', () => {
  const op = enrich({ ...base, deadlines: [{ date: '2026-11-20' }] }, '2026-11-04');
  const ics = buildICS([{ op, dl: op.upcoming[0] }], { reminderDays: [42, 7], reminderEntries: true, now: new Date('2026-11-04T10:00:00Z') });
  assert.doesNotMatch(ics, /DTSTART;VALUE=DATE:20261009/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261113/);
});

test('rolling check-ins land on working days within a year', () => {
  const d = rollingCheckinDates('2026-11-04', [1, 4, 7, 10]);
  assert.deepEqual(d, ['2027-01-04', '2027-04-01', '2027-07-01', '2027-10-01']);
  for (const x of d) assert.ok(![0, 6].includes(new Date(x + 'T12:00:00Z').getUTCDay()));
});

test('preset feed paths', () => {
  assert.equal(presetFeedPath(), 'feeds/all/all.ics');
  assert.equal(presetFeedPath('medtech', 'venture', false), 'feeds/medtech/venture-no-reminders.ics');
});
