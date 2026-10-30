# Townsworth

**When a data center, chip fab or nuclear plant comes to town, its community fund usually buys a generic plan. Townsworth checks that plan line by line against the places the host town actually goes, ranked by Qloo's local affinity (how strongly locals favour them). It keeps the institutions the plan already names, adds the local places residents actually go that AI alone never names (84% of its local partners, measured 2026-10-29; the live `/proof` page recomputes it on every visit), and returns a costed, resident-ranked 24-month program of local partners and host venues. Every item is traceable to its Qloo signal.**

For community-affairs teams at hyperscalers, developers, fabs and utilities.

## The number (measured 2026-10-29)
The table below is a dated measurement; the live `/proof` page recomputes these figures on every visit.

We asked OpenAI `gpt-5.4-mini`, with no Qloo access, to write the community plan a consultant would write for six real host towns, and froze those plans (SHA-256 in `data/baseline-latest.json`) before measuring.

| Finding | Value |
|---|---|
| Partners AI alone named that we could confirm exist (Qloo or OpenStreetMap, 25 km) | 51% |
| Partners that are institutions: AI alone vs Townsworth | 74% vs 35% |
| Townsworth local partners AI alone never named | 84% |
| Picks that change without Qloo's taste ranking (same places ordered by distance) | 3% (1 of 30 across six towns) |

A wiring check (partners found in their own town's Qloo places 100% vs another town's 0%) holds by construction. It confirms the wiring and is not a finding.

**What it shows:** AI alone knows a town's institutions (the college, the district, the library, the chamber), and Townsworth keeps them. Qloo adds the places the town actually goes, and those are mostly places AI alone never names. The affinity row is honest and modest: once venue fit and host-community rules apply, Qloo's ranking changes about one pick in 30. These are the 2026-10-29 figures; `/proof` recomputes them from live Qloo data on every visit, so they can move a point or two as Qloo's data updates. **What it doesn't show:** that residents value the program more, or anything about acceptance or approval. It's six towns and one model, so read it as a directional check.

**Live app:** https://townsworth.vercel.app (no login).

## Start here (two minutes)
The guided path is at `/judges`.
1. Open `/town/mount-pleasant-wi`: the AI-written plan, checked line by line. Real partners and named institutions are kept. Items that name nothing local are struck, and a local host venue or supplier is put in their place.
2. Click **why?** on any replacement to see the Qloo signal behind it.
3. Open the commitments memo, download the partner sheet (CSV) and calendar (.ics), and click **Draft outreach** to run the OpenAI agent.
4. **Send the shortlist to residents** from the memo: rank the grants and events in the resident ballot, then see the committee tally. The tally uses 120 simulated sample ballots plus yours, and every screen says so. Your ballot stays in your browser.
5. **Type any US or Canadian town** in the header (try *Taylor, Texas*, a chip fab, or *St. Thomas, Ontario*, a battery plant). It checks the typical consultant template, or click **Have AI write a draft now** to have OpenAI write a fresh draft live (about 20 s) and check that.
6. Switch towns in the header. Kemmerer, WY shows the plan with limited local data.

## Who pays, and why now
- **The buyer:** the community-affairs or host-community lead at a hyperscaler, developer, fab or utility. They already run these funds: Micron's $500M/20-year Green CHIPS fund ([ESD](https://esd.ny.gov/green-chips-community-investment-fund)), Frederick County MD's $110M+ data-center CBA ([MACo, Sep 2026](https://conduitstreet.mdcounties.org/2026/09/02/frederick-secures-110m-community-benefits-agreement-for-data-center-campus/)), Swatara Township PA's $120.3M package ([Blackridge, Oct 2026](https://www.blackridgeresearch.com/news-releases/swatara-township-approves-usd-120-3-million-community-benefits-package-for-two-proposed-data-centers)).
- **The volume:** 539 US data-center buildings are under construction and 2,386 more are planned ([Cleanview, Oct 27 2026](https://cleanview.co/public/data-centers/us)), about $425B of active construction ([Industrial Info, Oct 2026](https://www.industrialinfo.com/news/article/us-data-center-construction-starts-still-soaring-despite-some-bumps-in-the-road--363883)).
- **The cost of getting it wrong:** Data Center Watch counts about $130B of projects blocked or delayed by local opposition in Q1 2026 alone ([Data Center Watch](https://datacenterwatch.org/q1-2026)).
- **Pricing hypothesis (not validated):** a per-project annual licence, set against civic-engagement software that publishes £13,200–£35,200 a year (EngagementHQ, [G-Cloud 15](https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/92418/394920096965516-pricing-document-2026-01-29-1924.pdf)). That's a rounding error next to a nine-figure fund. We have not yet talked to a paying buyer.

## How Qloo drives it
- `GET /v2/insights` with `filter.type=urn:entity:place` + `filter.location=POINT(lon lat)` + radius **+ `signal.location=POINT(...)`** gives the candidate local places, **ranked by Qloo's local affinity**, with categories, rating, event space and distance. Partners are chosen host community first, then by affinity rank ("#4 by local affinity of 50 Qloo places within 15 km"). Distance only breaks ties.
- `signal.location=POINT(...)` for brands, artists, TV and podcasts gives the tastes that stand out locally. "Distinct" means it's absent from the national top 50 and from every big-metro reference list. Taste types that still lean national are shown as such and don't drive program items.
- About 25 Insights calls per town, plus four for the age-group check. The town page shows the call log ("Qloo calls: 25 · all OK"), and a Qloo error is reported as an error, never as thin data.
- Point queries, not town names: in our tests, town-name queries silently resolved to the wrong place for 6 of 22 hosts.

## How Townsworth uses Qloo
Every production call is server-side REST against the Insights API. Each one changes something you can see in the product.

| Call | Key parameters | What it changes |
|---|---|---|
| `GET /v2/insights` (places) | `filter.type=urn:entity:place`, `filter.location=POINT(lon lat)`, `filter.location.radius=15000`, `signal.location=POINT(lon lat)`, `take=50` | The candidate venues and grant applicants, ranked by local affinity. Thin towns get one by-distance top-up without `signal.location`. |
| `GET /v2/insights` (taste) | `filter.type=urn:entity:brand\|artist\|tv_show\|podcast`, `signal.location=POINT(lon lat)`, `take=20` | What the town favours: event themes, a local team's watch party, where to announce the program. |
| `GET /v2/insights` (national baseline) | same types, `signal.location.query=United States\|Canada`, `take=50`, plus the same taste query at big-metro reference points | What is distinctly local: anything in the national top 50 or a big-metro list doesn't count as a local signal. |
| `GET /v2/audiences` | `filter.parents.types=urn:audience:life_stage` | Looks up the "Parents With Young Children" life stage at runtime, for the families check. |
| `GET /v2/insights` (age groups) | the places query with `take=15` and one of `signal.demographics.age=24_and_younger`, `signal.demographics.age=55_and_older`, `signal.demographics.audiences=<life-stage id>` | Whether the program includes a place young adults (under 25), older residents and families with young children favour. If none of its partners is in a group's top 15, one session at that group's best-ranked hall, library, park, museum, zoo, school or college is earmarked from the reserve. Only these three groups are ever queried. |
| `GET /search` (`/check` only) | `query=<venue name>`, `types=urn:entity:place`, `filter.location=<lat>,<lon>`, `filter.radius=25`, `take=5`, never cached | A venue a pasted plan names becomes verified ("Qloo knows this place · N km") when Qloo has the same place within 25 km. Up to 8 names per check; the plan text itself is never sent. |

To repeat a town's calls by hand, Qloo's CLI takes the same parameters (point it at the API host the app uses first):

```bash
export QLOO_BASE_URL=https://hackathon.api.qloo.com QLOO_TRUSTED_BASE_URL=https://hackathon.api.qloo.com
npx -y @qloo/qloo-harness api insights -t place --json \
  --params '{"filter.location":"POINT(-87.8836 42.7117)","filter.location.radius":15000,"signal.location":"POINT(-87.8836 42.7117)","signal.demographics.age":"55_and_older","take":15}'
npx -y @qloo/qloo-harness api search -q "Racine Zoo" -t place -n 5 --json --params '{"filter.location":"42.7117,-87.8836","filter.radius":25}'
```

## The trust split
- **The model proposes; code decides.** Partner choice, bucket, allocation and every audit verdict are deterministic rules over Qloo fields.
- **The OpenAI agent** (`src/lib/agent.ts`) calls tools: `get_program`, `local_places`, `local_taste` and `check_partner`. It chooses up to three partners across program areas and gives a reason for each. It confirms each partner **independently on OpenStreetMap**, so a check can fail and the agent drops partners it can't confirm, then drafts the outreach.
- **Every draft is rule-checked:**
  - it must name the sponsor company in the body and the signature;
  - no zoning, hearing or approval language, no politics, religion or dollar amounts;
  - no partner outside the program.

  Failing drafts are replaced with a labelled template.

## Guardrails (Qloo SAFE_USE)
- Aggregate signals only. No personal data is sent to Qloo, and residents' ballot data never leaves the app. On `/check`, Qloo receives the town's coordinates and the venue names the pasted plan mentions, never the plan text.
- The age-group check uses only Qloo's aggregate place affinities for three groups (young adults under 25, older residents, families with young children). No resident is scored, and no other demographic is ever requested.
- Political and religious results are excluded from plan items. Identity and inclusivity tags are never used as signals; businesses carrying them stay eligible.
- Not persuasion: nothing is timed to a vote, hearing or permit. Material commitments (jobs, power, water, noise, tax) come first. For the preset towns they're pre-filled from cited public reporting (`data/commitments.json`); everywhere else they're entered from the developer's filings.
- Disclosure: every outreach draft and the resident ballot name the funding company.

## What we'll tell you before you find it
- Fund sizes are illustrative unless a public figure exists (Micron's $500M/20 years; Bruce Power's reported CAD $2M+/yr).
- Amounts are sessions × a unit cost for instructors, stipends, childcare and venue hire. Venues are hosts, not payees, and grants are capped per grantee. Whatever isn't itemized shows as "Reserve, for the committee", so totals always reconcile. None of this is Qloo output.
- Partner availability and willingness are not confirmed. Drafts are drafts; nothing is sent.
- Metro-suburb artist signals are weak (they lean national). Places and brands carry the local signal.
- The six towns are presets with known coordinates, and only they are in the /proof measurement. Typed-in towns are geocoded with OpenStreetMap Nominatim. Their live LLM drafts are labelled live and never enter the frozen proof set.
- The age-group check says whether the program includes places each group favours in aggregate, not who would attend. Sessions it adds are earmarked from the reserve and change none of the figures above.
- The resident ballot's tally is simulated (seeded random ballots). It shows how the ranking works and predicts nothing about real residents.

## Integrations
No account connection is needed, and nothing is sent or written to anyone's account automatically. Each integration is a link or a file you open yourself.
- **Calendars:** every scheduled session has "Add to Google Calendar" and "Outlook" links, and the whole program downloads as one `.ics` file. Both use the same date code, so they always agree.
- **Email:** each outreach draft opens prefilled in Gmail or Outlook compose, or downloads as an `.eml`. The recipient is left blank because we don't have partner email addresses. Long drafts are shortened in the compose link to fit URL limits, and the `.eml` keeps the full text.
- **CRMs:** the partner sheet downloads as a HubSpot Companies import CSV or a Salesforce Accounts import CSV (`/api/export/<town>?format=hubspot|salesforce`). The column names follow each vendor's import docs. Each partner's program role, bucket, distance and Qloo signal go in the description. Cells that a spreadsheet would read as a formula are escaped.

## Run locally
```bash
cp .env.example .env.local   # QLOO_API_KEY, OPENAI_API_KEY, OPENAI_MODEL
npm install
npm run dev -- -p 4317       # http://localhost:4317
npx tsx --env-file=.env.local scripts/freeze-baseline.ts   # optional: re-freeze the AI-alone baseline
```
Qloo responses are cached privately by Next's server data cache and never written to the repository.

## License
MIT
