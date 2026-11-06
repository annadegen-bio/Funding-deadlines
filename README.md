# Utrecht Funding & Deadlines

A curated overview of funding for Utrecht researchers and start-ups, from research grants and
proof-of-concept money to transition funding and early-stage pitch competitions. Each
opportunity links to the funder's own page, carries a verified deadline (date, time, time zone)
and an eligibility note written for Utrecht.

It is the companion to the two Science-to-Impact **event** calendars. Funding is not an event,
so it gets its own page, its own rules and calendar feeds people can **subscribe** to, filtered
by topic and stage, with reminders before each deadline.

## How it works

```
data/opportunities.yaml ──► npm run build ──► dist/  (published on GitHub Pages every push + nightly)
data/taxonomy.yaml                              ├─ index.html, app.js, style.css   the website
data/config.yaml                                ├─ data/opportunities.json         data for site + worker
                                                ├─ feeds/<area>/<stage>.ics        80 subscribable feeds
                                                └─ ics/<id>/<date>.ics             one file per deadline
```

- **One data file.** Everything (website, feeds, downloads) is generated from
  `data/opportunities.yaml`. Fix a date there and every subscriber's calendar follows within a day.
- **Subscriptions** (preset): every area × every stage, with or without ⏰ reminder entries.
  Google Calendar and Outlook ignore alarms in subscribed calendars, so the ⏰ entries are what
  actually reminds people there. Apple Calendar also keeps the alarms.
- **Downloads** (one deadline or a whole filtered selection): real alarms at the visitor's own
  reminder times (default 6 weeks and 1 week).
- **Any filter combination and custom reminders in a subscription:** deploy the optional worker
  in `worker/` (free Cloudflare tier). Until then the site offers the nearest preset feed plus
  a download.
- **Rolling schemes** don't clutter the calendar. They are listed under "Open year-round" on the
  site, and each feed gets one 🔁 check-in entry per quarter listing the rolling schemes that match it.
- **Eligibility check:** optional questions on the site (role, career stage, company age, …)
  that never leave the browser. See `docs/eligibility-and-community.md`.

## Read before editing

0. `docs/adding-funding.md`: how to add or suggest funding (three routes, copy-paste template).
1. `rules/funding-rules.md`: what belongs, how to record a deadline, statuses.
2. `data/taxonomy.yaml`: allowed areas, stages, topic flags, funding types.
3. `data/opportunities.yaml`: the entries (field guide at the top).

```bash
npm install
npm run validate   # checks links, dates, vocabularies, verification age
npm test           # calendar-file and filter logic
npm run build      # writes dist/
npm run serve      # build and preview at http://localhost:8080
node scripts/eu-candidates.mjs > candidates/eu-topics.md   # EU topics not yet included, for review
```

## Set-up checklist

- [x] **Enable GitHub Pages:** Settings → Pages → Source: *GitHub Actions*. The workflow in
      `.github/workflows/pages.yml` then publishes on every push to the default branch and nightly.
- [ ] **Decide the permanent address before announcing feeds.** Subscribers' calendars store the
      feed URL. If the repo moves to an organisation account or gets a custom domain (e.g.
      `funding.utrechtholdings.nl`), update `base_url` in `data/config.yaml` and the two URLs in
      `wordpress/funding-block.html` first.
- [ ] **WordPress:** create a *Funding* page and paste `wordpress/funding-block.html` into a
      Custom HTML block. Content updates need no further WordPress edits.
- [x] Contact link: secretariaat@utrechtholdings.nl (`contact_url` in `data/config.yaml`).
- [ ] Optional: deploy `worker/` and set `worker_url`.
- [ ] Adjust `--uhf-accent` in `site/style.css` to the Utrecht Holdings brand colour.

## Current content (6 November 2026)

72 opportunities, each checked against the funder's own page (63 on 4 November, 9 added on
6 November, including leads from the TTT funding tool and the UMC Utrecht Ureka Mega Challenge).
Sources include Utrecht Holdings, UtrechtInc, UMC Utrecht, ROM Utrecht Region, NWO, ZonMw, KWF,
Hanarth Fonds, Hartstichting, Health~Holland, Biotech Booster, Faculty of Impact, Mibiton, RVO,
ERC, EIC, MSCA, Horizon Europe, Hello Tomorrow, ESA BIC, ClimateLaunchpad, Gates Grand Challenges
and the Michael J. Fox Foundation. `candidates/eu-topics.md` lists further EU topics to review.
