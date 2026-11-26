// Token Launch Radar — value model, radar-5.
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
// The base value follows only from the snapshot's own figures — TVL, seven-day growth, age
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
// What radar-5 changes against radar-4, and why:
//
// 1. Every row carries a scenario range, not just a point. The sector multiple is the one
//    input the model cannot observe for a pre-token protocol — it is borrowed from the
//    band's launched protocols, whose market-cap-to-TVL ratios are wildly dispersed (in
//    this snapshot they run from under 0.01 to over 100 inside a single band). So beside
//    the median multiple that sets the base value, the calibration also measures the
//    band's 20th and 80th percentile ratios, shrunk the same way, and the row's bear and
//    bull values are its TVL priced at those multiples — the bear case also drops any
//    growth credit, keeping only the downside the snapshot recorded. The base multiple
//    stays clamped to [0.10, 0.50] so TVL decides the ranking; the scenario multiples are
//    clamped wider, to [0.05, 1.50], because their job is not to rank but to span what
//    launches in the band actually did. Each row also names which assumption its value
//    leans on hardest — the sector multiple's spread or the growth contribution — so a
//    reader can see where a number is soft before trusting it.
//
// 2. Every row carries a confidence score, 0 to 100, built only from the quality of the
//    evidence behind that row: how many launched protocols calibrate its band, whether
//    the snapshot records its seven-day change and its listing date, how large its TVL
//    is, how steady its week was, and how long its track record runs. It is a statement
//    about the row's inputs, never about the protocol's quality, and the dashboard prints
//    the five parts so the score can be argued with.
//
// 3. The model is cross-checked against the snapshot's own launched protocols, and the
//    result ships with the board. The launched protocols are split in two by a hash of
//    their slug; each half is calibrated on the other, so every launched protocol gets
//    one prediction from a calibration that never saw it. Scored as if they were still
//    pre-token and compared with the market caps they actually carry, they measure what
//    this kind of model is worth: how well it ranks (a Spearman rank correlation, set
//    against raw TVL's), how conservative its base case runs (the median ratio of actual
//    to predicted), and how often a launch lands inside its scenario range. The check is
//    cross-sectional — it compares today's market cap with today's TVL, not a launch
//    price with a launch-day TVL — and the dashboard says so, next to the numbers.
//
// 4. The board is curated, by stated rules, into a shortlist and an avoid list. The
//    shortlist is the eight rows with the highest risk-adjusted value among rows whose
//    risk is not HIGH and whose confidence clears the bar the curation states; the avoid
//    list is the highest-implied rows whose risk is HIGH, whose confidence is low, or
//    whose TVL fell steeply in the snapshot's week. Each name carries its reason, derived
//    from its own figures. The dashboard also prices an equal-weight basket of the
//    shortlist across the three scenarios, so the picks read as a portfolio, not a poster.
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
// evidence for what each sector's multiple has been. The clamp band on the base multiple is
// deliberately narrow so TVL still decides the ranking; growth and maturity move a row
// within its sector, and the scenario range shows how far the multiple itself could move it.
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
export const MODEL_VERSION = 'radar-5';

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

/** The clamp on the calibrated base multiple: narrow on purpose, so TVL still decides the ranking. */
export const MULTIPLE_MIN = 0.1;
export const MULTIPLE_MAX = 0.5;

/**
 * The clamp on the scenario (bear/bull) multiples: wider than the base clamp on purpose.
 * The base multiple ranks; the scenario multiples describe — they span the middle of what
 * the band's launches actually did, and a tight clamp would pretend that spread is smaller
 * than the snapshot says it is.
 */
export const SCENARIO_MIN = 0.05;
export const SCENARIO_MAX = 1.5;

/** The percentiles of a band's launch ratios that price the bear and bull cases. */
export const SCENARIO_LOW_PCT = 0.2;
export const SCENARIO_HIGH_PCT = 0.8;

/**
 * The shrinkage prior: a band's statistic counts for its sample count, and this many phantom
 * samples at the snapshot-wide statistic count against it, so a band with two wild samples
 * does not swing the board.
 */
export const SHRINK_PRIOR = 8;

/** One band's calibration: what the snapshot's launched protocols say its multiples are. */
export interface CalibrationBand {
  band: SectorBand;
  label: string;
  samples: number;
  median_ratio: number | null;
  low_ratio: number | null;
  high_ratio: number | null;
  multiple: number;
  bear_multiple: number;
  bull_multiple: number;
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

/** A row's confidence label, from its evidence score. */
export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW';

/** The five parts of a row's confidence score, each printed on the detail view. */
export interface ConfidenceParts {
  evidence: number;
  record: number;
  scale: number;
  stability: number;
  track: number;
}

/** A row's confidence: the total, its label, and the five parts it is summed from. */
export interface Confidence {
  score: number;
  label: ConfidenceLabel;
  parts: ConfidenceParts;
}

/** Which assumption a row's value leans on hardest, and by how much it can move the value. */
export interface Sensitivity {
  driver: 'sector multiple' | '7-day growth';
  multiple_spread_pct: number;
  growth_contribution_pct: number;
}

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
  bear_value_usd: number;
  bull_value_usd: number;
  risk_adjusted_value_usd: number;
  risk_tier: RiskTier;
  risk_score: number;
  risk_reasons: string[];
  confidence_score: number;
  confidence_label: ConfidenceLabel;
  confidence_parts: ConfidenceParts;
  model: {
    base_multiple: number;
    bear_multiple: number;
    bull_multiple: number;
    base_value_usd: number;
    sector_band: SectorBand;
    calibration_samples: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
    sensitivity_driver: 'sector multiple' | '7-day growth';
    sensitivity_pct: number;
    multiple_spread_pct: number;
    growth_contribution_pct: number;
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
  bear_value_usd: number;
  bull_value_usd: number;
  risk_adjusted_value_usd: number;
  risk_tier: RiskTier;
  risk_reasons: string[];
  confidence_score: number;
  confidence_label: ConfidenceLabel;
  confidence_parts: ConfidenceParts;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  category_multiple: number;
  bear_multiple: number;
  bull_multiple: number;
  base_value_usd: number;
  sector_band: SectorBand;
  calibration_samples: number;
  sensitivity_driver: 'sector multiple' | '7-day growth';
  multiple_spread_pct: number;
  growth_contribution_pct: number;
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

/** One band's line in the cross-check: how the model did on that band's held-out launches. */
export interface ValidationBand {
  band: SectorBand;
  n: number;
  median_actual_over_base: number | null;
  coverage_pct: number | null;
}

/**
 * The cross-check of the model against the snapshot's launched protocols. Every figure is
 * out-of-sample in the pooled split-half sense: each launched protocol was predicted by a
 * calibration fitted on the other half of the launched set, split by a hash of the slug.
 */
export interface Validation {
  checked: number;
  spearman_model: number | null;
  spearman_tvl: number | null;
  median_actual_over_base: number | null;
  coverage_n: number;
  coverage_pct: number | null;
  bands: ValidationBand[];
}

/** The curation: the shortlist, the avoid list, and the shortlist priced as one basket. */
export interface Curation {
  picks: string[];
  avoid: string[];
  basket_rows: number;
  basket_bear_usd: number;
  basket_base_usd: number;
  basket_bull_usd: number;
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
  validation: Validation;
  curation: Curation;
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
 * band decides which calibrated multiples a row gets — never the protocol's name.
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

/** A percentile of a non-empty list, linearly interpolated between the two nearest ranks. */
function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

const round3 = (n: number): number => Math.round(n * 1e3) / 1e3;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The launched protocols a calibration or cross-check may learn from: a market cap, a TVL, not an exchange. */
function launchedProtocols(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX',
  );
}

/**
 * One statistic of a band, shrunk toward the same statistic of every launched protocol:
 * the band's samples count for their number, and SHRINK_PRIOR phantom samples at the
 * snapshot-wide figure count against them.
 */
function shrunk(bandValues: number[], allValues: number[], stat: (v: number[]) => number): number {
  return (bandValues.length * stat(bandValues) + SHRINK_PRIOR * stat(allValues)) / (bandValues.length + SHRINK_PRIOR);
}

const clampBase = (n: number): number => Math.min(MULTIPLE_MAX, Math.max(MULTIPLE_MIN, n));
const clampScenario = (n: number): number => Math.min(SCENARIO_MAX, Math.max(SCENARIO_MIN, n));

/**
 * The calibration: what multiples each sector band gets, measured from a set of launched
 * protocols. A launched protocol — one that already carries a market cap — states a
 * market-cap-to-TVL ratio; exchanges are left out by the caller, because an exchange token
 * is not a protocol launch and its ratio would teach the model the wrong lesson. A band's
 * base multiple is its samples' median ratio, shrunk toward the snapshot-wide median with
 * SHRINK_PRIOR phantom samples and clamped to [MULTIPLE_MIN, MULTIPLE_MAX]; its bear and
 * bull multiples are the same shrinkage applied to the band's SCENARIO_LOW_PCT and
 * SCENARIO_HIGH_PCT percentiles, clamped to the wider scenario band. A band with no sample
 * keeps its stated radar-3 multiple for the base and the snapshot-wide scenario multiples
 * for the range, and says so, so the model never silently invents a number.
 */
export function calibrateFrom(launched: SnapshotProtocol[]): Calibration {
  const allRatios = launched.map((p) => p.mcap_usd! / p.tvl_usd);
  const globalMedian = allRatios.length > 0 ? median(allRatios) : null;
  const globalBear = allRatios.length > 0 ? clampScenario(shrunk(allRatios, allRatios, (v) => percentile(v, SCENARIO_LOW_PCT))) : STATED_MULTIPLES.E;
  const globalBull = allRatios.length > 0 ? clampScenario(shrunk(allRatios, allRatios, (v) => percentile(v, SCENARIO_HIGH_PCT))) : STATED_MULTIPLES.E;
  const bands = (Object.keys(BAND_LABELS) as SectorBand[]).map((band) => {
    const ratios = launched.filter((p) => sectorBand(p.category) === band).map((p) => p.mcap_usd! / p.tvl_usd);
    if (ratios.length === 0 || globalMedian === null) {
      return {
        band,
        label: BAND_LABELS[band],
        samples: ratios.length,
        median_ratio: null,
        low_ratio: null,
        high_ratio: null,
        multiple: STATED_MULTIPLES[band],
        bear_multiple: round3(globalBear),
        bull_multiple: round3(globalBull),
        source: 'stated' as const,
      };
    }
    return {
      band,
      label: BAND_LABELS[band],
      samples: ratios.length,
      median_ratio: round3(median(ratios)),
      low_ratio: round3(percentile(ratios, SCENARIO_LOW_PCT)),
      high_ratio: round3(percentile(ratios, SCENARIO_HIGH_PCT)),
      multiple: round3(clampBase(shrunk(ratios, allRatios, median))),
      bear_multiple: round3(clampScenario(shrunk(ratios, allRatios, (v) => percentile(v, SCENARIO_LOW_PCT)))),
      bull_multiple: round3(clampScenario(shrunk(ratios, allRatios, (v) => percentile(v, SCENARIO_HIGH_PCT)))),
      source: 'calibrated' as const,
    };
  });
  return {
    samples: launched.length,
    global_median_ratio: globalMedian === null ? null : round3(globalMedian),
    bands,
  };
}

/** The calibration the board runs on: every launched protocol in the snapshot. */
export function calibrateMultiples(snapshot: Snapshot): Calibration {
  return calibrateFrom(launchedProtocols(snapshot));
}

/** A band's three multiples under a calibration, as one record. */
function multiplesOf(calibration: Calibration): Record<SectorBand, { base: number; bear: number; bull: number; samples: number }> {
  return Object.fromEntries(
    calibration.bands.map((b) => [b.band, { base: b.multiple, bear: b.bear_multiple, bull: b.bull_multiple, samples: b.samples }]),
  ) as Record<SectorBand, { base: number; bear: number; bull: number; samples: number }>;
}

/** The chain-diversity multiplier: a protocol live on more chains is worth a little more. */
export function chainMultiplier(chains: string[], model: ModelConstants): number {
  const extra = Math.max(0, chains.length - 1);
  return Math.round((1 + Math.min(extra * model.chain_step, model.chain_max_bonus)) * 1e4) / 1e4;
}

/** The growth multiplier the base case uses: the clamped seven-day change, weighted. */
function growthMultiplier(growthPct: number, model: ModelConstants): number {
  return 1 + (growthPct / 100) * model.growth_weight;
}

/** The growth multiplier the bear case uses: upside credit dropped, downside kept in full. */
function bearGrowthMultiplier(growthPct: number, model: ModelConstants): number {
  return 1 + (Math.min(growthPct, 0) / 100) * model.growth_weight;
}

/** The maturity multiplier: 0.6 for a brand-new protocol rising to 1.0 at three years. */
function maturityMultiplier(age: number | null, model: ModelConstants): number {
  const ageForModel = age ?? model.unknown_age_days;
  return model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
}

/** Everything one protocol scores under a calibration: the three scenario values and every factor behind them. */
export interface Scored {
  implied: number;
  bear: number;
  bull: number;
  multiple: number;
  bearMultiple: number;
  bullMultiple: number;
  baseValue: number;
  band: SectorBand;
  samples: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
  sensitivity: Sensitivity;
}

/** Score one protocol as if it were pre-token, under `model` and the calibrated `calibration`. */
export function scoreProtocol(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  calibration: Calibration,
): Scored {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = growthMultiplier(growthPct, model);
  const maturityMult = maturityMultiplier(age, model);
  const band = sectorBand(protocol.category);
  const mults = multiplesOf(calibration)[band];
  const chainMult = chainMultiplier(protocol.chains, model);
  const rest = maturityMult * chainMult;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * mults.base * growthMult * rest));
  const bear = Math.max(1, Math.round(protocol.tvl_usd * mults.bear * bearGrowthMultiplier(growthPct, model) * rest));
  const bull = Math.max(1, Math.round(protocol.tvl_usd * mults.bull * growthMult * rest));
  // Sensitivity: how far the sector multiple's own spread can carry this row, against how
  // much of the row's value the growth assumption contributes. The larger one is the
  // assumption the row leans on, and its size is printed with the row.
  const multipleSpread = ((mults.bull - mults.bear) / mults.base) * 100;
  const growthContribution = Math.abs(growthMult - 1) * 100;
  const sensitivity: Sensitivity = {
    driver: multipleSpread >= growthContribution ? 'sector multiple' : '7-day growth',
    multiple_spread_pct: Math.round(multipleSpread),
    growth_contribution_pct: Math.round(growthContribution),
  };
  return {
    implied,
    bear,
    bull,
    multiple: mults.base,
    bearMultiple: mults.bear,
    bullMultiple: mults.bull,
    baseValue: Math.round(protocol.tvl_usd * mults.base),
    band,
    samples: mults.samples,
    growthPct,
    growthMult,
    maturityMult,
    chainMult,
    age,
    sensitivity,
  };
}

/** The multipliers and the implied value one protocol gets under `model` and the calibrated `multiples`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiples: Record<SectorBand, number>,
): { implied: number; multiple: number; baseValue: number; band: SectorBand; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const calibration: Calibration = {
    samples: 0,
    global_median_ratio: null,
    bands: (Object.keys(BAND_LABELS) as SectorBand[]).map((band) => ({
      band,
      label: BAND_LABELS[band],
      samples: 0,
      median_ratio: null,
      low_ratio: null,
      high_ratio: null,
      multiple: multiples[band],
      bear_multiple: multiples[band],
      bull_multiple: multiples[band],
      source: 'stated' as const,
    })),
  };
  const s = scoreProtocol(protocol, asOf, model, calibration);
  return {
    implied: s.implied,
    multiple: s.multiple,
    baseValue: s.baseValue,
    band: s.band,
    growthPct: s.growthPct,
    growthMult: s.growthMult,
    maturityMult: s.maturityMult,
    chainMult: s.chainMult,
    age: s.age,
  };
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

/**
 * A row's confidence: how much evidence stands behind its number, scored 0 to 100 from five
 * parts, each a stated rule over the row's own record and its band's calibration.
 *
 *   evidence   0..30 — the launched samples behind the band's multiples: a band calibrated
 *              on 40 launches earns the full 30; the score scales with the count.
 *   record     0..20 — the snapshot records the row's seven-day change (10) and its
 *              listing date (10); a figure the model had to assume earns nothing.
 *   scale      0..20 — the row's TVL: $1B or more earns 20, then 16 / 12 / 8 / 4 down the
 *              size steps, because a small TVL is itself a noisy input.
 *   stability  0..15 — the week's move: within 5% earns 15, then 10 / 5 / 0 as the swing
 *              grows; an unreported week earns 5, neither trusted nor condemned.
 *   track      0..15 — the record's length: three years earns 15, then 10 / 6 / 3; an
 *              unknown listing date earns 0.
 *
 * HIGH is 70 and up, MEDIUM 45 to 69, LOW under 45. The score grades the row's inputs,
 * never the protocol: a superb protocol with a thin record scores low, and says why.
 */
export function confidenceOf(protocol: SnapshotProtocol, age: number | null, bandSamples: number): Confidence {
  const evidence = Math.round(30 * Math.min(1, bandSamples / 40));
  const record = (protocol.change_7d !== null ? 10 : 0) + (protocol.listed_at !== null ? 10 : 0);
  const tvl = protocol.tvl_usd;
  const scale = tvl >= 1_000_000_000 ? 20 : tvl >= 250_000_000 ? 16 : tvl >= 100_000_000 ? 12 : tvl >= 25_000_000 ? 8 : 4;
  const move = protocol.change_7d === null ? null : Math.abs(protocol.change_7d);
  const stability = move === null ? 5 : move <= 5 ? 15 : move <= 15 ? 10 : move <= 35 ? 5 : 0;
  const track = age === null ? 0 : age >= 1095 ? 15 : age >= 365 ? 10 : age >= 180 ? 6 : 3;
  const parts: ConfidenceParts = { evidence, record, scale, stability, track };
  const score = evidence + record + scale + stability + track;
  const label: ConfidenceLabel = score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW';
  return { score, label, parts };
}

/** A rank for Spearman's correlation: average ranks, ties sharing theirs. */
function ranks(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.v === order[i]!.v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]!.i] = avg;
    i = j + 1;
  }
  return out;
}

/** Spearman's rank correlation between two equal-length series; null when either never varies. */
export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (rx[i]! - mx) * (ry[i]! - my);
    vx += (rx[i]! - mx) ** 2;
    vy += (ry[i]! - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return Math.round((cov / Math.sqrt(vx * vy)) * 1000) / 1000;
}

/** Which half of the launched set a slug belongs to: FNV-1a over the slug, low bit. Deterministic. */
function halfOf(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2;
}

/**
 * The cross-check: what this model is worth, measured on the snapshot's own launched
 * protocols. The launched set is split in two by slug hash; each half is calibrated on the
 * other, so every launched protocol is scored by a calibration that never saw it — as if it
 * were still pre-token, from its TVL, week, age, sector and chains — and its three scenario
 * values are set against the market cap it actually carries. The pooled figures say how the
 * model ranks (against raw TVL's own ranking of the same protocols), how its base case runs
 * (the median actual-over-base ratio), and how often a launch lands inside its range.
 */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): Validation {
  const launched = launchedProtocols(snapshot);
  interface Pred { band: SectorBand; tvl: number; actual: number; base: number; bear: number; bull: number }
  const preds: Pred[] = [];
  for (const half of [0, 1]) {
    const train = launched.filter((p) => halfOf(p.slug) === half);
    const test = launched.filter((p) => halfOf(p.slug) !== half);
    if (train.length === 0) continue;
    const calibration = calibrateFrom(train);
    for (const p of test) {
      const s = scoreProtocol(p, snapshot.as_of, model, calibration);
      preds.push({ band: s.band, tvl: p.tvl_usd, actual: p.mcap_usd!, base: s.implied, bear: s.bear, bull: s.bull });
    }
  }
  const covered = preds.filter((x) => x.actual >= x.bear && x.actual <= x.bull);
  const bands = (Object.keys(BAND_LABELS) as SectorBand[]).map((band) => {
    const inBand = preds.filter((x) => x.band === band);
    const inCovered = inBand.filter((x) => x.actual >= x.bear && x.actual <= x.bull);
    return {
      band,
      n: inBand.length,
      median_actual_over_base: inBand.length > 0 ? round3(median(inBand.map((x) => x.actual / x.base))) : null,
      coverage_pct: inBand.length > 0 ? Math.round((inCovered.length / inBand.length) * 1000) / 10 : null,
    };
  });
  return {
    checked: preds.length,
    spearman_model: spearman(preds.map((x) => x.base), preds.map((x) => x.actual)),
    spearman_tvl: spearman(preds.map((x) => x.tvl), preds.map((x) => x.actual)),
    median_actual_over_base: preds.length > 0 ? round3(median(preds.map((x) => x.actual / x.base))) : null,
    coverage_n: covered.length,
    coverage_pct: preds.length > 0 ? Math.round((covered.length / preds.length) * 1000) / 10 : null,
    bands,
  };
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

  const scored = [...chosen.values()].map((p) => {
    const v = scoreProtocol(p, snapshot.as_of, model, calibration);
    const risk = riskOf(p, v.age);
    const confidence = confidenceOf(p, v.age, v.samples);
    return { p, v, risk, confidence };
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
    bear_value_usd: s.v.bear,
    bull_value_usd: s.v.bull,
    risk_adjusted_value_usd: riskAdjustedValue(s.v.implied, s.risk.score),
    risk_tier: s.risk.tier,
    risk_score: s.risk.score,
    risk_reasons: s.risk.reasons,
    confidence_score: s.confidence.score,
    confidence_label: s.confidence.label,
    confidence_parts: s.confidence.parts,
    model: {
      base_multiple: s.v.multiple,
      bear_multiple: s.v.bearMultiple,
      bull_multiple: s.v.bullMultiple,
      base_value_usd: s.v.baseValue,
      sector_band: s.v.band,
      calibration_samples: s.v.samples,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      chain_multiplier: s.v.chainMult,
      age_days: s.v.age,
      sensitivity_driver: s.v.sensitivity.driver,
      sensitivity_pct: s.v.sensitivity.driver === 'sector multiple' ? s.v.sensitivity.multiple_spread_pct : s.v.sensitivity.growth_contribution_pct,
      multiple_spread_pct: s.v.sensitivity.multiple_spread_pct,
      growth_contribution_pct: s.v.sensitivity.growth_contribution_pct,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** How many rows the shortlist holds. */
export const PICKS_COUNT = 8;

/** The confidence a row needs to be shortlisted: the evidence behind it must at least be middling. */
export const PICKS_MIN_CONFIDENCE = 50;

/** How many rows the avoid list holds at most. */
export const AVOID_COUNT = 5;

/** A seven-day fall steep enough to put a high-implied row on the avoid list on its own. */
export const AVOID_FALL_PCT = -30;

/**
 * The curation, by rules stated here and printed on the dashboard. The shortlist takes the
 * rows whose risk is not HIGH and whose confidence scores at least PICKS_MIN_CONFIDENCE,
 * ordered by risk-adjusted value, and keeps the first PICKS_COUNT — the rows a farmer with
 * limited capital would start from. The avoid list takes the board's highest-implied rows
 * that fail one of three tests — HIGH risk, confidence under 45, or a seven-day TVL fall of
 * AVOID_FALL_PCT or steeper — because those are the rows whose headline value is likeliest
 * to mislead. The basket prices the shortlist as one equal-weight portfolio: the plain sum
 * of its rows under each scenario, so the picks carry a combined range, not eight separate
 * promises added up in the reader's head.
 */
export function curate(board: BoardRow[]): Curation {
  const eligible = board
    .filter((r) => r.risk_tier !== 'HIGH' && r.confidence_score >= PICKS_MIN_CONFIDENCE)
    .sort((a, b) => b.risk_adjusted_value_usd - a.risk_adjusted_value_usd || a.rank - b.rank);
  const picks = eligible.slice(0, PICKS_COUNT);
  const avoid = board
    .filter((r) => r.risk_tier === 'HIGH' || r.confidence_label === 'LOW' || (r.change_7d !== null && r.change_7d <= AVOID_FALL_PCT))
    .slice(0, AVOID_COUNT);
  return {
    picks: picks.map((r) => r.slug),
    avoid: avoid.map((r) => r.slug),
    basket_rows: picks.length,
    basket_bear_usd: picks.reduce((sum, r) => sum + r.bear_value_usd, 0),
    basket_base_usd: picks.reduce((sum, r) => sum + r.implied_value_usd, 0),
    basket_bull_usd: picks.reduce((sum, r) => sum + r.bull_value_usd, 0),
  };
}

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
    bear_value_usd: row.bear_value_usd,
    bull_value_usd: row.bull_value_usd,
    risk_adjusted_value_usd: row.risk_adjusted_value_usd,
    risk_tier: row.risk_tier,
    risk_reasons: row.risk_reasons,
    confidence_score: row.confidence_score,
    confidence_label: row.confidence_label,
    confidence_parts: row.confidence_parts,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    category_multiple: row.model.base_multiple,
    bear_multiple: row.model.bear_multiple,
    bull_multiple: row.model.bull_multiple,
    base_value_usd: row.model.base_value_usd,
    sector_band: row.model.sector_band,
    calibration_samples: row.model.calibration_samples,
    sensitivity_driver: row.model.sensitivity_driver,
    multiple_spread_pct: row.model.multiple_spread_pct,
    growth_contribution_pct: row.model.growth_contribution_pct,
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
  const calibration = calibrateMultiples(snapshot);
  const rows = board.map(radarRow);
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
    calibration,
    reconciliation: reconcile(snapshot, board, excluded),
    validation: validateModel(snapshot, model),
    curation: curate(board),
    excluded,
    rows,
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

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, scenarios, confidence, and farm steps. */
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
    if (!(r.bear_value_usd >= 1 && r.bear_value_usd <= r.implied_value_usd && r.implied_value_usd <= r.bull_value_usd && r.bull_value_usd <= 1e14)) {
      return `${r.slug} has a scenario range out of order: bear ${r.bear_value_usd}, base ${r.implied_value_usd}, bull ${r.bull_value_usd}`;
    }
    if (!Number.isInteger(r.confidence_score) || r.confidence_score < 0 || r.confidence_score > 100) return `${r.slug} has confidence ${r.confidence_score}`;
    if (r.risk_tier !== 'LOW' && r.risk_tier !== 'MEDIUM' && r.risk_tier !== 'HIGH') return `${r.slug} has no risk tier`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
