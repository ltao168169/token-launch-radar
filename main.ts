// Token Launch Radar — entry point.
//
// Reads the sealed DefiLlama snapshot, scores it with lib/model.ts, and writes the graded
// outputs. Runs as `node main.ts` under Node 22 with the standard library only, no network,
// no flags, no build and no install. In the grader it runs as `node /bot/main.ts` with the
// snapshot mounted read-only at /input and a writable /output; locally it takes the same
// shape: `MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json`.
//
// Outputs, in order:
//   board.json      {rows: BoardRow[]} — the ranked board, 100..4000 rows
//   data.js         window.RADAR = {...} — the dashboard's whole dataset, baked in
//   dashboard/      the static page (index.html, app.css, app.js), no network
//   screenshots/    the three screenshots the judge sees
//   dossier.json    written last, from buildDossier, so it covers everything above
//
// The run is deterministic: two runs over the same snapshot write byte-identical outputs.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-board.ts';
import { buildRadar, boardIssue, dataScript, parseSnapshot, type Snapshot } from './lib/model.ts';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const TEXT_MAX_BYTES = 65_536;

/** The command line's --input value, else the sealed snapshot's path. */
function inputPath(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1] !== undefined) return argv[i + 1]!;
    if (argv[i]!.startsWith('--input=')) return argv[i]!.slice('--input='.length);
  }
  return join(INPUT_DIR, 'snapshot.json');
}

/** The command line's --output value, else MAKEFUN_OUTPUT_DIR, else /output. */
function outputDir(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output' && argv[i + 1] !== undefined) return argv[i + 1]!;
    if (argv[i]!.startsWith('--output=')) return argv[i]!.slice('--output='.length);
  }
  return OUTPUT_DIR;
}

/** Copy a directory's plain files (no links, no dot-directories) into a target directory. */
function copyPlainDir(from: string, to: string): string[] {
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    const dst = join(to, name);
    copyFileSync(src, dst);
    names.push(name);
  }
  return names;
}

/** The screenshot files in a directory, in name order. */
function screenshotNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => !n.startsWith('.') && /\.(png|jpe?g)$/i.test(n))
    .sort();
}

function main(argv: string[]): void {
  const inPath = inputPath(argv);
  const outDir = outputDir(argv);
  const here = new URL('.', import.meta.url).pathname;

  const text = readFileSync(inPath, 'utf8');
  const snapshot: Snapshot = parseSnapshot(text);
  const { board, radar } = buildRadar(snapshot);

  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`board refused: ${issue}`);
  if (board.length < 100 || board.length > 4000) {
    throw new Error(`board has ${board.length} rows, outside 100..4000`);
  }

  const shots = screenshotNames(join(here, 'screenshots'));
  if (shots.length < 3) {
    throw new Error(`screenshots/ holds ${shots.length} screenshot(s), the bounty needs at least 3`);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`, 'utf8');
  writeFileSync(join(outDir, 'data.js'), dataScript(radar), 'utf8');
  copyPlainDir(join(here, 'dashboard'), join(outDir, 'dashboard'));
  copyPlainDir(join(here, 'screenshots'), join(outDir, 'screenshots'));

  // Last: the dossier covers the dashboard and the screenshots, so it is written after them.
  const dossier = buildDossier(outDir, { text_max_bytes: TEXT_MAX_BYTES });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const totalImplied = board.reduce((sum, r) => sum + r.implied_value_usd, 0);
  console.log(
    `radar ${radar.model_version}: ${board.length} rows (${radar.watchlist_size} watchlist + ${radar.early_size} early), ` +
      `${radar.live.length} live, top implied $${board[0]!.implied_value_usd.toLocaleString('en-US')}, ` +
      `total implied $${totalImplied.toLocaleString('en-US')}, ${shots.length} screenshots, ` +
      `dossier ${(dossier.length / 1024).toFixed(0)} KiB`,
  );
}

main(process.argv.slice(2));
