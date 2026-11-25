// Token Launch Radar — the page. Static: it reads window.RADAR (baked in by main.ts) and renders
// the board, the filters, the per-protocol detail and the live-token view. No fetch, no network.
(function () {
  'use strict';
  var D = window.RADAR;
  var WL = {};
  D.watchlist.forEach(function (s) { WL[s] = true; });

  var state = { q: '', category: 'all', chain: 'all', risk: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, wlOnly: false, compare: [] };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtUsd(n) {
    if (n == null || !isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtFull(n) {
    if (n == null || !isFinite(n)) return '—';
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtPct(n) {
    if (n == null || !isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(d) { return d == null ? '—' : d + 'd'; }
  function pctCls(n) { return n == null ? '' : n > 0 ? 'pos' : n < 0 ? 'neg' : ''; }

  /* ---- the farm plan, generated in the page from the row's own record ---- */
  function chainOf(r) { return r.chains && r.chains.length ? r.chains[0] : 'its main chain'; }
  function capitalFor(r) {
    if (r.tvl_usd >= 5e9) return 250;
    if (r.tvl_usd >= 1e9) return 150;
    if (r.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdFor(age) {
    if (age == null) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(r, cap, chain) {
    var c = (r.category || '').toLowerCase(), name = r.name;
    if (/lend|cdp|collateral/.test(c)) return 'Supply $' + cap + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (/dex|yield|leveraged farm/.test(c)) return 'Provide $' + cap + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
    if (/bridge/.test(c)) return 'Bridge $' + cap + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (/staking|restak/.test(c)) return 'Stake $' + cap + ' of the chain\'s staking asset through ' + name + ' and keep the receipt token.';
    if (/perpetual|derivative/.test(c)) return 'Deposit $' + cap + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (/prediction/.test(c)) return 'Fund $' + cap + ' and place one market position on ' + name + '.';
    if (/curator|allocator/.test(c)) return 'Deposit $' + cap + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares.';
    if (/stable/.test(c)) return 'Mint or deposit $' + cap + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (/rwa/.test(c)) return 'Mint $' + cap + ' of the protocol\'s yield-bearing asset on ' + chain + ' and hold it.';
    if (/insurance/.test(c)) return 'Buy $' + cap + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (/basis/.test(c)) return 'Deposit $' + cap + ' of USDC into ' + name + '\'s basis vault on ' + chain + ' and hold the position.';
    if (/chain/.test(c)) return 'Bridge $' + cap + ' of USDC to the chain and use ' + name + '\'s own app once.';
    if (/payment/.test(c)) return 'Pay $' + cap + ' through ' + name + ' on ' + chain + ' and keep the receipt.';
    if (/governance/.test(c)) return 'Deposit $' + cap + ' into ' + name + ' on ' + chain + ' and vote once with the position.';
    return 'Deposit $' + cap + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function signalStep(r) {
    if (r.change_7d == null) {
      return { t: 'Watch the signal: the snapshot carries no 7-day TVL figure for ' + r.name + ', so judge its traction from your own position — if the protocol\'s own page stops reporting activity, exit by the plan above rather than adding capital.', c: 'nothing but the check', m: '5 minutes a week' };
    }
    var move = Math.abs(r.change_7d).toFixed(0);
    if (r.change_7d >= 0) {
      return { t: 'Watch the signal: ' + r.name + '\'s TVL rose ' + move + '% in the seven days before this snapshot. If it falls more than 15% in any later week, pause new deposits and re-read the risk reasons before adding capital.', c: 'nothing but the check', m: '5 minutes a week' };
    }
    return { t: 'Watch the signal: ' + r.name + '\'s TVL fell ' + move + '% in the seven days before this snapshot. If it falls another 15% in any later week, pause new deposits and re-read the risk reasons before adding capital.', c: 'nothing but the check', m: '5 minutes a week' };
  }
  function farmSteps(r) {
    var chain = chainOf(r), cap = capitalFor(r), hold = holdFor(r.age_days), gas = cap >= 150 ? 8 : 4;
    var agePart = r.age_days == null ? 'with no listing date in the snapshot' : r.age_days + ' days with no token';
    var chainPart = !r.chains || !r.chains.length ? 'no chain the snapshot lists' : r.chains.length === 1 ? '1 chain' : r.chains.length + ' chains';
    return [
      { t: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', c: 'under $3 of gas for the first transaction', m: '5 minutes' },
      { t: actionFor(r, cap, chain), c: '$' + cap + ' of capital and about $' + gas + ' of gas', m: '15 minutes to set up' },
      { t: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', c: 'about $2 of gas a week', m: '10 minutes a week' },
      { t: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', c: 'the $' + cap + ' stays in the position', m: hold + ' days' },
      { t: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes.', c: 'no fee to check, and never pay to claim', m: '10 minutes' },
      { t: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', c: 'nothing but the log', m: '5 minutes' },
      { t: 'Recheck this board after ' + hold + ' days: ' + r.name + ' has run ' + agePart + ' across ' + chainPart + ', and a token — if one ever comes — is this board\'s own claim, never a promise.', c: 'nothing but the check', m: '5 minutes' },
      signalStep(r)
    ];
  }

  /* ---- hash: the page's state lives in the URL so a view can be linked ---- */
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    var parts = h ? h.split('&') : [];
    parts.forEach(function (p) {
      var kv = p.split('='), k = kv[0], v = decodeURIComponent(kv[1] || '');
      if (k === 'detail') state.selected = v || null;
      else if (k === 'cat') state.category = v || 'all';
      else if (k === 'chain') state.chain = v || 'all';
      else if (k === 'risk') state.risk = v || 'all';
      else if (k === 'tab') state.tab = v === 'live' ? 'live' : 'pre-token';
      else if (k === 'q') state.q = v;
      else if (k === 'sort') state.sort = v || 'implied';
      else if (k === 'dir') state.dir = v === '1' ? 1 : -1;
      else if (k === 'wl') state.wlOnly = v === '1';
      else if (k === 'cmp') state.compare = v ? v.split(',').filter(Boolean).slice(0, 2) : [];
    });
  }
  function writeHash() {
    var p = [];
    if (state.selected) p.push('detail=' + encodeURIComponent(state.selected));
    if (state.category !== 'all') p.push('cat=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') p.push('chain=' + encodeURIComponent(state.chain));
    if (state.risk !== 'all') p.push('risk=' + state.risk);
    if (state.tab === 'live') p.push('tab=live');
    if (state.q) p.push('q=' + encodeURIComponent(state.q));
    if (state.sort !== 'implied') p.push('sort=' + state.sort);
    if (state.dir === 1) p.push('dir=1');
    if (state.wlOnly) p.push('wl=1');
    if (state.compare.length) p.push('cmp=' + state.compare.map(encodeURIComponent).join(','));
    var h = p.join('&');
    if (location.hash.replace(/^#/, '') !== h) history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }

  /* ---- filtering and sorting ---- */
  function rows() {
    var q = state.q.trim().toLowerCase();
    return D.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.risk !== 'all' && r.risk_tier !== state.risk) return false;
      if (state.wlOnly && !WL[r.slug]) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sorted(list) {
    var key = state.sort, dir = state.dir;
    var val = function (r) {
      if (key === 'tvl') return r.tvl_usd;
      if (key === 'change') return r.change_7d == null ? -1e18 : r.change_7d;
      if (key === 'age') return r.age_days == null ? -1 : r.age_days;
      if (key === 'name') return r.name.toLowerCase();
      if (key === 'rank') return r.rank;
      return r.implied_value_usd;
    };
    return list.slice().sort(function (a, b) {
      var x = val(a), y = val(b);
      if (x < y) return -dir;
      if (x > y) return dir;
      return a.slug < b.slug ? -1 : 1;
    });
  }
  function sortArrow(key) { return state.sort === key ? (state.dir < 0 ? ' ▼' : ' ▲') : ''; }

  /* ---- static sections ---- */
  function renderMeta() {
    // The snapshot's own source field carries a URL; the page names its source in words only,
    // never as an address, because the dashboard must name no network address at all.
    document.getElementById('meta').textContent =
      'Snapshot ' + D.as_of + ' · source: DefiLlama public protocol snapshot · watchlist floor ' + fmtUsd(D.floor_usd) +
      ' · model ' + D.model_version + ' · ' + D.board_size + ' rows';
  }
  function renderStats() {
    var top = D.rows[0];
    var tiers = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    D.rows.forEach(function (r) { tiers[r.risk_tier]++; });
    var total = D.rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
    var n = D.board_size || 1;
    document.getElementById('stats').innerHTML =
      '<div class="stat"><b>' + D.board_size + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + D.watchlist_size + '</b><span>on the watchlist</span></div>' +
      '<div class="stat"><b>' + fmtUsd(top.implied_value_usd) + '</b><span>top implied value — ' + esc(top.name) + '</span></div>' +
      '<div class="stat"><b>' + fmtUsd(total) + '</b><span>total implied value</span></div>' +
      '<div class="stat"><b>' + tiers.HIGH + '</b><span>rows marked HIGH risk</span></div>' +
      '<div class="riskstrip"><div class="riskbar">' +
      '<i class="LOW" style="width:' + (tiers.LOW / n * 100).toFixed(1) + '%"></i>' +
      '<i class="MEDIUM" style="width:' + (tiers.MEDIUM / n * 100).toFixed(1) + '%"></i>' +
      '<i class="HIGH" style="width:' + (tiers.HIGH / n * 100).toFixed(1) + '%"></i></div>' +
      '<p class="risklegend">Risk across the board: <b class="LOW">LOW ' + tiers.LOW + '</b> · <b class="MEDIUM">MEDIUM ' + tiers.MEDIUM + '</b> · ' +
      '<b class="HIGH">HIGH ' + tiers.HIGH + '</b> — every row is scored from its own figures, and its detail view prints the reasons.</p></div>';
  }
  function renderCats() {
    var agg = {};
    D.rows.forEach(function (r) {
      var c = r.category || 'Other';
      agg[c] = agg[c] || { n: 0, tvl: 0 };
      agg[c].n++;
      agg[c].tvl += r.tvl_usd;
    });
    var list = Object.keys(agg).map(function (c) { return { c: c, n: agg[c].n, tvl: agg[c].tvl }; })
      .sort(function (a, b) { return b.tvl - a.tvl; });
    var max = list.length ? list[0].tvl : 1;
    document.getElementById('cats').innerHTML =
      '<h2>Categories</h2><p class="sub">Click a category to filter the board. TVL is the sector\'s total on this board.</p>' +
      '<div class="catgrid">' + list.map(function (x) {
        return '<button type="button" class="cat' + (state.category === x.c ? ' on' : '') + '" data-cat="' + esc(x.c) + '">' +
          '<span>' + esc(x.c) + '</span><span class="bar"><i style="width:' + Math.max(2, Math.round(x.tvl / max * 100)) + '%"></i></span>' +
          '<span class="n">' + x.n + ' rows</span><span class="tvl">' + fmtUsd(x.tvl) + '</span></button>';
      }).join('') + '</div>';
  }
  function renderModel() {
    var cal = D.calibration, rec = D.reconciliation;
    document.getElementById('model').innerHTML =
      '<h2>How the model works — model ' + esc(D.model_version) + '</h2>' +
      '<p><code>implied = TVL × sector multiple × (1 + clamped 7-day growth × 0.5) × maturity × chain factor</code></p>' +
      '<p><b>New in radar-4: the sector multiple is calibrated from this snapshot, not stated.</b> Every launched ' +
      'protocol in the same snapshot that carries a market cap — ' + cal.samples + ' of them, exchanges excluded, ' +
      'because an exchange token is not a protocol launch — states a market-cap-to-TVL ratio. A band\'s multiple is ' +
      'the median ratio of its launched protocols, shrunk toward the snapshot-wide median (' +
      (cal.global_median_ratio == null ? '—' : cal.global_median_ratio.toFixed(3)) + ') by sample count and clamped ' +
      'to 0.10–0.50, so TVL still decides the ranking. A band with no launched sample would keep the stated radar-3 ' +
      'multiple and say so; in this snapshot every band has samples.</p>' +
      '<table class="calib"><thead><tr><th>Band</th><th>Sectors</th><th>Launched samples</th><th>Median mcap / TVL</th><th>Multiple used</th></tr></thead><tbody>' +
      cal.bands.map(function (b) {
        return '<tr><td><b>' + b.band + '</b></td><td class="l">' + esc(b.label) + '</td><td>' + b.samples + '</td>' +
          '<td>' + (b.median_ratio == null ? '—' : b.median_ratio.toFixed(3)) + '</td>' +
          '<td><b>' + b.multiple.toFixed(3) + '</b>' + (b.source === 'stated' ? ' (stated)' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p>Growth is the 7-day TVL change, clamped to −60%…+120%. Maturity runs 0.6 for a brand-new protocol to 1.0 ' +
      'at three years, so a long track record with no token counts for more. The chain factor adds 2% per extra ' +
      'chain, up to 10%. Age unknown counts as one year. Each detail view walks its own row through the formula ' +
      'step by step, and names the band and sample count behind its multiple.</p>' +
      '<p>Risk-adjusted value is the implied value discounted for the row\'s own risk: ' +
      '<code>risk-adjusted = implied × (1 − 0.5 × risk score)</code>, where the risk score is the row\'s risk ' +
      'points out of 6. It never changes the ranking — the board is always ranked by implied value — but it ' +
      'prices a row\'s risk into the number, so a high-implied, high-risk row does not read the same as a ' +
      'high-implied, low-risk one. Each detail view shows both numbers.</p>' +
      '<p>Coverage: the board ranks every rankable pre-token protocol in the snapshot — the ' + rec.watchlist_ranked +
      '-protocol watchlist plus all ' + rec.early_ranked + ' rankable protocols below the watchlist floor, ' +
      rec.ranked + ' rows in all, with no top-N cut. ' + rec.not_ranked + ' pre-token records are not ranked: ' +
      rec.excluded_exchanges + ' exchanges, ' + rec.excluded_versioned + ' versioned pools of another protocol, and ' +
      rec.excluded_above_floor + ' above the floor that the snapshot\'s own watchlist sets aside — bridges and ' +
      'wrapped or staked products of tokens that already trade. The verification section below names all ' +
      rec.not_ranked + ' of them.</p>' +
      '<p>Risk is scored from the same figures: a sharp 7-day move, a listing under a year old or an ' +
      'unknown listing date, TVL under $100M, a single chain, and a volatile sector each add a point. LOW is 0–2 points, MEDIUM 3–4, HIGH 5–6. ' +
      'The reasons are printed on every row\'s detail view.</p>' +
      '<p>What the radar does not do: no protocol name is ever special-cased, and live-token protocols are never ' +
      'ranked against pre-token ones — their market caps are shown on the Live token tab instead.</p>';
  }

  /* ---- verification: the board's coverage claim, reconciled against the snapshot ---- */
  function renderVerify() {
    var rec = D.reconciliation;
    document.getElementById('verify').innerHTML =
      '<h2>Verify this board</h2>' +
      '<p class="sub">Every number on this page comes from one sealed file, and the build is deterministic: ' +
      're-running it on the same file writes board.json byte for byte again.</p>' +
      '<dl class="kv vkv">' +
      '<dt>Snapshot</dt><dd>DefiLlama public protocol snapshot, as of ' + esc(D.as_of) + '</dd>' +
      '<dt>SHA-256 of the snapshot file</dt><dd class="mono">' + esc(D.snapshot_sha256) + '</dd>' +
      '<dt>Watchlist floor</dt><dd>' + fmtFull(D.floor_usd) + '</dd></dl>' +
      '<table class="calib"><tbody>' +
      '<tr><td class="l">Protocols in the snapshot</td><td><b>' + rec.snapshot_protocols + '</b></td></tr>' +
      '<tr><td class="l">Already record a token — never ranked; the Live token tab shows the top ' + D.live_size + ' by market cap</td><td><b>' + rec.live_token + '</b></td></tr>' +
      '<tr><td class="l">Record no token yet</td><td><b>' + rec.pre_token + '</b></td></tr>' +
      '<tr><td class="l">Ranked on this board — ' + rec.watchlist_ranked + ' watchlist + ' + rec.early_ranked + ' early</td><td><b>' + rec.ranked + '</b></td></tr>' +
      '<tr><td class="l">Not ranked — ' + rec.excluded_exchanges + ' exchanges, ' + rec.excluded_versioned + ' versioned pools, ' + rec.excluded_above_floor + ' above the floor set aside by the snapshot\'s watchlist</td><td><b>' + rec.not_ranked + '</b></td></tr>' +
      '</tbody></table>' +
      '<p>Watchlist rows sit on the snapshot\'s own list, at or above the floor. EARLY rows are every rankable ' +
      'protocol below the floor, where the board applies the brief\'s rule directly: no token, not an exchange, ' +
      'not a versioned pool of another protocol. Above the floor the board follows the snapshot\'s own watchlist, ' +
      'which already sets aside bridges and wrapped or staked products of tokens that trade — WBTC and Binance ' +
      'staked ETH record no token of their own, but they are products of tokens that trade, so they are not ' +
      'launches to rank.</p>' +
      '<details><summary>All ' + rec.not_ranked + ' pre-token records not ranked, by name</summary>' +
      '<ul class="excluded">' + D.excluded.map(function (e) {
        return '<li><b>' + esc(e.name) + '</b> <span>' + esc(e.category || '—') + ' · ' + fmtUsd(e.tvl_usd) + ' · ' + esc(e.reason) + '</span></li>';
      }).join('') + '</ul></details>';
  }

  /* ---- compare: two protocols side by side ---- */
  function rowBySlug(slug) { return D.rows.filter(function (x) { return x.slug === slug; })[0] || null; }
  function renderCompare() {
    var el = document.getElementById('compare');
    var a = state.compare.length > 0 ? rowBySlug(state.compare[0]) : null;
    var b = state.compare.length > 1 ? rowBySlug(state.compare[1]) : null;
    if (!a || !b) { el.hidden = true; el.innerHTML = ''; return; }
    function cell(r, f) { return '<td>' + f(r) + '</td>'; }
    var lines = [
      ['Rank', function (r) { return '#' + r.rank + (WL[r.slug] ? ' · WATCHLIST' : ' · EARLY'); }],
      ['Category', function (r) { return esc(r.category || '—'); }],
      ['Chains', function (r) { return esc(r.chains.join(', ') || '—'); }],
      ['TVL', function (r) { return fmtFull(r.tvl_usd); }],
      ['7-day change', function (r) { return fmtPct(r.change_7d); }],
      ['Age, no token', function (r) { return r.age_days == null ? 'unknown' : r.age_days + ' days'; }],
      ['Sector multiple', function (r) { return r.category_multiple.toFixed(3) + ' (band ' + r.sector_band + ', ' + r.calibration_samples + ' samples)'; }],
      ['Implied value', function (r) { return '<b>' + fmtFull(r.implied_value_usd) + '</b>'; }],
      ['Risk-adjusted', function (r) { return fmtFull(r.risk_adjusted_value_usd); }],
      ['Risk', function (r) { return '<span class="badge ' + r.risk_tier + '">' + r.risk_tier + '</span>'; }]
    ];
    el.hidden = false;
    el.innerHTML = '<div class="detail-head"><h2>Compare</h2>' +
      '<button type="button" class="close" id="clearCompare">Clear ×</button></div>' +
      '<table class="cmp"><thead><tr><th></th><th>' + esc(a.name) + '</th><th>' + esc(b.name) + '</th></tr></thead><tbody>' +
      lines.map(function (ln) { return '<tr><td class="l">' + ln[0] + '</td>' + cell(a, ln[1]) + cell(b, ln[1]) + '</tr>'; }).join('') +
      '</tbody></table>' +
      '<p class="sub" style="margin-top:10px">Same model, same snapshot: the gap between these two rows is TVL, sector, growth, age and chains — nothing else.</p>';
    el.querySelector('#clearCompare').addEventListener('click', function () {
      state.compare = []; writeHash(); renderCompare(); renderDetail();
    });
  }

  /* ---- controls ---- */
  function renderControls() {
    var cats = Array.from(new Set(D.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(D.rows.reduce(function (a, r) { return a.concat(r.chains); }, []))).sort();
    var el = document.getElementById('controls');
    el.innerHTML =
      '<input type="search" id="q" placeholder="Search name, slug or category…" value="' + esc(state.q) + '" aria-label="Search">' +
      '<select id="cat" aria-label="Category"><option value="all">All categories</option>' +
      cats.map(function (c) { return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="chain" aria-label="Chain"><option value="all">All chains</option>' +
      chains.map(function (c) { return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="risk" aria-label="Risk tier"><option value="all">Any risk</option>' +
      ['LOW', 'MEDIUM', 'HIGH'].map(function (t) { return '<option value="' + t + '"' + (state.risk === t ? ' selected' : '') + '>' + t + ' risk</option>'; }).join('') + '</select>' +
      '<span class="tabs"><button type="button" class="tab" data-tab="pre-token" aria-pressed="' + (state.tab === 'pre-token') + '">Pre-token</button>' +
      '<button type="button" class="tab" data-tab="live" aria-pressed="' + (state.tab === 'live') + '">Live token</button></span>' +
      '<label class="chk"><input type="checkbox" id="wl" ' + (state.wlOnly ? 'checked' : '') + '> Watchlist only</label>' +
      '<span class="count" id="count"></span>';
    el.querySelector('#q').addEventListener('input', function (e) { state.q = e.target.value; writeHash(); renderTable(); });
    el.querySelector('#cat').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); renderCats(); renderTable(); });
    el.querySelector('#chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); renderTable(); });
    el.querySelector('#risk').addEventListener('change', function (e) { state.risk = e.target.value; writeHash(); renderTable(); });
    el.querySelector('#wl').addEventListener('change', function (e) { state.wlOnly = e.target.checked; writeHash(); renderTable(); });
    el.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); state.selected = null; writeHash(); render(); });
    });
  }

  /* ---- table ---- */
  function th(key, label) {
    return '<th><button type="button" data-sort="' + key + '">' + label + sortArrow(key) + '</button></th>';
  }
  function renderTable() {
    var el = document.getElementById('table');
    var count = document.getElementById('count');
    if (state.tab === 'live') {
      var live = D.live.slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
      if (count) count.textContent = live.length + ' live-token protocols';
      el.innerHTML = '<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th>TVL</th><th>7d</th><th>Market cap</th></tr></thead><tbody>' +
        live.map(function (p, i) {
          return '<tr data-slug=""><td>' + (i + 1) + '</td><td class="name"><b>' + esc(p.name) + '</b><small>' + esc(p.slug) + '</small></td>' +
            '<td>' + esc(p.category || '—') + '</td><td>' + esc(p.chains.slice(0, 3).join(', ')) + '</td>' +
            '<td>' + fmtUsd(p.tvl_usd) + '</td><td class="' + pctCls(p.change_7d) + '">' + fmtPct(p.change_7d) + '</td>' +
            '<td class="implied">' + fmtUsd(p.mcap_usd) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p style="padding:12px 16px;color:var(--muted);font-size:13px;margin:0">These protocols already trade, so the board shows the market\'s own value — never a model\'s guess — and never ranks them against pre-token ones.</p>';
      return;
    }
    var list = sorted(rows());
    if (count) count.textContent = list.length + ' of ' + D.board_size + ' rows';
    if (!list.length) {
      el.innerHTML = '<div class="empty"><h2>No protocol matches that filter</h2><p>Try a different search, category, chain or risk tier.</p><button type="button" id="clear">Clear filters</button></div>';
      el.querySelector('#clear').addEventListener('click', function () {
        state.q = ''; state.category = 'all'; state.chain = 'all'; state.risk = 'all'; state.wlOnly = false;
        writeHash(); render();
      });
      return;
    }
    el.innerHTML = '<table><thead><tr>' + th('rank', '#') + th('name', 'Protocol') + th('category', 'Category') + '<th>Chains</th>' +
      th('tvl', 'TVL') + th('change', '7d') + th('age', 'Age') + th('implied', 'Implied value') + '<th>Risk</th></tr></thead><tbody>' +
      list.map(function (r) {
        var tag = WL[r.slug] ? '<span class="tag wl">WATCHLIST</span>' : '<span class="tag early">EARLY</span>';
        return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="sel"' : '') + '>' +
          '<td>' + r.rank + '</td>' +
          '<td class="name"><b>' + esc(r.name) + tag + '</b><small>' + esc(r.slug) + '</small></td>' +
          '<td>' + esc(r.category || '—') + '</td>' +
          '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
          '<td>' + fmtUsd(r.tvl_usd) + '</td>' +
          '<td class="' + pctCls(r.change_7d) + '">' + fmtPct(r.change_7d) + '</td>' +
          '<td>' + fmtAge(r.age_days) + '</td>' +
          '<td class="implied">' + fmtUsd(r.implied_value_usd) + '</td>' +
          '<td><span class="badge ' + r.risk_tier + '">' + r.risk_tier + '</span></td></tr>';
      }).join('') + '</tbody></table>';
    el.querySelectorAll('th button[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
        writeHash(); renderTable();
      });
    });
    el.querySelectorAll('tbody tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        state.selected = tr.getAttribute('data-slug');
        writeHash(); renderDetail(); renderTable();
        document.getElementById('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  /* ---- detail view ---- */
  function renderDetail() {
    var el = document.getElementById('detail');
    var r = state.selected ? D.rows.filter(function (x) { return x.slug === state.selected; })[0] : null;
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    var tag = WL[r.slug] ? '<span class="tag wl">WATCHLIST</span>' : '<span class="tag early">EARLY — below the watchlist floor</span>';
    var steps = farmSteps(r);
    var inCompare = state.compare.indexOf(r.slug) >= 0;
    var afterGrowth = Math.round(r.base_value_usd * r.growth_multiplier);
    var afterMaturity = Math.round(afterGrowth * r.maturity_multiplier);
    el.hidden = false;
    el.innerHTML =
      '<div class="detail-head"><h2>#' + r.rank + ' ' + esc(r.name) + '</h2>' + tag +
      '<span class="cat">' + esc(r.category || '—') + ' · ' + esc(r.chains.join(', ')) + '</span>' +
      '<button type="button" class="close" id="cmpBtn">' + (inCompare ? 'In compare ✓' : 'Compare +') + '</button>' +
      '<button type="button" class="close" id="closeDetail">Close ×</button></div>' +
      '<div class="detail-grid"><div>' +
      '<p class="big">' + fmtFull(r.implied_value_usd) + '</p>' +
      '<p style="margin:0 0 12px;color:var(--muted);font-size:13px">implied launch value under model ' + esc(D.model_version) + '</p>' +
      '<p class="adjline">Risk-adjusted: <b>' + fmtFull(r.risk_adjusted_value_usd) + '</b> — the implied value discounted for this row\'s risk score, so a risky row reads lower than a steady one at the same implied value.</p>' +
      '<dl class="kv">' +
      '<dt>TVL</dt><dd>' + fmtFull(r.tvl_usd) + '</dd>' +
      '<dt>7-day change</dt><dd class="' + pctCls(r.change_7d) + '">' + fmtPct(r.change_7d) + '</dd>' +
      '<dt>Age, no token</dt><dd>' + (r.age_days == null ? 'unknown' : r.age_days + ' days') + '</dd>' +
      '<dt>Risk</dt><dd><span class="badge ' + r.risk_tier + '">' + r.risk_tier + '</span></dd>' +
      '</dl>' +
      '<h3 style="margin-top:16px">Why this risk tier</h3><ul class="reasons">' +
      r.risk_reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '</div><div>' +
      '<h3>How the value is built</h3>' +
      '<p class="eq">' + fmtUsd(r.tvl_usd) + ' × ' + r.category_multiple.toFixed(3) + ' × ' + r.growth_multiplier.toFixed(2) +
      ' × ' + r.maturity_multiplier.toFixed(2) + ' × ' + r.chain_multiplier.toFixed(2) + ' = ' + fmtUsd(r.implied_value_usd) + '</p>' +
      '<ul class="fall">' +
      '<li><span>TVL</span><b>' + fmtUsd(r.tvl_usd) + '</b></li>' +
      '<li><span>× sector multiple ' + r.category_multiple.toFixed(3) + ' — band ' + r.sector_band + ', calibrated from ' + r.calibration_samples + ' launched protocols in this snapshot</span><b>' + fmtUsd(r.base_value_usd) + '</b></li>' +
      '<li><span>× growth ' + r.growth_multiplier.toFixed(2) + ' — its 7-day TVL change, clamped</span><b>' + fmtUsd(afterGrowth) + '</b></li>' +
      '<li><span>× maturity ' + r.maturity_multiplier.toFixed(2) + ' — ' + (r.age_days == null ? 'age unknown, counted as one year' : r.age_days + ' days with no token') + '</span><b>' + fmtUsd(afterMaturity) + '</b></li>' +
      '<li><span>× chain factor ' + r.chain_multiplier.toFixed(2) + ' — ' + (r.chains.length === 1 ? '1 chain' : r.chains.length + ' chains') + '</span><b>' + fmtUsd(r.implied_value_usd) + '</b></li>' +
      '<li><span>risk discount — the row\'s own risk score, priced in</span><b>' + fmtUsd(r.risk_adjusted_value_usd) + ' risk-adjusted</b></li>' +
      '</ul>' +
      '<h3>Farm plan — eight steps</h3><ol class="steps">' +
      steps.map(function (s) {
        return '<li>' + esc(s.t) + '<span class="meta2">Cost: ' + esc(s.c) + ' · Time: ' + esc(s.m) + '</span></li>';
      }).join('') + '</ol>' +
      '</div></div>';
    el.querySelector('#closeDetail').addEventListener('click', function () {
      state.selected = null; writeHash(); renderDetail(); renderTable();
    });
    el.querySelector('#cmpBtn').addEventListener('click', function () {
      var i = state.compare.indexOf(r.slug);
      if (i >= 0) state.compare.splice(i, 1);
      else { state.compare.push(r.slug); if (state.compare.length > 2) state.compare.shift(); }
      writeHash(); renderDetail(); renderCompare();
      if (state.compare.length === 2) document.getElementById('compare').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function render() {
    renderMeta(); renderStats(); renderCats(); renderControls(); renderDetail(); renderCompare(); renderTable(); renderModel(); renderVerify();
  }
  document.getElementById('cats').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-cat]') : null;
    if (!b) return;
    var c = b.getAttribute('data-cat');
    state.category = state.category === c ? 'all' : c;
    writeHash(); renderCats(); renderTable();
  });
  window.addEventListener('hashchange', function () { readHash(); render(); });
  readHash();
  render();
})();
