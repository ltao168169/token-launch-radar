# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ltao168169/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ltao168169/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every rankable protocol DefiLlama tracks that still records no token, ranked by the implied value of its future launch. The board covers the whole findable universe — the 40-protocol watchlist plus all 186 rankable pre-token protocols below the watchlist floor, 226 rows in all, with no top-N cut — each with a risk tier, a risk-adjusted value, and an eight-step farm plan. The model (radar-5) scores every row from the snapshot's own figures — TVL, seven-day growth, age with no token, sector, and chain count — and never special-cases a name.

New in radar-5, all of it aimed at making the numbers arguable-with rather than merely stated:

- **A scenario range on every row.** The sector multiple is borrowed from the band's launched protocols, whose market-cap-to-TVL ratios are wildly dispersed — so beside the median multiple that sets the base value, each band is also priced at its 20th-percentile (bear) and 80th-percentile (bull) launch ratios. A row reads as a range, not a point: Steakhouse Financial is $483M at base, $120M bear, $2.74B bull.
- **A confidence score on every row** (0–100, from five stated parts: band evidence, record completeness, scale, weekly stability, track record). It grades the evidence behind the number, never the protocol — and the detail view prints the parts.
- **A cross-check of the model against the snapshot's own launched protocols.** The 119 launched protocols are split in two by slug hash, each half calibrated on the other, and every one is scored as if still pre-token and compared with the market cap it actually carries. Out of sample: the model ranks them at Spearman 0.451 against raw TVL's 0.413; the median launch is worth 1.41× its base value (the base case runs conservative, by design of its tight clamp); 54 of 119 land inside their scenario range. The dashboard prints all of it, including the weakest band, next to the caveats.
- **A shortlist and an avoid list, by stated rules.** The shortlist is the eight highest risk-adjusted values among rows whose risk is not HIGH and whose confidence is at least 50 — Steakhouse Financial, Gauntlet, Veda, USDD, Upshift, OnRe, OpenTrade, Plume Vaults — priced as one basket ($1.48B base, $368M bear, $8.40B bull). The avoid list names the highest-value rows that fail a test (HIGH risk, low confidence, or a 30%+ weekly fall), each with its reason.
- **A sensitivity note on every row**: which assumption its value leans on hardest — for this snapshot's rows, the sector multiple — and by how much it can move the number.

Live-token protocols are shown separately with the market's own values. The dashboard is a static page with zero network requests.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input token-radar-01-kit/input/snapshot.json
```

Requires Node 22 or newer, standard library only — no install, no build, no network. It reads the sealed snapshot, writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory. Two runs over the same snapshot write byte-identical outputs.

## How the model works

```
base = TVL × sector multiple × (1 + clamped 7-day growth × 0.5) × maturity × chain factor
risk-adjusted = base × (1 − 0.5 × risk score)
bear = TVL × bear multiple × (1 + min(clamped growth, 0) × 0.5) × maturity × chain factor
bull = TVL × bull multiple × (1 + clamped 7-day growth × 0.5) × maturity × chain factor
```

- **Sector multiples — calibrated, not stated.** Every launched protocol in the same snapshot that carries a market cap (119 of them; exchanges excluded, because an exchange token is not a protocol launch) states a market-cap-to-TVL ratio. A band's base multiple is the median ratio of its launched protocols, shrunk toward the snapshot-wide median (0.246) by sample count and clamped to 0.10–0.50 so TVL still decides the ranking. Its bear and bull multiples are the same shrinkage applied to the band's 20th and 80th percentile ratios, clamped wider — 0.05–1.50 — because their job is to span what the band's launches actually did, not to rank. The calibration the build measured from this snapshot:

  | Band | Sectors | Samples | Median mcap/TVL | Bear × | Base × | Bull × |
  |---|---|---|---|---|---|---|
  | A | RWA, basis, prediction, AI, restaking, launchpads | 25 | 0.321 | 0.065 | 0.303 | 1.114 |
  | B | Risk curators, capital allocators, CeDeFi, yield | 18 | 0.182 | 0.050 | 0.202 | 1.145 |
  | C | DEXs, lending, CDPs, liquid staking, insurance | 43 | 0.132 | 0.050 | 0.150 | 1.313 |
  | D | Chains, bridges, payments, stablecoin issuers, indexes | 21 | 0.367 | 0.111 | 0.333 | 1.500 |
  | E | Everything else | 12 | 1.173 | 0.050 | 0.500 | 1.500 (clamped) |

  A band with no launched sample would keep the stated radar-3 multiple and say so; in this snapshot every band has samples. Each row's detail view names its band, the sample count behind its multiples, and all three scenario values.
- **Growth:** the 7-day TVL change, clamped to −60%…+120%. The bear case drops any growth credit and keeps only the downside.
- **Maturity:** 0.6 for a brand-new protocol rising to 1.0 at three years, so a long track record with no token counts for more. Unknown age counts as one year.
- **Chain factor:** +2% per extra chain, up to 10%.
- **Risk:** scored from the same figures — a sharp 7-day move, a listing under a year old or unknown, TVL under $100M, a single chain, and a volatile sector each add a point. LOW is 0–2, MEDIUM 3–4, HIGH 5–6, with the reasons printed on every row's detail view. The risk-adjusted value discounts the base value by half the row's risk score (points out of 6); it never changes the ranking.
- **Confidence:** five parts summed to 100 — band evidence (the band's calibration samples, 40 or more earns the full 30), record completeness (the snapshot records the row's 7-day change and listing date, 10 each), scale (TVL steps from $1B down), weekly stability (the size of the 7-day move), and track record (age). HIGH is 70+, MEDIUM 45–69, LOW under 45. Across the board: HIGH 73 / MEDIUM 146 / LOW 7.
- **The cross-check, honestly bounded:** it is cross-sectional — it compares a launched protocol's market cap today with its TVL today, not a launch-day price with a launch-day TVL, because the snapshot holds no history. Band E is the weakest line (12 held-out launches, median actual 2.34× base, 25% inside the range), and its rows' confidence scores already say so.
- **Coverage, reconciled:** the snapshot holds 758 protocols. 416 already record a token and are never ranked (the Live token view shows the top 24 by market cap). Of the 342 that record no token, the board ranks 226 (40 watchlist + 186 early) and does not rank 116: 42 exchanges, 11 versioned pools of another protocol, and 63 above the watchlist floor that the snapshot's own watchlist sets aside — bridges and wrapped or staked products of tokens that already trade (WBTC, Binance staked ETH and their kin), which the brief excludes. The dashboard's verification section prints the snapshot's SHA-256 and names all 116, so the coverage claim can be audited name by name.

## Files

- `main.ts` — entry point; reads the snapshot, writes the outputs, refuses a bad board.
- `lib/model.ts` — the model: calibration (median and percentile multiples), scoring, scenarios, sensitivity, confidence, risk, the cross-check, the curation, eight-step farm plans, the reconciliation, board validation.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied verbatim from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js` (63 KB total, no network). Sortable/filterable board with scenario range bars and confidence scores, per-protocol detail with a step-by-step value breakdown and scenario/confidence panels, a shortlist and avoid list, a two-protocol compare view, the cross-check section, and the verification section.
- `screenshots/` — the three screenshots the judge sees: board, protocol detail (full panel: scenario range, confidence breakdown, all eight farm steps), shortlist-filtered view.
- `out/` — the last local run's `board.json` and `data.js` (generated; `dossier.json` is regenerated once the final screenshots are in).

Data: DefiLlama public protocol snapshot, sealed 2026-11-14 (SHA-256 `42a71213519479f3a180cc5010cbbf6bd18a2447fa0ad29e4c5122b6c9184393`). Board: 226 rows — 40 watchlist + 186 early. Top base value: Steakhouse Financial, about $483M (bear $120M, bull $2.74B). Total base value across the board: about $2.95B (bear $0.73B, bull $16.08B); total risk-adjusted: about $2.73B. Risk tiers: LOW 142 / MEDIUM 82 / HIGH 2. Confidence: HIGH 73 / MEDIUM 146 / LOW 7.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8h44qzp6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
