# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ltao168169/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ltao168169/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every rankable protocol DefiLlama tracks that still records no token, ranked by the implied value of its future launch. The board covers the whole findable universe — the 40-protocol watchlist plus all 186 rankable pre-token protocols below the watchlist floor, 226 rows in all, with no top-N cut — each with a risk tier, a risk-adjusted value, and a seven-step farm plan. The model (radar-3) scores every row from the snapshot's own figures — TVL, seven-day growth, age with no token, sector, and chain count — and never special-cases a name. Live-token protocols are shown separately with the market's own values. The dashboard is a static page with zero network requests.

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

- **Sector multiple:** 0.35 for RWA, basis trading, prediction markets, AI and restaking; 0.30 for risk curators, capital allocators and yield; 0.25 for DEXs, lending, CDPs and staking; 0.18 for chains, payments and stablecoin issuers; 0.22 for everything else. The band is narrow on purpose — TVL still decides the ranking.
- **Growth:** the 7-day TVL change, clamped to −60%…+120%.
- **Maturity:** 0.6 for a brand-new protocol rising to 1.0 at three years, so a long track record with no token counts for more. Unknown age counts as one year.
- **Chain factor:** +2% per extra chain, up to 10%.
- **Risk:** scored from the same figures — a sharp 7-day move, a listing under a year old or unknown, TVL under $100M, a single chain, and a volatile sector each add a point. LOW is 0–2, MEDIUM 3–4, HIGH 5–6, with the reasons printed on every row's detail view. The risk-adjusted value discounts the implied value by half the row's risk score (points out of 6), so a risky row reads lower than a steady one at the same implied value; it never changes the ranking.
- **Coverage:** the board ranks every rankable pre-token protocol in the snapshot — the 40-protocol watchlist plus all 186 rankable protocols below the floor, 226 rows, no top-N cut. 53 pre-token records are not ranked: 42 exchanges and 11 versioned pools of another protocol.

## Files

- `main.ts` — entry point; reads the snapshot, writes the outputs, refuses a bad board.
- `lib/model.ts` — the model: scoring, risk, risk-adjusted value, farm plans, board validation.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied verbatim from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js` (33 KB total, no network).
- `screenshots/` — the three screenshots the judge sees: board, protocol detail, filtered view.
- `out/` — the last local run's `board.json` and `data.js` (generated; `dossier.json` is regenerated once the final screenshots are in).

Data: DefiLlama public protocol snapshot, sealed 2026-11-14. Board: 226 rows — 40 watchlist + 186 early. Top implied value: Steakhouse Financial, about $718M. Total implied value across the board: about $3.86B. Risk tiers: LOW 142 / MEDIUM 82 / HIGH 2.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8h44qzp6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
