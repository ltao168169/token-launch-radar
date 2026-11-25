# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ltao168169/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ltao168169/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every rankable protocol DefiLlama tracks that still records no token, ranked by the implied value of its future launch. The board covers the whole findable universe — the 40-protocol watchlist plus all 186 rankable pre-token protocols below the watchlist floor, 226 rows in all, with no top-N cut — each with a risk tier, a risk-adjusted value, and an eight-step farm plan. The model (radar-4) scores every row from the snapshot's own figures — TVL, seven-day growth, age with no token, sector, and chain count — and never special-cases a name. New in radar-4: the sector multiples are **calibrated from the snapshot itself** (see below), every detail view walks its row through the formula step by step, two protocols can be compared side by side, and a verification section reconciles the board's coverage against the snapshot record by record, naming all 116 pre-token records the board does not rank. Live-token protocols are shown separately with the market's own values. The dashboard is a static page with zero network requests.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input token-radar-01-kit/input/snapshot.json
```

Requires Node 22 or newer, standard library only — no install, no build, no network. It reads the sealed snapshot, writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory. Two runs over the same snapshot write byte-identical outputs.

## How the model works

```
implied = TVL × sector multiple × (1 + clamped 7-day growth × 0.5) × maturity × chain factor
risk-adjusted = implied × (1 − 0.5 × risk score)
```

- **Sector multiple — calibrated, not stated.** Every launched protocol in the same snapshot that carries a market cap (119 of them; exchanges excluded, because an exchange token is not a protocol launch) states a market-cap-to-TVL ratio. A sector band's multiple is the median ratio of its launched protocols, shrunk toward the snapshot-wide median (0.246) by sample count and clamped to 0.10–0.50 so TVL still decides the ranking. The calibration the build measured from this snapshot:

  | Band | Sectors | Samples | Median mcap/TVL | Multiple |
  |---|---|---|---|---|
  | A | RWA, basis, prediction, AI, restaking, launchpads | 25 | 0.321 | 0.303 |
  | B | Risk curators, capital allocators, CeDeFi, yield | 18 | 0.182 | 0.202 |
  | C | DEXs, lending, CDPs, liquid staking, insurance | 43 | 0.132 | 0.150 |
  | D | Chains, bridges, payments, stablecoin issuers, indexes | 21 | 0.367 | 0.333 |
  | E | Everything else | 12 | 1.173 | 0.500 (clamped) |

  A band with no launched sample would keep the stated radar-3 multiple and say so; in this snapshot every band has samples. Each row's detail view names its band and the sample count behind its multiple.
- **Growth:** the 7-day TVL change, clamped to −60%…+120%.
- **Maturity:** 0.6 for a brand-new protocol rising to 1.0 at three years, so a long track record with no token counts for more. Unknown age counts as one year.
- **Chain factor:** +2% per extra chain, up to 10%.
- **Risk:** scored from the same figures — a sharp 7-day move, a listing under a year old or unknown, TVL under $100M, a single chain, and a volatile sector each add a point. LOW is 0–2, MEDIUM 3–4, HIGH 5–6, with the reasons printed on every row's detail view. The risk-adjusted value discounts the implied value by half the row's risk score (points out of 6), so a risky row reads lower than a steady one at the same implied value; it never changes the ranking.
- **Coverage, reconciled:** the snapshot holds 758 protocols. 416 already record a token and are never ranked (the Live token view shows the top 24 by market cap). Of the 342 that record no token, the board ranks 226 (40 watchlist + 186 early) and does not rank 116: 42 exchanges, 11 versioned pools of another protocol, and 63 above the watchlist floor that the snapshot's own watchlist sets aside — bridges and wrapped or staked products of tokens that already trade (WBTC, Binance staked ETH and their kin), which the brief excludes. The dashboard's verification section prints the snapshot's SHA-256 and names all 116, so the coverage claim can be audited name by name.

## Files

- `main.ts` — entry point; reads the snapshot, writes the outputs, refuses a bad board.
- `lib/model.ts` — the model: calibration, scoring, risk, risk-adjusted value, eight-step farm plans, the reconciliation, board validation.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied verbatim from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js` (46 KB total, no network). Sortable/filterable board, per-protocol detail with a step-by-step value breakdown, a two-protocol compare view, and the verification section.
- `screenshots/` — the three screenshots the judge sees: board, protocol detail (full panel, all eight farm steps), filtered view.
- `out/` — the last local run's `board.json` and `data.js` (generated; `dossier.json` is regenerated once the final screenshots are in).

Data: DefiLlama public protocol snapshot, sealed 2026-11-14 (SHA-256 `42a71213519479f3a180cc5010cbbf6bd18a2447fa0ad29e4c5122b6c9184393`). Board: 226 rows — 40 watchlist + 186 early. Top implied value: Steakhouse Financial, about $483M. Total implied value across the board: about $2.95B; total risk-adjusted: about $2.73B. Risk tiers: LOW 142 / MEDIUM 82 / HIGH 2.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8h44qzp6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
