# Good Neighbor

**When a data center, chip fab or nuclear plant comes to town, its community fund usually buys a generic plan. Good Neighbor red-pens that plan against what the host town actually over-indexes on, using Qloo, and returns a costed, resident-ranked 24-month program of local partners, venues and events. Every item is traceable to its Qloo signal.**

For community-affairs teams at hyperscalers, developers, fabs and utilities. Built for the Qloo Agentic Hackathon 2026.

## The number (recomputed on every load at `/proof`)
We asked OpenAI `gpt-5.4-mini`, with no Qloo access, to write the community plan a consultant would write for six real host towns, and froze those plans (SHA-256 in `data/baseline-latest.json`) before measuring.

| Finding | Value |
|---|---|
| LLM-named partners verified real (Qloo or OpenStreetMap, 25 km) | 58% |
| Institutions among partners: plain LLM vs Good Neighbor | 70% vs 8% |
| Good Neighbor partners the plain LLM never named | 96% |
| Negative control: partners found in their own town vs a different town's Qloo places | 100% vs 0% |

**What it shows:** the plain LLM knows a town's institutions (the college, the district, the library, the chamber). Qloo knows where the town actually goes. **What it doesn't show:** that residents value the program more, or anything about acceptance or approval. It's six towns and one model, so read it as a directional check.

## Start here (90 seconds)
1. Open `/town/mount-pleasant-wi`: the plain-LLM plan, audited item by item. Real partners are kept; generic items are struck and replaced.
2. Click **why?** on any replacement to see the Qloo signal behind it.
3. Open the commitments memo, download the partner sheet (CSV) and calendar (.ics), and click **Draft outreach** to run the OpenAI agent.
4. Switch towns in the header. Kemmerer, WY shows the honest thin-data case.

## How Qloo drives it
- `GET /v2/insights` with `filter.type=urn:entity:place` + `filter.location=POINT(lon lat)` + radius gives the candidate local partners, with categories, rating, event space and distance.
- `signal.location=POINT(...)` for brands, artists, TV and podcasts gives what the town distinctly over-indexes on. "Distinct" means it's absent from the national top 20 and from ≥2 big-metro reference lists.
- Point queries, not town names: in our tests, town-name queries silently resolved to the wrong place for 6 of 22 hosts.

## The trust split
- **The model proposes; code decides.** Partner choice, bucket, allocation and every audit verdict are deterministic rules over Qloo fields.
- **The OpenAI agent** (`src/lib/agent.ts`) calls tools: `get_program`, `check_partner`, `local_places`, `local_taste`. It only drafts the memo summary and outreach emails. Every draft is rule-checked: no votes, permits, politics, religion or dollar amounts, and no partner outside the program. Failing drafts are replaced with a template and labelled.

## Guardrails (Qloo SAFE_USE)
- Aggregate signals only. No personal data is sent to Qloo, and residents' ballot data never leaves the app.
- Political and religious results are excluded from plan items. Identity and inclusivity tags are never used as signals; businesses carrying them stay eligible.
- Not persuasion: nothing is timed to a vote, hearing or permit. Material commitments (jobs, power, water, noise, tax) come first and are entered from the developer's filings.

## What we'll tell you before you find it
- Fund sizes are illustrative unless a public figure exists (Micron's $500M/20 years; Bruce Power's reported CAD $2M+/yr). Amounts are item budgets split by fixed policy shares, not Qloo output.
- Partner availability and willingness are not confirmed. Drafts are drafts; nothing is sent.
- Metro-suburb artist signals are weak (they lean national). Places and brands carry the local signal.
- The six towns are presets with known coordinates.

## Run locally
```bash
cp .env.example .env.local   # QLOO_API_KEY, OPENAI_API_KEY, OPENAI_MODEL
npm install
npm run dev                  # http://localhost:3000
npx tsx --env-file=.env.local scripts/freeze-baseline.ts   # optional: re-freeze the plain-LLM baseline
```
Qloo responses are cached privately by Next's server data cache and never written to the repository.

## License
MIT
