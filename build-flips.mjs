/* =====================================================================
   COFFER FEED BUILDER  ·  runs on a schedule in GitHub Actions
   ---------------------------------------------------------------------
   Four light bulk calls return EVERY item. We keep a rolling per-item
   price history in the 'data' branch (the repo is our database), run the
   engine, and publish flips.json for the frontend to read. Stateless-safe:
   if history is missing (first run) we simply start accumulating.
   ===================================================================== */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeUniverse } from "../src/coffer-engine.js";

const BASE = "https://prices.runescape.wiki/api/v1/osrs";

/* >>> EDIT THIS <<<  The OSRS Wiki asks API users for a descriptive
   User-Agent with a way to contact you. Put your RSN or email here. */
const UA = "Coffer flip-analytics — contact: athleticthief@yahoo.com";

const REPO = process.env.GITHUB_REPOSITORY || "richagreene/gielinor-toolkit";
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
const round = (x, d = 0) => (x == null || isNaN(x)) ? null : +(+x).toFixed(d);

export async function main() {
  const now = Math.floor(Date.now() / 1000);

  // 1) prior rolling history (data branch = database; safe if absent)
  let history = {};
  try { const r = await fetch(HISTORY_URL, { headers: { "User-Agent": UA } }); if (r.ok) history = await r.json(); } catch (e) { /* first run */ }

  // 2) bulk market data
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
    arr.push([now, a.avgHighPrice, a.avgLowPrice, sv, bv]); // compact tuple
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
    netMargin: Math.round(r.netMargin), netMarginPct: round(r.netMarginPct, 4),
    pFill: round(r.pFill, 3), pBuy: round(r.pBuy, 3), pSell: round(r.pSell, 3),
    evPerHr: Math.round(r.evPerHr), roiPerHr: round(r.roiPerHr, 5), sharpe: round(r.sharpe, 2),
    utility: Math.round(r.utility), kelly: round(r.kelly, 3), confidence: round(r.confidence, 3),
    imbalance: round(r.imbalance, 2),
  }));

  // 6) publish feed + state
  mkdirSync("out", { recursive: true });
  writeFileSync("out/flips.json", JSON.stringify({ generatedAt: now, count: rows.length, universe: items.length, items: rows }));
  writeFileSync("out/history.json", JSON.stringify(history));
  console.log(`[coffer] ${rows.length} flips / ${items.length} items · history ${Object.keys(history).length} · ${new Date(now * 1000).toISOString()}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error("[coffer] pipeline failed:", e); process.exit(1); });
