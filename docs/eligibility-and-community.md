# Eligibility questions and ideas for the community

## What the website asks now

All questions are optional, the answers never leave the visitor's browser, and nothing is
excluded on a missing answer.

| Question | Why it matters | Example schemes it decides |
|---|---|---|
| Applying as (researcher, PhD, student, founder without company, start-up, SME) | The single biggest filter | Take-off 1 (researchers) vs. VFF (companies) |
| Organisation (UU, UMC Utrecht, HU, Hubrecht, Máxima, …) | Some schemes are institution-bound | Make It Matter voucher (UU/UMCU only); RAAK (HU) |
| Years since PhD | Career-stage windows | ERC StG 2–7, CoG 7–12; MSCA PF |
| Company age | Many start-up schemes stop at 3–5 years | VFF starters (≤5 y), ESA BIC (≤5 y) |
| Age | A few awards have age limits | EU Rising Innovators (under 35) |
| Gender (optional, "prefer not to say" default) | Only to surface women-focused schemes, never to hide others | Women TechEU, EU Prize for Women Innovators |
| Holds an ERC / NWO / ZonMw grant | Follow-on schemes require one | ERC Proof of Concept, Impact Explorer |
| Company partner on board | PPP schemes need one | Health~Holland MKB, Open Technology Programme |

## Questions worth adding later

In order of how much they would sharpen the results:

1. **"Is there IP or a patent application?"** Several valorisation schemes require patentable IP
   (Make It Matter) or expect an FTO analysis (EIC Accelerator).
2. **"Do you have (or need) international partners?"** It separates Horizon Europe consortium
   calls from national single-applicant schemes.
3. **Technology readiness level (TRL 1–9)** as a slider. It lines up neatly with the stages and
   with EU instrument rules.
4. **Amount needed / dilutive OK?** Start-ups often want to see non-dilutive money first.
   `funding_type` already carries this.
5. **Nationality / residence.** Only a handful of schemes care (e.g. Postcode Lottery Green
   Challenge: NL, DE, GB, NO, SE). Worth adding only once several entries depend on it.

Ethnicity and other sensitive personal data: **don't ask**. No current scheme in scope needs it,
and asking would put people off.

## What would help the research and valorisation community most

- **Internal deadlines.** UU and UMC Utrecht run internal reviews for ERC, NWO Talent and some EU
  calls, weeks before the funder's deadline. A `internal_deadline` field per entry (filled by
  the RSOs) would prevent the most common miss.
- **"Who to talk to in Utrecht"** per scheme: RSO contact for research grants, Utrecht Holdings
  business developer for valorisation, UtrechtInc for programmes.
- **Utrecht track record.** "Utrecht won 3 ERC PoCs in 2026" tells a researcher a scheme is
  realistic, and who to ask for a sample proposal.
- **Effort and odds.** Indicative success rate and proposal length (a 2-page voucher vs. a
  70-page Horizon proposal) help people choose.
- **A monthly digest** of new and closing opportunities, generated from the same data (the
  existing Friday events digest could take a funding section).
- **Matchmaking for consortium calls.** A "looking for partners" note on Horizon entries,
  connected to the Utrecht network.
