import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* ============================================================
   SELF-CONTAINED build script — the engine is inlined below, so
   this ONE file is everything GitHub Actions needs. No imports
   beyond Node builtins, no separate coffer-engine.js on the backend.
   Frontend keeps its own lightweight sort/preset logic.
   ============================================================ */

/* =====================================================================
   COFFER ENGINE  ·  quant core for OSRS Grand Exchange flip ranking
   ---------------------------------------------------------------------
   Framework-agnostic. No dependencies. Runs in Node (a scheduled
   pipeline) or in the browser (a zero-infra MVP). The UI never sees any
   of this — it consumes the ranked output objects and renders chips.

   THE CORE PROBLEM
   The Grand Exchange is a hidden-orderbook double auction. We do NOT see
   depth. We only observe, per item:
     • last instant-buy / instant-sell price + their timestamps   (/latest)
     • static metadata incl. the 4h buy limit                     (/mapping)
     • average instant-buy/sell price + traded volumes per window (/5m,/1h,/24h)
     • a historical series of the above                           (/timeseries)
   So "will my order fill, and at what price" is a STATISTICAL INFERENCE
   from trade prints + volumes — not a lookup. Every model below exists to
   turn the *theoretical* spread (which doesn't fill) into *realized* gp.

   API FIELD MAPPING (OSRS Wiki real-time prices API)
     latest.high / latest.low        = last instant-buy / instant-sell price
     latest.highTime / lowTime       = unix secs of those last trades
     hN.avgHighPrice / avgLowPrice   = avg instant-buy / instant-sell in window
                                       (these ARE the effective ask / bid)
     hN.highPriceVolume / lowPrice…  = units bought / sold in the window
     meta.limit                      = max units buyable per 4 hours (hard cap)
   ===================================================================== */

const PARAMS = {
  horizonHours: 4,        // planning window = one buy-limit cycle
  lambdaEwma: 0.94,       // RiskMetrics decay for recency-weighted stats
  maxStaleMin: 45,        // discard quotes whose last print is older than this
  staleHalfLifeMin: 30,   // exponential confidence decay with staleness
  minVolPerHr: 30,        // both sides must trade at least this many units/hr
  participation: 0.10,    // realistically capture ≤10% of traded volume
  taxRate: 0.02, taxCap: 5_000_000,
  riskAversion: 0.6,      // mean-variance penalty (γ) for the utility score
  kellyFraction: 0.5,     // half-Kelly for position sizing (safety)
  offsetSteps: 60,        // grid resolution when optimizing order prices
  manipSigma: 3.0,        // latest vs robust-mean deviation that flags a spike
};

/* ---------- GE tax: 2%, capped 5m, floor at <50gp, exempt items ---------- */
function geTax(sell, exempt) {
  if (exempt || !sell || sell < 50) return 0;
  return Math.min(Math.floor(sell * PARAMS.taxRate), PARAMS.taxCap);
}

/* ---------- statistics primitives ---------- */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function ewma(xs, lambda) {                // recency-weighted mean (newest last)
  let num = 0, den = 0, w = 1;
  for (let i = xs.length - 1; i >= 0; i--) { num += w * xs[i]; den += w; w *= lambda; }
  return den ? num / den : 0;
}
function ewmVar(xs, lambda, mean) {        // recency-weighted variance
  let num = 0, den = 0, w = 1;
  for (let i = xs.length - 1; i >= 0; i--) { num += w * (xs[i] - mean) ** 2; den += w; w *= lambda; }
  return den ? num / den : 0;
}
function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mad(xs, med) {                     // median absolute deviation (robust σ)
  if (!xs.length) return 0;
  const m = med ?? median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - m))); // 1.4826 → σ-consistent
}
function erf(x) {                           // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2)); // Φ(z)

/* ---------- Roll (1984) effective-spread estimator (cross-check) ----------
   Implied spread from the negative serial covariance of mid-price changes:
   s = 2·√(−Cov(Δp_t, Δp_{t-1})). Lets us sanity-check the directly observed
   avgHigh−avgLow spread using only the mid series (robust to one bad side). */
function rollSpread(mids) {
  if (mids.length < 3) return null;
  const d = []; for (let i = 1; i < mids.length; i++) d.push(mids[i] - mids[i - 1]);
  let cov = 0, n = 0;
  for (let i = 1; i < d.length; i++) { cov += d[i] * d[i - 1]; n++; }
  cov = n ? cov / n : 0;
  return cov < 0 ? 2 * Math.sqrt(-cov) : 0;
}

/* ---------- Poisson fill-probability for one passive leg ----------
   Counterparties arrive at rate ∝ volume/hr. A seller fills YOUR buy only
   if the prevailing instant-sell price ≤ your price; modelling the traded
   price as ~Normal(fair, σ), that acceptance fraction is Φ((price−fair)/σ).
   Effective fill rate = volPerHr · Φ(...) ; P(≥1 fill in T) = 1 − e^(−rate·T).
   side = +1 for a BUY leg (higher price → easier), −1 for a SELL leg. */
function fillProbLeg(price, fair, sigma, volPerHr, horizonHrs, side) {
  if (sigma <= 0) sigma = Math.max(1, fair * 0.002);
  const z = side * (price - fair) / sigma;
  const rate = volPerHr * clamp(normCdf(z), 1e-4, 1);
  return 1 - Math.exp(-rate * horizonHrs);
}

/* ---------- square-root law of market impact ----------
   Buying Q of an item that trades V/hr with volatility σ moves price by
   ≈ σ·√(Q/V). Used to slip the fill price against you for size, so the
   optimizer won't recommend a quantity that eats its own margin. */
const impactSlip = (qty, volPerHr, sigma) => sigma * Math.sqrt(qty / Math.max(1, volPerHr));

/* =====================================================================
   PER-ITEM SCORER
   item = { meta:{id,name,members,limit}, latest:{high,low,highTime,lowTime},
            h1, h24, history:[{avgHigh,avgLow,highVol,lowVol,t}] }
   opts = { nowSec, budget, membersOk, ...PARAMS overrides }
   ===================================================================== */
function scoreItem(item, opts = {}) {
  const P = { ...PARAMS, ...opts };
  const { meta, latest, h1, h24, history = [] } = item;
  const reject = (reason) => ({ id: meta.id, name: meta.name, eligible: false, reason });

  // --- volumes per hour (prefer 1h window; fall back to 24h/24) ---
  const buyVolHr = (h1?.lowPriceVolume ?? (h24?.lowPriceVolume || 0) / 24);   // sellers → fill our BUY
  const sellVolHr = (h1?.highPriceVolume ?? (h24?.highPriceVolume || 0) / 24); // buyers  → fill our SELL

  // --- GATE 1a: recency. A stale quote is a mirage. ---
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const lastTrade = Math.max(latest?.highTime || 0, latest?.lowTime || 0);
  const staleMin = lastTrade ? (now - lastTrade) / 60 : Infinity;
  if (staleMin > P.maxStaleMin) return reject("stale (" + Math.round(staleMin) + "m)");

  // --- GATE 1b: two-sided liquidity via harmonic mean (→0 if either side thin) ---
  const liq = (buyVolHr > 0 && sellVolHr > 0) ? 2 * buyVolHr * sellVolHr / (buyVolHr + sellVolHr) : 0;
  if (liq < P.minVolPerHr) return reject("thin (" + Math.round(liq) + "/hr two-sided)");

  // --- GATE 1c: order-flow imbalance. Heavily one-sided → passive side won't fill. ---
  const imbalance = (sellVolHr - buyVolHr) / (sellVolHr + buyVolHr); // +1 demand-heavy, −1 supply-heavy
  if (Math.abs(imbalance) > 0.85) return reject("one-sided book");

  // --- fair value (recency-weighted), robust to spikes ---
  const lows = history.map((h) => h.avgLow).filter(Boolean);
  const highs = history.map((h) => h.avgHigh).filter(Boolean);
  const mids = history.map((h) => (h.avgHigh + h.avgLow) / 2).filter(Boolean);
  const fairLow = lows.length ? ewma(lows, P.lambdaEwma) : (h1?.avgLowPrice || latest.low);
  const fairHigh = highs.length ? ewma(highs, P.lambdaEwma) : (h1?.avgHighPrice || latest.high);
  // dispersion of each traded side → σ for the fill model (robust MAD, EWMA fallback)
  const sigLow = lows.length >= 4 ? Math.max(mad(lows), Math.sqrt(ewmVar(lows, P.lambdaEwma, fairLow))) : fairLow * 0.01;
  const sigHigh = highs.length >= 4 ? Math.max(mad(highs), Math.sqrt(ewmVar(highs, P.lambdaEwma, fairHigh))) : fairHigh * 0.01;

  // --- realizable spread: directly observed (avgHigh−avgLow), cross-checked by Roll ---
  const obsSpread = fairHigh - fairLow;   // avgHigh/avgLow ARE the effective ask/bid → the observed spread is ground truth
  const roll = rollSpread(mids);          // cross-check only; NOT used to shrink (too noisy on an averaged series)
  const realizableSpread = obsSpread;
  // spread stability: low coefficient-of-variation = dependable capture
  const spreadSeries = history.map((h) => h.avgHigh - h.avgLow).filter((x) => x > 0);
  const spreadMean = spreadSeries.length ? median(spreadSeries) : obsSpread;
  const spreadCoV = spreadMean > 0 && spreadSeries.length ? mad(spreadSeries, spreadMean) / spreadMean : 0.5;

  // --- GATE 2: must clear tax with something left after a competitive haircut ---
  const taxAtHigh = geTax(fairHigh, meta.exempt);
  if (realizableSpread - taxAtHigh <= 0) return reject("spread < tax");

  // --- manipulation flag: latest print far from robust mean on thin volume ---
  const robustMid = mids.length ? median(mids) : (fairHigh + fairLow) / 2;
  const devSig = sigHigh > 0 ? Math.abs((latest.high || fairHigh) - robustMid) / sigHigh : 0;
  const manip = devSig > P.manipSigma && liq < P.minVolPerHr * 3;

  // --- capacity: 4h buy limit ∩ participation share of volume over the horizon ---
  const limit = meta.limit || Infinity;
  const partCap = Math.floor(P.participation * Math.min(buyVolHr, sellVolHr) * P.horizonHours);
  let qtyCap = Math.max(1, Math.min(limit, partCap || limit));

  // --- OPTIMIZE order prices: trade margin ↔ fill-probability to MAX EV/hr ---
  // place buy at fairLow + k·spread, sell at fairHigh − k·spread ; search k∈[0,0.5].
  const budget = opts.budget ?? Infinity;
  const volH = Math.min(buyVolHr, sellVolHr) * P.horizonHours;            // executable volume over the horizon
  const cImpact = ((sigLow + sigHigh) / 2) / Math.sqrt(Math.max(1, volH)); // market-impact slip per leg = cImpact·√qty
  let best = null;
  for (let i = 0; i <= P.offsetSteps; i++) {
    const k = 0.5 * (i / P.offsetSteps);
    const buy0 = fairLow + k * realizableSpread;
    const sell0 = fairHigh - k * realizableSpread;
    const s0 = (sell0 - buy0) - geTax(sell0, meta.exempt);   // net per unit BEFORE market impact
    if (s0 <= 0) continue;
    // EV(q) = (s0·q − 2·cImpact·q^1.5)·pBoth / H  →  impact-optimal size at √q* = s0 / (3·cImpact)
    const qStar = cImpact > 0 ? Math.pow(s0 / (3 * cImpact), 2) : qtyCap;
    const qty = Math.max(1, Math.min(qtyCap, Math.floor(budget / Math.max(1, buy0)) || qtyCap, Math.floor(qStar) || qtyCap));
    const slip = cImpact * Math.sqrt(qty);                   // per leg
    const buy = buy0 + slip, sell = sell0 - slip;
    const net = (sell - buy) - geTax(sell, meta.exempt);
    if (net <= 0) continue;
    const pBuy = fillProbLeg(buy, fairLow, sigLow, buyVolHr, P.horizonHours, +1);
    const pSell = fillProbLeg(sell, fairHigh, sigHigh, sellVolHr, P.horizonHours, -1);
    const pBoth = pBuy * pSell;                              // independence approximation
    const evPerHr = (net * qty * pBoth) / P.horizonHours;
    if (!best || evPerHr > best.evPerHr) best = { k, buy, sell, qty, net, pBuy, pSell, pBoth, evPerHr };
  }
  if (!best || best.evPerHr <= 0) return reject("no profitable fillable price");

  const buy = Math.round(best.buy), sell = Math.round(best.sell);
  const netMargin = best.net, capital = buy * best.qty;
  const roiPerHr = capital > 0 ? best.evPerHr / capital : 0;

  // --- risk adjustment + sizing ---
  // per-flip profit variance driven by spread instability → Sharpe-like ratio
  const profitSigma = Math.max(1, spreadCoV * netMargin);
  const sharpe = netMargin / profitSigma;                 // return per unit risk
  const utility = best.evPerHr - P.riskAversion * (profitSigma * best.qty) / P.horizonHours; // mean-variance
  // fractional Kelly: edge = p·b − (1−p) on odds b = margin/price ; f* = edge/b
  const b = netMargin / Math.max(1, buy), p = best.pBoth;
  const kelly = b > 0 ? clamp((p * b - (1 - p)) / b, 0, 1) * P.kellyFraction : 0;
  const kellyGp = opts.bankroll ? Math.round(kelly * opts.bankroll) : null;

  // confidence: blends fill prob, spread stability, liquidity, freshness
  const freshness = Math.pow(0.5, staleMin / P.staleHalfLifeMin);
  const confidence = clamp(best.pBoth * (1 - clamp(spreadCoV, 0, 1)) * freshness, 0, 1);
  const liqTier = liq >= 500 ? "High" : liq >= 120 ? "Medium" : "Low";

  return {
    id: meta.id, name: meta.name, members: !!meta.members, eligible: true,
    buy, sell, netMargin, netMarginPct: capital ? netMargin / buy : 0,
    qty: best.qty, capital, buyLimit: meta.limit || null,
    pFill: best.pBoth, pBuy: best.pBuy, pSell: best.pSell,
    evPerHr: best.evPerHr, roiPerHr, sharpe, utility,
    kelly, kellyGp, confidence, liqTier, liqPerHr: Math.round(liq),
    imbalance, staleMin: Math.round(staleMin), manip,
    why: {                                              // surfaced in an "explain" drawer
      fairLow: Math.round(fairLow), fairHigh: Math.round(fairHigh),
      realizableSpread: Math.round(realizableSpread), rollSpread: roll != null ? Math.round(roll) : null,
      spreadStability: +(1 - clamp(spreadCoV, 0, 1)).toFixed(2),
      aggression: +(best.k).toFixed(3), taxPerItem: geTax(sell, meta.exempt),
      capacityFrom: qtyCap === (meta.limit || Infinity) ? "4h buy limit" : "volume participation",
    },
  };
}

/* =====================================================================
   UNIVERSE: score everything, keep eligible, expose multiple sort keys.
   The pipeline calls this and caches the result; the UI just reads it.
   ===================================================================== */
const SORTS = {
  ev:        (a, b) => b.evPerHr - a.evPerHr,         // expected gp / hour  (default)
  roi:       (a, b) => b.roiPerHr - a.roiPerHr,       // return on capital / hour
  fill:      (a, b) => b.pFill - a.pFill,             // most likely to actually fill
  margin:    (a, b) => b.netMargin - a.netMargin,     // biggest net gp per unit
  marginPct: (a, b) => b.netMarginPct - a.netMarginPct,
  sharpe:    (a, b) => b.sharpe - a.sharpe,           // risk-adjusted
  confidence:(a, b) => b.confidence - a.confidence,
  liquidity: (a, b) => b.liqPerHr - a.liqPerHr,
};

function analyzeUniverse(items, opts = {}) {
  const out = [];
  for (const it of items) { try { const s = scoreItem(it, opts); if (s.eligible) out.push(s); } catch (e) { /* skip malformed */ } }
  const f = opts.filters || {};
  let rows = out.filter((r) =>
    (f.membersOk === false ? !r.members : true) &&
    (f.minFill == null || r.pFill >= f.minFill) &&
    (f.minMargin == null || r.netMargin >= f.minMargin) &&
    (f.maxBuy == null || r.buy <= f.maxBuy) &&
    (f.minBuy == null || r.buy >= f.minBuy) &&
    (f.minLiq == null || r.liqPerHr >= f.minLiq) &&
    (f.excludeManip ? !r.manip : true) &&
    (f.maxCapital == null || r.capital <= f.maxCapital)
  );
  rows.sort(SORTS[opts.sort] || SORTS.ev);
  return rows.slice(0, opts.limit || 100);
}

/* =====================================================================
   PRESETS — one-tap intents that map to filter+sort combos for the UI.
   ===================================================================== */
const PRESETS = {
  "High-confidence fills": { sort: "confidence", filters: { minFill: 0.7, excludeManip: true } },
  "Most gp/hour":          { sort: "ev",         filters: { minFill: 0.5, excludeManip: true } },
  "Best ROI (low capital)":{ sort: "roi",        filters: { maxBuy: 100_000, minFill: 0.5 } },
  "Risk-adjusted":         { sort: "sharpe",     filters: { minFill: 0.6, excludeManip: true } },
  "Deep liquidity":        { sort: "liquidity",  filters: { minLiq: 500, minFill: 0.6 } },
  "F2P only":              { sort: "ev",         filters: { membersOk: false, minFill: 0.5 } },
};

/* ---------------------------------------------------------------------
   EXAMPLE (browser MVP — 4 bulk calls, no backend needed to start):

   const [latest, h1, h24, mapping] = await Promise.all([
     fetch(BASE+'/latest').then(r=>r.json()),
     fetch(BASE+'/1h').then(r=>r.json()),
     fetch(BASE+'/24h').then(r=>r.json()),
     fetch(BASE+'/mapping').then(r=>r.json()),
   ]);  // BASE = 'https://prices.runescape.wiki/api/v1/osrs'
   const byId = Object.fromEntries(mapping.map(m=>[m.id,m]));
   const items = Object.keys(latest.data).map(id => ({
     meta: byId[id], latest: latest.data[id],
     h1: h1.data[id], h24: h24.data[id], history: [],   // history via /timeseries server-side
   })).filter(x=>x.meta);
   const rows = analyzeUniverse(items, { ...PRESETS['High-confidence fills'], budget: 50_000_000, bankroll: 200_000_000 });

   Note: with history:[] the fill model uses 1h/24h dispersion (decent). For full
   recency-weighted vol + Roll + stability, the pipeline supplies `history` from
   /timeseries (or by accumulating /5m snapshots over time).
   ------------------------------------------------------------------- */

/* ===================== FEED BUILDER ===================== */
const BASE = "https://prices.runescape.wiki/api/v1/osrs";

/* >>> EDIT THIS <<<  The OSRS Wiki asks API users for a descriptive
   User-Agent with a way to contact you. Put your RSN or email here. */
const UA = "Coffer flip-analytics — contact: YOUR_RSN_OR_EMAIL";

const REPO = process.env.GITHUB_REPOSITORY || "OWNER/REPO";
const DATA_BRANCH = "data";
const HISTORY_URL = `https://raw.githubusercontent.com/${REPO}/${DATA_BRANCH}/history.json`;

const MAX_SNAPSHOTS = 32;   // rolling depth per item (32 × ~15 min ≈ 8h of context)
const HIST_MIN_VOL = 50;    // only retain history for items trading ≥ this two-sided/hr
const OUT_CAP = 800;        // max eligible rows written to the feed

const getJSON = async (url, label) => {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${label || url} → HTTP ${r.status}`);
  return r.json();
};
const roundN = (x, d = 0) => (x == null || isNaN(x)) ? null : +(+x).toFixed(d);

export async function main() {
  const now = Math.floor(Date.now() / 1000);

  // 1) prior rolling history (the data branch is our database; safe if absent)
  let history = {};
  try { const r = await fetch(HISTORY_URL, { headers: { "User-Agent": UA } }); if (r.ok) history = await r.json(); } catch (e) { /* first run */ }

  // 2) bulk market data — four light calls return EVERY item
  const [latest, h1, h24, mapping] = await Promise.all([
    getJSON(`${BASE}/latest`, "latest"),
    getJSON(`${BASE}/1h`, "1h"),
    getJSON(`${BASE}/24h`, "24h"),
    getJSON(`${BASE}/mapping`, "mapping"),
  ]);
  const meta = Object.fromEntries(mapping.map((m) => [String(m.id), m]));
  const L = latest.data || {}, H1 = h1.data || {}, H24 = h24.data || {};

  // 3) append this snapshot to each liquid item's series; trim; prune dead items
  for (const id of Object.keys(H1)) {
    const a = H1[id]; if (!a || !a.avgHighPrice || !a.avgLowPrice) continue;
    const sv = a.highPriceVolume || 0, bv = a.lowPriceVolume || 0;
    const liq = (bv > 0 && sv > 0) ? (2 * bv * sv) / (bv + sv) : 0;
    if (liq < HIST_MIN_VOL) continue;
    const arr = history[id] || [];
    arr.push([now, a.avgHighPrice, a.avgLowPrice, sv, bv]);
    while (arr.length > MAX_SNAPSHOTS) arr.shift();
    history[id] = arr;
  }
  for (const id of Object.keys(history)) {
    const arr = history[id];
    if (!arr || !arr.length || now - arr[arr.length - 1][0] > 6 * 3600) delete history[id];
  }

  // 4) assemble engine input
  const items = [];
  for (const id of Object.keys(L)) {
    const m = meta[id]; if (!m) continue;
    const hist = (history[id] || []).map(([t, ah, al, hv, lv]) => ({ t, avgHigh: ah, avgLow: al, highVol: hv, lowVol: lv }));
    items.push({
      meta: { id: +id, name: m.name, members: !!m.members, limit: m.limit ?? null, exempt: false },
      latest: L[id], h1: H1[id], h24: H24[id], history: hist,
    });
  }

  // 5) score the whole eligible universe (frontend does presets/filter/sort on this)
  const scored = analyzeUniverse(items, { nowSec: now, limit: 1e9, sort: "ev" });
  const rows = scored.slice(0, OUT_CAP).map((r) => ({
    ...r,
    netMargin: Math.round(r.netMargin), netMarginPct: roundN(r.netMarginPct, 4),
    pFill: roundN(r.pFill, 3), pBuy: roundN(r.pBuy, 3), pSell: roundN(r.pSell, 3),
    evPerHr: Math.round(r.evPerHr), roiPerHr: roundN(r.roiPerHr, 5), sharpe: roundN(r.sharpe, 2),
    utility: Math.round(r.utility), kelly: roundN(r.kelly, 3), confidence: roundN(r.confidence, 3),
    imbalance: roundN(r.imbalance, 2),
  }));

  // 6) publish feed + state
  mkdirSync("out", { recursive: true });
  writeFileSync("out/flips.json", JSON.stringify({ generatedAt: now, count: rows.length, universe: items.length, items: rows }));
  writeFileSync("out/history.json", JSON.stringify(history));
  console.log(`[coffer] ${rows.length} flips / ${items.length} items · history ${Object.keys(history).length} · ${new Date(now * 1000).toISOString()}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error("[coffer] pipeline failed:", e); process.exit(1); });
