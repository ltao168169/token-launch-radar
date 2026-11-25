// Token Launch Radar — value model, radar-4.
//
// One sealed DefiLlama snapshot in, one ranked board out. The board covers every rankable
// pre-token protocol in the snapshot: the watchlist (the floor, never a ceiling) plus every
// rankable protocol below the watchlist floor, so the radar's tail is the whole findable
// universe, not a top-N cut. A protocol is pre-token when its snapshot entry records no token
// at all (no market cap, no CoinGecko id, no symbol). Live-token protocols are kept apart
// and shown with the market's own values, never mixed into the ranked board. Pre-token
// records that are not ranked at all are exchanges (a CEX is not a launch to farm),
// versioned pools of another protocol (a name ending in a release marker), and the records
// above the watchlist floor that the snapshot's own watchlist sets aside — bridges and
// wrapped or staked products of tokens that already trade, which the bounty brief excludes
// and whose own call the board follows rather than second-guesses. The dashboard's
// verification section reconciles all of these counts against the snapshot, by name.
//
// Implied value follows only from the snapshot's own figures — TVL, seven-day growth, age
// with no token, category, and chain count. No protocol name is ever special-cased: the same
// function scores every row, and the constants below are the whole model, stated in the
// dashboard.
//
//   base        = tvl_usd x sectorMultiple(sector band)
//   growth      = clamp(change_7d, -60, 120) per cent
//   growthMult  = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity    = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age unknown: 365 days)
//   chainMult   = 1 + 0.02 x min(chains - 1, 5)            (multi-chain durability)
//   implied     = max(1, round(base x growthMult x maturity x chainMult))
//   riskAdjusted = max(1, round(implied x (1 - 0.5 x riskScore)))
//
// What radar-4 changes against radar-3: the sector multiple is no longer a stated constant.
// It is calibrated from the snapshot itself. Every launched protocol in the same snapshot
// that carries a market cap — exchanges excluded, since an exchange token is not a protocol
// launch — states a market-cap-to-TVL ratio; the multiple for a sector band is the median of
// those ratios inside the band, shrunk toward the snapshot-wide median by the band's sample
// count and clamped to [0.10, 0.50] so TVL still decides the ranking. A band with no launched
// sample in the snapshot falls back to the stated radar-3 multiple, and the row says so. So
// the model's one set of free parameters is measured from the snapshot's own launched
// protocols instead of asserted, and the dashboard prints the calibration table — band,
// sample count, median ratio, multiple used — next to the formula.
//
// The risk-adjusted value is the same implied value discounted for the row's own risk score
// (riskScore = risk points / 6, so 0 for a clean row and 1 for a row that scores every point).
// It never changes the ranking — the board is always ranked by implied value — but it tells
// a reader what the launch is worth once the row's risk is priced in, so a high-implied,
// high-risk row does not read the same as a high-implied, low-risk one.
//
// Why a sector multiple at all: sectors trade at different value per dollar of TVL. A risk
// curator or RWA vault and a plain chain do not command the same future token multiple, and
// the snapshot itself carries both the category and — through its launched protocols — the
// evidence for what each sector's multiple has been. The clamp band is deliberately narrow
// so TVL still decides the ranking; growth and maturity move a row within its sector.
//
// Risk is scored the same way, from the snapshot's own figures: a protocol is riskier when its
// seven-day move is large, when it is young or its listing date is unknown, when its TVL is
// small, when it lives on one chain only, and when its sector is a volatile one (basis trading,
// prediction markets, perps). The tier and the reasons are printed on the board, so a reader can
// see why a row is marked the way it is.

import { createHash } from 'node:crypto';

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document, with the SHA-256 of the exact text it was parsed from. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
  sha256: string;
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_bonus: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_max_bonus: 0.1,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** The risk discount on the risk-adjusted value: half the row's risk score, at most half the value. */
export const RISK_DISCOUNT = 0.5;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The five sector bands, most future-token value per TVL dollar first, as radar-3 stated them. */
export type SectorBand = 'A' | 'B' | 'C' | 'D' | 'E';

/** A band's short label, as the dashboard's calibration table prints it. */
export const BAND_LABELS: Record<SectorBand, string> = {
  A: 'RWA, basis trading, prediction markets, AI, restaking, launchpads',
  B: 'Risk curators, capital allocators, CeDeFi, yield',
  C: 'DEXs, lending, CDPs, liquid staking, insurance',
  D: 'Chains, bridges, payments, stablecoin issuers, indexes',
  E: 'Everything else',
};

/** The stated multiples radar-3 used, kept as the fallback for a band with no launched sample. */
export const STATED_MULTIPLES: Record<SectorBand, number> = { A: 0.35, B: 0.3, C: 0.25, D: 0.18, E: 0.22 };

/** The clamp on a calibrated multiple: narrow on purpose, so TVL still decides the ranking. */
export const MULTIPLE_MIN = 0.1;
export const MULTIPLE_MAX = 0.5;

/**
 * The shrinkage prior: a band's median counts for its sample count, and this many phantom
 * samples at the snapshot-wide median count against it, so a band with two wild samples does
 * not swing the board.
 */
export const SHRINK_PRIOR = 8;

/** One band's calibration: what the snapshot's launched protocols say its multiple is. */
export interface CalibrationBand {
  band: SectorBand;
  label: string;
  samples: number;
  median_ratio: number | null;
  multiple: number;
  source: 'calibrated' | 'stated';
}

/** The whole calibration: every band, plus the snapshot-wide figures the shrinkage leans on. */
export interface Calibration {
  samples: number;
  global_median_ratio: number | null;
  bands: CalibrationBand[];
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A protocol's risk tier, with the score and the reasons behind it. */
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  risk_adjusted_value_usd: number;
  risk_tier: RiskTier;
  risk_score: number;
  risk_reasons: string[];
  model: {
    base_multiple: number;
    base_value_usd: number;
    sector_band: SectorBand;
    calibration_samples: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  risk_adjusted_value_usd: number;
  risk_tier: RiskTier;
  risk_reasons: string[];
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  category_multiple: number;
  base_value_usd: number;
  sector_band: SectorBand;
  calibration_samples: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Why one pre-token record is not ranked, in the words the verification section prints. */
export type ExclusionReason = 'exchange' | 'versioned pool of another protocol' | 'above the floor, set aside by the snapshot watchlist';

/** One pre-token record the board does not rank, named so the coverage claim can be audited. */
export interface ExcludedRow {
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: ExclusionReason;
}

/** The reconciliation of the snapshot's records against the board, as the dashboard prints it. */
export interface Reconciliation {
  snapshot_protocols: number;
  live_token: number;
  live_with_market_cap: number;
  pre_token: number;
  ranked: number;
  watchlist_ranked: number;
  early_ranked: number;
  not_ranked: number;
  excluded_exchanges: number;
  excluded_versioned: number;
  excluded_above_floor: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist: string[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  snapshot_sha256: string;
  calibration: Calibration;
  reconciliation: Reconciliation;
  excluded: ExcludedRow[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The sector band a category belongs to. Sectors that historically command a higher
 * future-token value per dollar of TVL (real-world assets, basis trading, prediction
 * markets, AI, restaking) sit in band A; infrastructure and payments sit in band D. The
 * band decides which calibrated multiple a row gets — never the protocol's name.
 */
export function sectorBand(category: string | null): SectorBand {
  const c = (category ?? '').toLowerCase();
  if (
    c.includes('rwa') ||
    c.includes('basis') ||
    c.includes('prediction') ||
    c.includes('decentralized ai') ||
    c.includes('ai agent') ||
    c.includes('restak') ||
    c.includes('launchpad')
  ) return 'A';
  if (
    c.includes('risk curator') ||
    c.includes('capital allocator') ||
    c.includes('cedefi') ||
    c.includes('collateral') ||
    c.includes('governance incentive') ||
    c.includes('yield') ||
    c.includes('leveraged farm')
  ) return 'B';
  if (
    c.includes('dex') ||
    c.includes('lend') ||
    c.includes('cdp') ||
    c.includes('liquid staking') ||
    c.includes('stablecoin wrapper') ||
    c.includes('insurance') ||
    c.includes('staking pool')
  ) return 'C';
  if (
    c.includes('chain') ||
    c.includes('payment') ||
    c.includes('stablecoin issuer') ||
    c.includes('algo-stables') ||
    c.includes('indexes') ||
    c.includes('bridge') ||
    c.includes('cross chain')
  ) return 'D';
  return 'E';
}

/** The stated value multiple for one sector, radar-3's constants, kept as the calibration fallback. */
export function categoryMultiple(category: string | null): number {
  return STATED_MULTIPLES[sectorBand(category)];
}

/** The median of a non-empty list, the middle value or the mean of the two middle ones. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round3 = (n: number): number => Math.round(n * 1e3) / 1e3;

/**
 * The calibration: what multiple each sector band gets, measured from the snapshot's own
 * launched protocols. A launched protocol — one that already carries a market cap — states
 * a market-cap-to-TVL ratio; exchanges are left out, because an exchange token is not a
 * protocol launch and its ratio would teach the model the wrong lesson. A band's multiple
 * is its samples' median ratio, shrunk toward the snapshot-wide median with SHRINK_PRIOR
 * phantom samples and clamped to [MULTIPLE_MIN, MULTIPLE_MAX]. A band with no sample keeps
 * its stated radar-3 multiple and says so, so the model never silently invents a number.
 */
export function calibrateMultiples(snapshot: Snapshot): Calibration {
  const launched = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX',
  );
  const allRatios = launched.map((p) => p.mcap_usd! / p.tvl_usd);
  const globalMedian = allRatios.length > 0 ? median(allRatios) : null;
  const bands = (Object.keys(BAND_LABELS) as SectorBand[]).map((band) => {
    const ratios = launched.filter((p) => sectorBand(p.category) === band).map((p) => p.mcap_usd! / p.tvl_usd);
    if (ratios.length === 0 || globalMedian === null) {
      return {
        band,
        label: BAND_LABELS[band],
        samples: ratios.length,
        median_ratio: null,
        multiple: STATED_MULTIPLES[band],
        source: 'stated' as const,
      };
    }
    const med = median(ratios);
    const shrunk = (ratios.length * med + SHRINK_PRIOR * globalMedian) / (ratios.length + SHRINK_PRIOR);
    const multiple = round3(Math.min(MULTIPLE_MAX, Math.max(MULTIPLE_MIN, shrunk)));
    return {
      band,
      label: BAND_LABELS[band],
      samples: ratios.length,
      median_ratio: round3(med),
      multiple,
      source: 'calibrated' as const,
    };
  });
  return {
    samples: launched.length,
    global_median_ratio: globalMedian === null ? null : round3(globalMedian),
    bands,
  };
}

/** The chain-diversity multiplier: a protocol live on more chains is worth a little more. */
export function chainMultiplier(chains: string[], model: ModelConstants): number {
  const extra = Math.max(0, chains.length - 1);
  return Math.round((1 + Math.min(extra * model.chain_step, model.chain_max_bonus)) * 1e4) / 1e4;
}

/** The multipliers and the implied value one protocol gets under `model` and the calibrated `multiples`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiples: Record<SectorBand, number>,
): { implied: number; multiple: number; baseValue: number; band: SectorBand; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const band = sectorBand(protocol.category);
  const multiple = multiples[band];
  const chainMult = chainMultiplier(protocol.chains, model);
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult));
  return { implied, multiple, baseValue: Math.round(base), band, growthPct, growthMult, maturityMult, chainMult, age };
}

/** Sectors whose seven-day moves swing hardest, and whose tokens launch into the most volatility. */
const VOLATILE_SECTORS = ['basis', 'prediction', 'perpetual', 'derivative', 'decentralized ai', 'ai agent', 'meme', 'launchpad'];

/**
 * A protocol's risk, from the snapshot's own figures. Each reason adds a point; six points is the
 * ceiling. LOW is 0-2 points, MEDIUM 3-4, HIGH 5-6. The reasons travel with the row so the board
 * can show why a tier was given instead of asking the reader to trust it.
 */
export function riskOf(
  protocol: SnapshotProtocol,
  age: number | null,
): { tier: RiskTier; score: number; reasons: string[] } {
  let points = 0;
  const reasons: string[] = [];
  const move = protocol.change_7d === null ? 0 : Math.abs(protocol.change_7d);
  if (move >= 35) {
    points += 2;
    reasons.push(`7-day TVL moved ${move.toFixed(0)}%, a sharp swing`);
  } else if (move >= 15) {
    points += 1;
    reasons.push(`7-day TVL moved ${move.toFixed(0)}%`);
  }
  if (age === null) {
    points += 1;
    reasons.push('no listing date in the snapshot, so its track record is unknown');
  } else if (age < 365) {
    points += 1;
    reasons.push(`listed ${age} days ago, under a year of track record`);
  }
  if (protocol.tvl_usd < 100_000_000) {
    points += 1;
    reasons.push('TVL under $100M, thin enough to move fast');
  }
  if (protocol.chains.length <= 1) {
    points += 1;
    reasons.push('lives on a single chain');
  }
  const c = (protocol.category ?? '').toLowerCase();
  if (VOLATILE_SECTORS.some((s) => c.includes(s))) {
    points += 1;
    reasons.push('sector is a volatile one');
  }
  const score = Math.round((points / 6) * 100) / 100;
  const tier: RiskTier = points <= 2 ? 'LOW' : points <= 4 ? 'MEDIUM' : 'HIGH';
  if (reasons.length === 0) reasons.push('steady 7-day TVL, a long track record, and more than one chain');
  return { tier, score, reasons };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The risk-adjusted value: the implied value discounted by half the row's risk score.
 * The ranking never uses it — the board is always ranked by implied value — but it prices
 * the row's risk into the number a reader compares, so a high-implied, high-risk row does
 * not read the same as a high-implied, low-risk one. */
export function riskAdjustedValue(implied: number, riskScore: number): number {
  return Math.max(1, Math.round(implied * (1 - RISK_DISCOUNT * Math.min(1, Math.max(0, riskScore)))));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names is on the board.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable protocol below the watchlist floor. No top-N cut: the
  // tail is the whole findable universe, so a future launch hiding at $5M of TVL is on the
  // board instead of cut off at an arbitrary row count. A chosen protocol stays chosen; the
  // early rows add to the board, they never replace a watchlist row.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  // The multiples are calibrated once, from this snapshot's launched protocols, and the
  // same calibration scores every row.
  const calibration = calibrateMultiples(snapshot);
  const multiples = Object.fromEntries(calibration.bands.map((b) => [b.band, b.multiple])) as Record<SectorBand, number>;
  const bandSamples = Object.fromEntries(calibration.bands.map((b) => [b.band, b.samples])) as Record<SectorBand, number>;

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, multiples);
    const risk = riskOf(p, v.age);
    return { p, v, risk };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    risk_adjusted_value_usd: riskAdjustedValue(s.v.implied, s.risk.score),
    risk_tier: s.risk.tier,
    risk_score: s.risk.score,
    risk_reasons: s.risk.reasons,
    model: {
      base_multiple: s.v.multiple,
      base_value_usd: s.v.baseValue,
      sector_band: s.v.band,
      calibration_samples: bandSamples[s.v.band],
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      chain_multiplier: s.v.chainMult,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and hold the position.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to the chain and use ${name}'s own app once.`;
  if (c.includes('payment')) return `Pay $${capital} through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote once with the position.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * The eighth farm step: the signal watch. It is written from the row's own seven-day figure —
 * the same number the risk score reads — and tells the farmer what change in that figure
 * pauses the plan, so the plan watches the protocol instead of ending at the deposit.
 */
function signalStep(p: SnapshotProtocol): FarmStep {
  if (p.change_7d === null) {
    return {
      text: `Watch the signal: the snapshot carries no 7-day TVL figure for ${p.name}, so judge its traction from your own position — if the protocol's own page stops reporting activity, exit by the plan above rather than adding capital.`,
      cost: 'nothing but the check',
      time: '5 minutes a week',
    };
  }
  const move = Math.abs(p.change_7d).toFixed(0);
  if (p.change_7d >= 0) {
    return {
      text: `Watch the signal: ${p.name}'s TVL rose ${move}% in the seven days before this snapshot. If it falls more than 15% in any later week, pause new deposits and re-read the risk reasons before adding capital.`,
      cost: 'nothing but the check',
      time: '5 minutes a week',
    };
  }
  return {
    text: `Watch the signal: ${p.name}'s TVL fell ${move}% in the seven days before this snapshot. If it falls another 15% in any later week, pause new deposits and re-read the risk reasons before adding capital.`,
    cost: 'nothing but the check',
    time: '5 minutes a week',
  };
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age, seven-day move), never from a
 * hand-written list of names. The seventh step is the recheck: it names the protocol's own age
 * and chain count, so the plan ends on this row's record instead of on a generic line. The
 * eighth is the signal watch, written from the row's own seven-day TVL figure.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const agePart = age === null ? 'with no listing date in the snapshot' : `${age} days with no token`;
  const chainPart =
    p.chains.length === 0 ? 'no chain the snapshot lists' : p.chains.length === 1 ? '1 chain' : `${p.chains.length} chains`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Recheck this board after ${hold} days: ${p.name} has run ${agePart} across ${chainPart}, and a token — if one ever comes — is this board's own claim, never a promise.`,
      cost: 'nothing but the check',
      time: '5 minutes',
    },
    signalStep(p),
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    risk_adjusted_value_usd: row.risk_adjusted_value_usd,
    risk_tier: row.risk_tier,
    risk_reasons: row.risk_reasons,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    category_multiple: row.model.base_multiple,
    base_value_usd: row.model.base_value_usd,
    sector_band: row.model.sector_band,
    calibration_samples: row.model.calibration_samples,
  };
}

/**
 * The pre-token records the board does not rank, each with its reason, named largest first so
 * the coverage claim can be audited name by name. Three reasons, and only three: an exchange
 * is not a launch to farm; a versioned pool belongs to another protocol's launch, not its own;
 * and a record above the watchlist floor that the snapshot's own watchlist leaves off is one
 * of the wrapped, bridged or staked products of a token that already trades — the brief
 * excludes them, and the snapshot's own list is the authority on which ones they are.
 */
export function excludedRows(snapshot: Snapshot, ranked: Set<string>): ExcludedRow[] {
  const out: ExcludedRow[] = [];
  for (const p of snapshot.protocols) {
    if (!isPreToken(p) || ranked.has(p.slug)) continue;
    const reason: ExclusionReason =
      p.category === 'CEX'
        ? 'exchange'
        : VERSIONED.test(p.name)
          ? 'versioned pool of another protocol'
          : 'above the floor, set aside by the snapshot watchlist';
    out.push({ name: p.name, category: p.category, tvl_usd: p.tvl_usd, reason });
  }
  return out.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** The reconciliation of the snapshot's records against the board: every record counted once. */
export function reconcile(snapshot: Snapshot, board: BoardRow[], excluded: ExcludedRow[]): Reconciliation {
  const pre = snapshot.protocols.filter(isPreToken);
  const watchlist = new Set(snapshot.watchlist);
  return {
    snapshot_protocols: snapshot.protocols.length,
    live_token: snapshot.protocols.length - pre.length,
    live_with_market_cap: snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length,
    pre_token: pre.length,
    ranked: board.length,
    watchlist_ranked: board.filter((r) => watchlist.has(r.slug)).length,
    early_ranked: board.filter((r) => !watchlist.has(r.slug)).length,
    not_ranked: excluded.length,
    excluded_exchanges: excluded.filter((e) => e.reason === 'exchange').length,
    excluded_versioned: excluded.filter((e) => e.reason === 'versioned pool of another protocol').length,
    excluded_above_floor: excluded.filter((e) => e.reason === 'above the floor, set aside by the snapshot watchlist').length,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const excluded = excludedRows(snapshot, new Set(board.map((r) => r.slug)));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist: [...snapshot.watchlist],
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    snapshot_sha256: snapshot.sha256,
    calibration: calibrateMultiples(snapshot),
    reconciliation: reconcile(snapshot, board, excluded),
    excluded,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
    // The fingerprint of the exact sealed text, so the dashboard can name the input it scored
    // and a reader can check a re-run scored the same file.
    sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.risk_tier !== 'LOW' && r.risk_tier !== 'MEDIUM' && r.risk_tier !== 'HIGH') return `${r.slug} has no risk tier`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
