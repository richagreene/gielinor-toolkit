import React, { useState, useMemo, useEffect, useRef } from "react";
import { Coins, ArrowUpDown, SlidersHorizontal, ChevronDown, ArrowLeft, AlertTriangle, RefreshCw, Layers, Droplet } from "lucide-react";

/* ============================================================
   ON INTEGRATION into coffer-app, delete SAMPLE_FEED, SORTS,
   PRESETS and loadFeed below and instead:
     import { fetchFeed, view, PRESET_NAMES, SORT_KEYS, ago } from "./flips-source.js";
   They're inlined here so this previews standalone with sample data.
   ============================================================ */
const OWNER_REPO = "richagreene/gielinor-toolkit"; // >>> your GitHub owner/repo once the feed is live
const DATA_URL = `https://raw.githubusercontent.com/${OWNER_REPO}/data/flips.json`;

const SORTS = {
  ev: (a, b) => b.evPerHr - a.evPerHr, roi: (a, b) => b.roiPerHr - a.roiPerHr,
  fill: (a, b) => b.pFill - a.pFill, margin: (a, b) => b.netMargin - a.netMargin,
  marginPct: (a, b) => b.netMarginPct - a.netMarginPct, sharpe: (a, b) => b.sharpe - a.sharpe,
  confidence: (a, b) => b.confidence - a.confidence, liquidity: (a, b) => b.liqPerHr - a.liqPerHr,
};
const SORT_LABELS = { ev: "gp / hour", roi: "ROI / hour", fill: "Fill chance", margin: "Net margin", marginPct: "Margin %", sharpe: "Risk-adjusted", confidence: "Confidence", liquidity: "Liquidity" };
const PRESETS = {
  "High-confidence fills": { sort: "confidence", filters: { minFill: 0.7, excludeManip: true } },
  "Most gp/hour": { sort: "ev", filters: { minFill: 0.5, excludeManip: true } },
  "Best ROI (low capital)": { sort: "roi", filters: { maxBuy: 100000, minFill: 0.5 } },
  "Risk-adjusted": { sort: "sharpe", filters: { minFill: 0.6, excludeManip: true } },
  "Deep liquidity": { sort: "liquidity", filters: { minLiq: 500, minFill: 0.6 } },
  "F2P only": { sort: "ev", filters: { membersOk: false, minFill: 0.5 } },
};
const ago = (t) => { const s = Math.floor(Date.now() / 1000) - t; return s < 90 ? "just now" : s < 3600 ? Math.round(s / 60) + "m ago" : Math.round(s / 3600) + "h ago"; };

const W = (fl, fh, rs, st, ag, tx, cf, rl) => ({ fairLow: fl, fairHigh: fh, realizableSpread: rs, spreadStability: st, aggression: ag, taxPerItem: tx, capacityFrom: cf, rollSpread: rl });
const mk = (id, name, members, buy, sell, qty, lim, pFill, pBuy, pSell, ev, roi, shp, conf, liq, lt, imb, stale, manip, kelly, why) =>
  ({ id, name, members, buy, sell, netMargin: sell - buy - why.taxPerItem, netMarginPct: (sell - buy - why.taxPerItem) / buy, qty, capital: buy * qty, buyLimit: lim, pFill, pBuy, pSell, evPerHr: ev, roiPerHr: roi, sharpe: shp, confidence: conf, liqPerHr: liq, liqTier: lt, imbalance: imb, staleMin: stale, manip, kelly, why });

const SAMPLE_FEED = {
  sample: true, generatedAt: Math.floor(Date.now() / 1000) - 420, universe: 312,
  items: [
    mk(565, "Blood rune", true, 256, 268, 25000, 25000, 0.98, 0.99, 0.99, 41800, 0.0065, 2.4, 0.91, 12400, "High", -0.02, 1, false, 0.12, W(256, 268, 12, 0.94, 0.02, 5, "4h buy limit", 11)),
    mk(560, "Death rune", true, 192, 205, 18000, 18000, 0.96, 0.98, 0.98, 38200, 0.011, 2.1, 0.88, 9800, "High", 0.04, 1, false, 0.14, W(192, 205, 13, 0.9, 0.05, 4, "4h buy limit", 12)),
    mk(561, "Nature rune", false, 92, 100, 22000, 22000, 0.97, 0.99, 0.98, 30500, 0.015, 2.6, 0.9, 41000, "High", 0.01, 1, false, 0.1, W(92, 100, 8, 0.95, 0.0, 1, "4h buy limit", 7)),
    mk(1513, "Magic logs", true, 1052, 1124, 12000, 13000, 0.9, 0.95, 0.95, 33000, 0.0026, 1.9, 0.84, 4200, "High", -0.05, 2, false, 0.09, W(1052, 1124, 72, 0.88, 0.03, 22, "4h buy limit", 66)),
    mk(13441, "Anglerfish", true, 1502, 1565, 4000, 6000, 0.88, 0.94, 0.94, 12400, 0.0021, 1.7, 0.81, 5500, "Medium", 0.03, 2, false, 0.08, W(1502, 1565, 63, 0.86, 0.04, 31, "volume participation", 58)),
    mk(536, "Dragon bones", true, 2693, 2761, 3440, 7500, 0.94, 0.97, 0.97, 11300, 0.0017, 1.8, 0.86, 8600, "Medium", 0.0, 3, false, 0.07, W(2693, 2761, 70, 0.91, 0.0, 55, "volume participation", null)),
    mk(2, "Cannonball", true, 191, 200, 11000, 11000, 0.99, 0.99, 0.99, 13900, 0.0066, 2.5, 0.9, 30000, "High", -0.01, 1, false, 0.11, W(191, 200, 9, 0.96, 0.0, 4, "4h buy limit", 8)),
    mk(1127, "Rune platebody", true, 38100, 39550, 70, 70, 0.8, 0.9, 0.89, 9100, 0.0034, 1.4, 0.74, 900, "Low", 0.08, 3, false, 0.06, W(38100, 39550, 1450, 0.82, 0.06, 790, "4h buy limit", 1310)),
    mk(12002, "Occult necklace", true, 820000, 856000, 70, 70, 0.78, 0.9, 0.87, 24600, 0.00043, 1.5, 0.76, 350, "Medium", 0.06, 3, false, 0.05, W(820000, 856000, 36000, 0.8, 0.05, 17120, "4h buy limit", 32800)),
    mk(12924, "Toxic blowpipe", true, 4420000, 4625000, 6, 8, 0.72, 0.86, 0.84, 110000, 0.0041, 1.2, 0.71, 130, "Low", 0.05, 4, false, 0.04, W(4420000, 4625000, 205000, 0.75, 0.05, 92500, "volume participation", 188000)),
    mk(13652, "Dragon claws", true, 78200000, 81100000, 8, 8, 0.6, 0.82, 0.73, 130000, 0.000208, 0.95, 0.61, 60, "Low", 0.12, 5, false, 0.03, W(78200000, 81100000, 4300000, 0.66, 0.04, 1400000, "4h buy limit", 3900000)),
    mk(453, "Coal", false, 148, 158, 25000, 25000, 0.97, 0.99, 0.98, 24000, 0.0065, 2.3, 0.88, 28000, "High", -0.03, 2, false, 0.1, W(148, 158, 10, 0.93, 0.02, 3, "4h buy limit", 9)),
    mk(1515, "Yew logs", true, 271, 301, 9000, 25000, 0.9, 0.95, 0.94, 19500, 0.008, 2.0, 0.85, 7200, "High", 0.02, 2, false, 0.09, W(271, 301, 30, 0.9, 0.0, 6, "volume participation", 27)),
    mk(12819, "Elysian sigil", true, 780000000, 851000000, 1, 8, 0.3, 0.55, 0.54, 92000, 0.000118, 0.4, 0.22, 8, "Low", 0.41, 38, true, 0.0, W(780000000, 851000000, 71000000, 0.31, 0.0, 5000000, "volume participation", 41000000)),
  ],
};

async function loadFeed() {
  try { const r = await fetch(`${DATA_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" }); if (r.ok) { const d = await r.json(); return { ...d, sample: false }; } } catch (e) {}
  return SAMPLE_FEED;
}

/* ---------- helpers ---------- */
const gp = (n) => { if (n == null || isNaN(n)) return "—"; const neg = n < 0, a = Math.abs(n); let s; if (a >= 1e9) s = (a / 1e9).toFixed(2).replace(/\.?0+$/, "") + "b"; else if (a >= 1e6) s = (a / 1e6).toFixed(2).replace(/\.?0+$/, "") + "m"; else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k"; else s = String(Math.round(a)); return (neg ? "−" : "") + s; };
const pctf = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n * 100).toFixed(1) + "%";
const num = (v) => v.replace(/[^0-9]/g, "");
const parseGp = (s) => Number(String(s).replace(/[^0-9]/g, "")) || 0;

function ItemIcon({ id, name, size = 30 }) {
  const [bad, setBad] = useState(false);
  if (id && !bad) return <img className="ico" style={{ width: size, height: size }} src={`https://static.runelite.net/cache/item/icon/${id}.png`} alt="" onError={() => setBad(true)} />;
  return <span className="ico-g" style={{ width: size, height: size }}>{(name || "?")[0]}</span>;
}
const fillTone = (p) => (p >= 0.8 ? "up" : p >= 0.6 ? "warn" : "down");

function view(items, { preset, sort, filters = {}, capital, bankroll }) {
  const p = preset && PRESETS[preset] ? PRESETS[preset] : {};
  const f = { ...(p.filters || {}), ...filters };
  const cap = parseGp(capital), bank = parseGp(bankroll);
  let rows = items.filter((r) =>
    (f.membersOk === false ? !r.members : f.membersOk === true ? r.members : true) &&
    (f.minFill == null || r.pFill >= f.minFill) &&
    (f.maxBuy == null || r.buy <= f.maxBuy) &&
    (f.minBuy == null || r.buy >= f.minBuy) &&
    (f.minLiq == null || r.liqPerHr >= f.minLiq) &&
    (f.excludeManip ? !r.manip : true) &&
    (!cap || r.buy <= cap)
  );
  rows = rows.slice().sort(SORTS[sort || p.sort || "ev"]);
  return rows.map((r) => {
    const affQty = cap ? Math.max(0, Math.min(r.qty, Math.floor(cap / Math.max(1, r.buy)))) : r.qty;
    return { ...r, affQty, kellyGp: bank ? Math.round((r.kelly || 0) * bank) : null };
  });
}

/* ---------- a single flip ---------- */
function FlipRow({ r, capital }) {
  const [open, setOpen] = useState(false);
  const w = r.why || {};
  return (
    <div className={"row" + (r.manip ? " flagged" : "")}>
      <button className="row-main" onClick={() => setOpen(!open)}>
        <div className="row-id">
          <ItemIcon id={r.id} name={r.name} />
          <div className="row-name">
            <span className="nm">{r.name}{!r.members && <span className="f2p">F2P</span>}{r.manip && <span className="flag"><AlertTriangle size={10} /> thin</span>}</span>
            <span className="prices"><span className="mono">{gp(r.buy)}</span><span className="arr">→</span><span className="mono">{gp(r.sell)}</span></span>
          </div>
        </div>
        <div className="row-fig">
          <span className="ev mono">{gp(r.evPerHr)}</span><span className="ev-l">gp/hr</span>
        </div>
      </button>

      <div className="chips">
        <span className={"chip " + fillTone(r.pFill)}>{Math.round(r.pFill * 100)}% fill</span>
        <span className={"chip liq-" + r.liqTier.toLowerCase()}><Droplet size={10} /> {r.liqTier}</span>
        <span className="chip net">{pctf(r.netMarginPct)} · {gp(r.netMargin)}/ea</span>
        <span className="chip qty">×{(capital ? r.affQty : r.qty).toLocaleString()}</span>
        {r.kellyGp != null && <span className="chip kelly">commit ~{gp(r.kellyGp)}</span>}
        <button className="why-btn" onClick={() => setOpen(!open)}>Why <ChevronDown size={12} className={open ? "flip" : ""} /></button>
      </div>

      {open && (
        <div className="why">
          <div className="why-grid">
            <div><span className="wl">Fair bid / ask</span><span className="wv mono">{gp(w.fairLow)} / {gp(w.fairHigh)}</span></div>
            <div><span className="wl">Place buy / sell</span><span className="wv mono">{gp(r.buy)} / {gp(r.sell)}</span></div>
            <div><span className="wl">Realizable spread</span><span className="wv mono">{gp(w.realizableSpread)}{w.rollSpread != null ? `  (Roll ${gp(w.rollSpread)})` : ""}</span></div>
            <div><span className="wl">GE tax / unit</span><span className="wv mono">−{gp(w.taxPerItem)}</span></div>
            <div><span className="wl">Fill legs (buy / sell)</span><span className="wv mono">{Math.round(r.pBuy * 100)}% / {Math.round(r.pSell * 100)}%</span></div>
            <div><span className="wl">Spread stability</span><span className="wv mono">{Math.round((w.spreadStability ?? 0) * 100)}%</span></div>
            <div><span className="wl">Capacity from</span><span className="wv">{w.capacityFrom}{r.buyLimit ? ` · 4h limit ${r.buyLimit.toLocaleString()}` : ""}</span></div>
            <div><span className="wl">Liquidity (2-sided)</span><span className="wv mono">{r.liqPerHr.toLocaleString()}/hr</span></div>
            <div><span className="wl">Order-flow imbalance</span><span className="wv mono">{r.imbalance > 0 ? "+" : ""}{(r.imbalance * 100).toFixed(0)}% {r.imbalance > 0.1 ? "(demand)" : r.imbalance < -0.1 ? "(supply)" : ""}</span></div>
            <div><span className="wl">Risk-adj (Sharpe)</span><span className="wv mono">{r.sharpe.toFixed(2)}</span></div>
            <div><span className="wl">Confidence</span><span className="wv mono">{Math.round(r.confidence * 100)}%</span></div>
            <div><span className="wl">Last trade</span><span className="wv mono">{r.staleMin}m ago</span></div>
          </div>
          {r.manip && <div className="why-warn"><AlertTriangle size={12} /> Last print is far from the robust average on thin volume — likely a spike or manipulation. Treat the spread as unreliable.</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- main ---------- */
export default function Flips({ onHome }) {
  const [feed, setFeed] = useState(SAMPLE_FEED);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState("High-confidence fills");
  const [sort, setSort] = useState(null);
  const [capital, setCapital] = useState("");
  const [bankroll, setBankroll] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [members, setMembers] = useState("all"); // all | members | f2p
  const [minFill, setMinFill] = useState(0);
  const [maxBuy, setMaxBuy] = useState("");
  const [minBuy, setMinBuy] = useState("");
  const [minLiq, setMinLiq] = useState("");
  const [excludeManip, setExcludeManip] = useState(true);
  const [sortOpen, setSortOpen] = useState(false);

  const refresh = async () => { setLoading(true); const f = await loadFeed(); setFeed(f); setLoading(false); };
  useEffect(() => { refresh(); }, []);

  const filters = useMemo(() => {
    const f = {};
    if (members !== "all") f.membersOk = members === "members";
    if (minFill > 0) f.minFill = minFill / 100;
    if (maxBuy) f.maxBuy = parseGp(maxBuy);
    if (minBuy) f.minBuy = parseGp(minBuy);
    if (minLiq) f.minLiq = parseGp(minLiq);
    f.excludeManip = excludeManip;
    return f;
  }, [members, minFill, maxBuy, minBuy, minLiq, excludeManip]);

  const rows = useMemo(() => view(feed.items, { preset, sort, filters, capital, bankroll }), [feed, preset, sort, filters, capital, bankroll]);
  const activeSort = sort || (preset && PRESETS[preset]?.sort) || "ev";
  const filterCount = (members !== "all" ? 1 : 0) + (minFill > 0 ? 1 : 0) + (maxBuy ? 1 : 0) + (minBuy ? 1 : 0) + (minLiq ? 1 : 0) + (!excludeManip ? 1 : 0);

  return (
    <div className="flips">
      <style>{CSS}</style>

      <header className="hd">
        <div className="hd-l">{onHome && <button className="fl-back" onClick={onHome} title="All tools"><ArrowLeft size={18} /></button>}<Coins size={20} /><h1>Flips</h1></div>
        <div className="hd-r">
          <span className={"feed " + (feed.sample ? "warn" : "live")}>{feed.sample ? "Sample data" : "Live"} · {ago(feed.generatedAt)}</span>
          <button className="ic-btn" onClick={refresh}><RefreshCw size={15} className={loading ? "spin" : ""} /></button>
        </div>
      </header>
      {feed.sample && <div className="banner">Showing sample data. Set your repo in <code>OWNER_REPO</code> and run the Action to go live.</div>}

      <div className="cap-row">
        <label className="cap"><span>Capital</span><input inputMode="numeric" value={capital} onChange={(e) => setCapital(num(e.target.value))} placeholder="any" />{capital && <em>{gp(parseGp(capital))}</em>}</label>
        <label className="cap"><span>Bankroll</span><input inputMode="numeric" value={bankroll} onChange={(e) => setBankroll(num(e.target.value))} placeholder="for sizing" />{bankroll && <em>{gp(parseGp(bankroll))}</em>}</label>
      </div>

      <div className="presets">
        {Object.keys(PRESETS).map((p) => <button key={p} className={"pset" + (preset === p ? " on" : "")} onClick={() => { setPreset(p); setSort(null); }}>{p}</button>)}
      </div>

      <div className="tools">
        <div className="sort-wrap">
          <button className="tool" onClick={() => setSortOpen(!sortOpen)}><ArrowUpDown size={14} /> {SORT_LABELS[activeSort]} <ChevronDown size={13} className={sortOpen ? "flip" : ""} /></button>
          {sortOpen && <div className="menu">{Object.keys(SORTS).map((k) => <button key={k} className={"menu-i" + (activeSort === k ? " on" : "")} onClick={() => { setSort(k); setSortOpen(false); }}>{SORT_LABELS[k]}</button>)}</div>}
        </div>
        <button className={"tool" + (filterCount ? " act" : "")} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={14} /> Filters{filterCount ? ` · ${filterCount}` : ""}</button>
      </div>

      {showFilters && (
        <div className="filters">
          <div className="frow seg-row">
            <span className="fl">Account</span>
            <div className="seg">{["all", "members", "f2p"].map((m) => <button key={m} className={members === m ? "on" : ""} onClick={() => setMembers(m)}>{m === "all" ? "All" : m === "members" ? "Members" : "F2P"}</button>)}</div>
          </div>
          <div className="frow">
            <span className="fl">Min fill chance <b>{minFill}%</b></span>
            <input type="range" min="0" max="95" step="5" value={minFill} onChange={(e) => setMinFill(+e.target.value)} />
          </div>
          <div className="frow two">
            <label><span className="fl">Min price</span><input inputMode="numeric" value={minBuy} onChange={(e) => setMinBuy(num(e.target.value))} placeholder="0" /></label>
            <label><span className="fl">Max price</span><input inputMode="numeric" value={maxBuy} onChange={(e) => setMaxBuy(num(e.target.value))} placeholder="any" /></label>
          </div>
          <div className="frow"><label className="full"><span className="fl">Min liquidity / hr</span><input inputMode="numeric" value={minLiq} onChange={(e) => setMinLiq(num(e.target.value))} placeholder="any" /></label></div>
          <label className="chkrow" onClick={() => setExcludeManip(!excludeManip)}><span className={"box" + (excludeManip ? " on" : "")} />Hide thin / manipulated items</label>
        </div>
      )}

      <div className="count">{rows.length} flip{rows.length !== 1 ? "s" : ""}{feed.universe ? ` · from ${feed.universe} liquid items` : ""}</div>

      <div className="list">
        {rows.length === 0 && <div className="empty"><Layers size={26} /><p>Nothing matches these filters. Loosen the fill chance or price range.</p></div>}
        {rows.slice(0, 80).map((r) => <FlipRow key={r.id} r={r} capital={capital} />)}
        {rows.length > 80 && <div className="more">Showing the top 80 of {rows.length} — tighten the filters to narrow it down.</div>}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
.flips{--bg:#0a0c10;--p1:#12151c;--p2:#171b24;--p3:#1d222c;--ln:rgba(255,255,255,.07);--ln2:rgba(255,255,255,.12);--tx:#e7ebf2;--mu:#8b94a4;--fa:#5a6373;--gold:#f5b62b;--gold2:#ffcf5e;--up:#46d07f;--warn:#f3a82f;--down:#f0664e;
  font-family:'Sora',system-ui,sans-serif;color:var(--tx);background:var(--bg);min-height:100dvh;padding:0 14px 60px;max-width:760px;margin:0 auto}
.flips *{box-sizing:border-box}
.mono{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
.spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.flip{transform:rotate(180deg)}

.hd{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:16px 2px 13px;background:linear-gradient(180deg,var(--bg) 78%,transparent);backdrop-filter:blur(6px)}
.hd-l{display:flex;align-items:center;gap:9px}.hd-l svg{color:var(--gold)}
.hd-l h1{font-family:'Cinzel',serif;font-weight:700;font-size:23px;margin:0;letter-spacing:.01em}
.hd-r{display:flex;align-items:center;gap:9px}
.feed{font-size:11.5px;font-weight:500;padding:3px 9px;border-radius:20px;border:1px solid var(--ln)}
.feed.live{color:var(--up);border-color:rgba(70,208,127,.3);background:rgba(70,208,127,.08)}
.feed.warn{color:var(--warn);border-color:rgba(243,168,47,.3);background:rgba(243,168,47,.08)}
.ic-btn{width:32px;height:32px;border-radius:9px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);display:grid;place-items:center;cursor:pointer}
.ic-btn:hover{color:var(--tx);border-color:var(--ln2)}
.fl-back{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;cursor:pointer;background:var(--p1);border:1px solid var(--ln);color:var(--mu);transition:.16s;margin-right:6px;flex-shrink:0}
.fl-back:hover{color:var(--gold2);border-color:var(--gold)}
.more{text-align:center;font-size:12.5px;color:var(--fa);padding:16px 0 4px}
.banner{font-size:12.5px;color:var(--warn);background:rgba(243,168,47,.07);border:1px solid rgba(243,168,47,.2);border-radius:9px;padding:9px 12px;margin-bottom:12px}
.banner code{font-family:'JetBrains Mono',monospace;font-size:11.5px;background:rgba(255,255,255,.07);padding:1px 5px;border-radius:4px}

.cap-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.cap{position:relative;display:flex;flex-direction:column;gap:4px}
.cap>span{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mu)}
.cap input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--ln);background:var(--p1);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:15px;outline:none}
.cap input:focus{border-color:var(--gold);background:var(--p2)}
.cap em{position:absolute;right:11px;bottom:10px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--gold);pointer-events:none}

.presets{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:11px;scrollbar-width:none}.presets::-webkit-scrollbar{display:none}
.pset{flex-shrink:0;padding:8px 14px;border-radius:20px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:13px;font-weight:500;cursor:pointer;transition:.14s;white-space:nowrap}
.pset:hover{color:var(--tx);border-color:var(--ln2)}
.pset.on{background:linear-gradient(180deg,var(--gold2),var(--gold));color:#231804;border-color:transparent;font-weight:600}

.tools{display:flex;gap:9px;margin-bottom:12px}
.sort-wrap{position:relative}
.tool{display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:10px;border:1px solid var(--ln);background:var(--p1);color:var(--tx);font-family:'Sora';font-size:13px;font-weight:500;cursor:pointer}
.tool:hover{border-color:var(--ln2)}.tool.act,.tool.act:hover{border-color:var(--gold);color:var(--gold2)}
.tool svg{color:var(--mu)}.tool.act svg{color:var(--gold)}
.menu{position:absolute;top:calc(100% + 6px);left:0;z-index:30;background:var(--p2);border:1px solid var(--ln2);border-radius:11px;padding:5px;min-width:172px;box-shadow:0 14px 34px rgba(0,0,0,.5)}
.menu-i{display:block;width:100%;text-align:left;padding:8px 11px;border-radius:7px;border:none;background:none;color:var(--mu);font-family:'Sora';font-size:13.5px;cursor:pointer}
.menu-i:hover{background:var(--p3);color:var(--tx)}.menu-i.on{color:var(--gold2)}

.filters{background:var(--p1);border:1px solid var(--ln);border-radius:13px;padding:14px;margin-bottom:12px;display:flex;flex-direction:column;gap:14px}
.frow{display:flex;flex-direction:column;gap:8px}
.frow.two{flex-direction:row;gap:12px}.frow.two label{flex:1;display:flex;flex-direction:column;gap:6px}
.fl{font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mu)}
.fl b{color:var(--gold2);font-family:'JetBrains Mono',monospace;margin-left:4px}
.filters input[type=text],.filters input:not([type]){width:100%}
.filters input[inputmode=numeric]{padding:9px 11px;border-radius:9px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:14px;outline:none}
.filters input[inputmode=numeric]:focus{border-color:var(--gold)}
.full{display:flex;flex-direction:column;gap:6px}
.seg-row{flex-direction:row;align-items:center;justify-content:space-between}
.seg{display:flex;background:var(--bg);border:1px solid var(--ln);border-radius:9px;padding:3px}
.seg button{padding:6px 13px;border-radius:7px;border:none;background:none;color:var(--mu);font-family:'Sora';font-size:13px;font-weight:500;cursor:pointer}
.seg button.on{background:var(--p3);color:var(--tx)}
input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:var(--p3);outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--gold);cursor:pointer;box-shadow:0 0 0 4px rgba(245,182,43,.15)}
input[type=range]::-moz-range-thumb{width:18px;height:18px;border:none;border-radius:50%;background:var(--gold);cursor:pointer}
.chkrow{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--tx);cursor:pointer}
.box{width:19px;height:19px;border-radius:6px;border:1.5px solid var(--fa);flex-shrink:0;position:relative;transition:.13s}
.box.on{background:var(--gold);border-color:var(--gold)}.box.on::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #231804;border-width:0 2px 2px 0;transform:rotate(45deg)}

.count{font-size:12.5px;color:var(--fa);margin-bottom:10px;padding-left:2px}

.list{display:flex;flex-direction:column;gap:9px}
.row{background:var(--p1);border:1px solid var(--ln);border-radius:13px;overflow:hidden;transition:.14s}
.row:hover{border-color:var(--ln2)}
.row.flagged{border-color:rgba(240,102,78,.3)}
.row-main{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;padding:13px 14px 11px;background:none;border:none;cursor:pointer}
.row-id{display:flex;align-items:center;gap:11px;min-width:0}
.ico{object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.ico-g{display:grid;place-items:center;border-radius:7px;background:var(--p3);border:1px solid var(--ln);font-family:'Cinzel',serif;font-weight:700;color:var(--mu);font-size:15px}
.row-name{display:flex;flex-direction:column;gap:3px;min-width:0}
.nm{display:flex;align-items:center;gap:7px;font-size:15.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.f2p{font-size:9px;font-weight:700;letter-spacing:.05em;color:#8fb3ff;border:1px solid rgba(143,179,255,.35);border-radius:4px;padding:1px 4px}
.flag{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:600;color:var(--down);border:1px solid rgba(240,102,78,.4);border-radius:4px;padding:1px 4px}
.prices{display:flex;align-items:center;gap:7px;font-size:13.5px;color:var(--mu)}.prices .arr{color:var(--fa)}
.row-fig{text-align:right;flex-shrink:0}
.ev{display:block;font-size:18px;font-weight:600;color:var(--gold2)}
.ev-l{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--fa)}

.chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 14px 13px}
.chip{font-size:11.5px;font-weight:500;padding:3px 9px;border-radius:7px;background:var(--p3);color:var(--mu);display:inline-flex;align-items:center;gap:4px}
.chip.up{color:var(--up);background:rgba(70,208,127,.1)}.chip.warn{color:var(--warn);background:rgba(243,168,47,.1)}.chip.down{color:var(--down);background:rgba(240,102,78,.1)}
.chip.liq-high{color:#5ad0c4;background:rgba(90,208,196,.1)}.chip.liq-medium{color:#9aa6b8}.chip.liq-low{color:var(--fa)}
.chip.net{color:var(--tx)}.chip.qty{font-family:'JetBrains Mono',monospace}
.chip.kelly{color:var(--gold2);background:rgba(245,182,43,.1)}
.why-btn{margin-left:auto;display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:var(--mu);font-family:'Sora';font-size:12px;cursor:pointer}
.why-btn:hover{color:var(--tx)}.why-btn svg{transition:.18s}

.why{border-top:1px solid var(--ln);padding:13px 14px;background:rgba(0,0,0,.18)}
.why-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 16px}
.why-grid>div{display:flex;flex-direction:column;gap:2px}
.wl{font-size:10.5px;letter-spacing:.04em;color:var(--fa);text-transform:uppercase}
.wv{font-size:13.5px;color:var(--tx)}
.why-warn{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding:9px 11px;border-radius:8px;background:rgba(240,102,78,.08);border:1px solid rgba(240,102,78,.2);font-size:12.5px;color:#f0a094;line-height:1.45}
.why-warn svg{color:var(--down);flex-shrink:0;margin-top:1px}

.empty{text-align:center;padding:46px 20px;color:var(--fa)}.empty svg{opacity:.5;margin-bottom:10px}.empty p{font-size:14px;margin:0}

@media(max-width:480px){.why-grid{grid-template-columns:1fr 1fr}.ev{font-size:16px}.cap-row{gap:8px}}
`;
