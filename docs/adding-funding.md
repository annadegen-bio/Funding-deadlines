# Adding funding opportunities

Every route ends the same way: someone checks the funder's own page, the entry goes in through a
pull request, and it goes live when it is merged.

## 1. Send the link to Claude

Paste one or more links into a Claude Code session on this repo, with any notes ("relevant for
ATMP start-ups"). Claude checks the page, writes the entry, and opens a pull request.

## 2. Suggestions from colleagues and visitors

The *Suggest funding* section at the bottom of the overview opens an email to
secretariaat@utrechtholdings.nl with a short template (name, link to the official page,
deadline, who can apply, why it is relevant). The secretariat forwards suggestions to whoever
maintains the overview, or pastes them into a Claude Code session (route 1).

## 3. Edit the data yourself on GitHub

1. Open `data/opportunities.yaml` on GitHub and click the pencil icon.
2. Copy the template below to the end of the file and fill it in. Field rules are at the top of
   the file and in `rules/funding-rules.md`; allowed values are in `data/taxonomy.yaml`.
3. Choose **Create a new branch and start a pull request**.
4. Wait for the check. If it fails, the log names the field that is wrong (e.g. a date not
   written as YYYY-MM-DD, or a topic that isn't in the taxonomy).
5. Merge when it is green.

```yaml
- id: short-unique-name                 # lowercase, hyphens
  title: Name of the funding
  funder: Organisation
  url: https://the-funders-own-page      # never an aggregator
  summary: >-
    One or two sentences on what it funds.
  amount: "Up to €… "                    # optional
  areas: [life-sciences]                 # or [any]
  stages: [valorisation]                 # research | valorisation | transition | venture
  flags: []                              # e.g. [oncology, atmp]
  funding_type: grant                    # grant | fellowship | loan | prize | programme | equity | tax
  eligibility:
    applicants: [researcher]
    requires: []
    utrecht: Who in Utrecht can apply, and any catch.
  deadlines:                             # leave as [] if there is no date yet
    - { date: 2027-03-01, time: "14:00", tz: Europe/Amsterdam, label: full proposal }
  source_quote: "The deadline sentence copied from the funder's page"
  # rolling: true                        # apply any time (add rolling_note)
  # next_round: "Expected spring 2027"   # when no date is published yet
  last_verified: 2026-11-06              # the day you checked the page
```

## Good places to look for leads

- The [TTT funding tool](https://tech-transfer.nl/en/fundingtool/) (Thematische Technologie
  Transfer): about 120 Dutch and EU instruments by phase. Many are regional funds for other
  provinces or private venture funds. Pick what Utrecht groups can use, and verify on the funder's page.
- `node scripts/eu-candidates.mjs > candidates/eu-topics.md`: open EU calls not yet included.
- The calls pages of NWO, ZonMw, KWF, Health~Holland and RVO, the EIC and ERC.
