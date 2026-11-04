# Funding & Deadlines — curation rules

The operating spec for what goes into the funding calendar and how. `npm run validate` enforces
the mechanical parts; the judgement calls are yours.

## 1. What belongs here

An opportunity belongs if **someone in Utrecht can apply**: a researcher at Utrecht University,
UMC Utrecht, HU University of Applied Sciences Utrecht, Hubrecht Institute, Princess Máxima
Center or another Utrecht institute, or a start-up/SME based in or coming from Utrecht.
Where the money comes from does not matter. Eligibility does.

- **Stages:** research grants (with or without an impact angle) → proof of concept → transition
  and pre-seed → venture: pitch competitions, accelerators, prizes, early investment.
- **Fields:** keep it broad. The Utrecht Holdings focus areas (life sciences, chemistry, biology,
  animal health & pharmacy, medtech, AI & software, sustainability) are the feed categories, but
  a scheme open to all disciplines is in (`areas: [any]`). Very specific schemes belong too:
  ATMPs, one disease area, NAMs. Tag them with `flags`.
- **Trustworthy sources only:** public funders (EU, NWO, ZonMw, RVO, provinces), established
  charities and foundations, universities and their holdings, recognised accelerators and
  competitions. **Leave out** pay-to-apply schemes, competitions whose prize is mainly
  "exposure", lead-generation sites and anything you can't trace to the organiser's own page.

## 2. The link and the deadline are the product

- `url` is the **funder's own page for this call**. Never an aggregator (grantsby, oncodaily,
  fundsforngos, …). Use aggregators to find leads, then confirm on the source.
- A deadline needs a **date, a time and a time zone** whenever the funder states one. Copy the
  sentence into `source_quote`.
  - EU Funding & Tenders Portal calls close at **17:00:00 Brussels time** unless the topic
    says otherwise.
  - NWO and ZonMw usually close at **14:00:00 Amsterdam time**. KWF at **12:00 noon**.
- `last_verified` is the date someone last opened the funder's page and checked the deadline.
  Validation warns after 60 days and fails after 120.
- If two sources disagree, the funder's page wins. If the funder's own pages disagree, use the
  call text (PDF), then note the discrepancy in `summary` and check again closer to the date.

## 3. Five kinds of entry

| Status (computed) | When | In the calendar? |
|---|---|---|
| **open** | at least one future deadline that anyone eligible can meet | yes, with reminders |
| **rolling** | `rolling: true`, apply any time | no single event; listed in the quarterly 🔁 check-in |
| **expected** | no confirmed date yet, `next_round` says what is expected and from what evidence | no, until the date is confirmed |
| **invite-only** | the only future deadlines are for invited (full) proposals | no; shown on the website for planning |
| closed | nothing future, no `next_round` | dropped from the build — archive or update it |

**Rolling with a final date:** schemes that accept applications continuously until a closing date
(NWO Take-off phase 1, Impact Explorer) get `rolling: true` **and** the closing date as a
deadline. They then appear in the calendar on the closing date.

**Two-stage calls:** stage 1 is a normal deadline; stage 2 gets `invite_only: true`.

**Never invent a date.** "Usually in February" goes in `next_round`, not in `deadlines`.

## 4. Eligibility notes

`eligibility.utrecht` is required. Write it for a Utrecht reader: who can apply, through which
institution, and any catch (internal pre-selection, a required company partner, a mobility
rule, an age limit). Fill in the structured fields only when the rule is clear-cut. The website
uses them for the "check what fits you" filter:

- `applicants`: researcher, phd, student, consortium, founder, startup, sme
- `requires`: erc-grant, nwo-zonmw-grant, research-result, company-partner, nl-company, eu-company, invitation
- `years_post_phd: {min, max}`, `max_age`, `max_company_age_years`, `gender: women`

The website never hides an opportunity because an answer is missing. "Probably doesn't fit"
only appears on a clear conflict, and the visitor can still show those entries.

## 5. Reminders

- Defaults: **6 weeks and 1 week** before the deadline date (`data/config.yaml`).
- Subscribed feeds carry the reminders twice: as alarms (Apple Calendar keeps them) and as
  separate ⏰ entries (Google Calendar and Outlook drop alarms from subscribed calendars).
  Subscribers can choose the feed without ⏰ entries.
- Downloads (one deadline, or a whole selection) carry real alarms at whatever times the visitor
  picks. Google's 28-day cap on its own reminders does not apply to imported alarms.

## 6. Cadence

- **Monthly:** re-check entries whose `last_verified` is older than 45 days; promote `expected`
  entries whose dates are now published; run `node scripts/eu-candidates.mjs` and review the list.
- **Whenever a deadline passes:** nothing to do. The nightly build drops it. If the scheme
  recurs, set `next_round` so it stays visible as expected.
- Nothing is published without a human check of the source page.
