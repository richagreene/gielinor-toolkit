import React, { useState, useMemo, useEffect } from "react";
import { ArrowLeft, RefreshCw, Coins, Flame, Hammer, ChevronDown, AlertTriangle, Info, ArrowUpRight, Search } from "lucide-react";

/* ============================================================
   Treasury — live money-maker scanner.
   • Alch tab: ranks every tradeable item by high-alch profit
     (alch − instabuy − nature rune), buy-limit-aware. Fully
     data-driven from the shared prices.json — zero curation.
   • Convert tab: a small set of evergreen deterministic
     conversions with user-editable throughput, priced live.
   Prices: prices.json from the pipeline (now carries alch + limit).
   ============================================================ */
const OWNER_REPO = "richagreene/gielinor-toolkit";
const DATA_URL = `https://raw.githubusercontent.com/${OWNER_REPO}/data/prices.json`;
const ALCH_XP = 65;          // Magic xp per High Level Alchemy cast
const NAT_FALLBACK = 190;    // nature rune price if feed lacks it

/* evergreen deterministic conversions (item names match GE/mapping). Rates are
   editable defaults — tune to your real throughput; the price math is live. */
const CONVERSIONS = [
  { id: "superheat_gold", name: "Superheat gold ore", skill: "Magic + Smithing", reqs: "Magic 43 · Smith 40", rate: 1200, unit: "casts/hr",
    inputs: [{ n: "Gold ore", q: 1 }, { n: "Nature rune", q: 1 }], outputs: [{ n: "Gold bar", q: 1 }], xp: "53 Magic + 22.5 Smith / cast" },
  { id: "cannonballs", name: "Cannonballs", skill: "Smithing", reqs: "Smith 35 · Dwarf Cannon", rate: 640, unit: "bars/hr",
    inputs: [{ n: "Steel bar", q: 1 }], outputs: [{ n: "Cannonball", q: 4 }], xp: "25.6 Smith / bar" },
  { id: "bowstring", name: "Spin flax → bow string", skill: "Crafting", reqs: "Crafting 10", rate: 1400, unit: "spins/hr",
    inputs: [{ n: "Flax", q: 1 }], outputs: [{ n: "Bow string", q: 1 }], xp: "15 Craft / spin" },
  { id: "adamant_dart", name: "Adamant darts", skill: "Fletching", reqs: "Fletching 75", rate: 9000, unit: "darts/hr",
    inputs: [{ n: "Adamant dart tip", q: 1 }, { n: "Feather", q: 1 }], outputs: [{ n: "Adamant dart", q: 1 }], xp: "7.5 Fletch / dart" },
  { id: "string_magic", name: "String magic longbows", skill: "Fletching", reqs: "Fletching 85", rate: 1300, unit: "bows/hr",
    inputs: [{ n: "Magic longbow (u)", q: 1 }, { n: "Bow string", q: 1 }], outputs: [{ n: "Magic longbow", q: 1 }], xp: "83 Fletch / bow" },
];

/* sample feed for offline preview — illustrative numbers only */
const SAMPLE_PRICES = {
  "nature rune": { name: "Nature rune", high: 192, low: 184, vol: 9_500_000, alch: 12, limit: 18000, members: false },
  "yew longbow": { name: "Yew longbow", high: 280, low: 262, vol: 220000, alch: 768, limit: 8000, members: false },
  "magic longbow": { name: "Magic longbow", high: 1120, low: 1080, vol: 90000, alch: 1536, limit: 8000, members: false },
  "rune platebody": { name: "Rune platebody", high: 38000, low: 37200, vol: 9000, alch: 39000, limit: 70, members: false },
  "dragon longsword": { name: "Dragon longsword", high: 58000, low: 57000, vol: 1200, alch: 60000, limit: 70, members: true },
  "adamant platebody": { name: "Adamant platebody", high: 4500, low: 4380, vol: 7000, alch: 3120, limit: 125, members: false },
  "mithril platebody": { name: "Mithril platebody", high: 1300, low: 1250, vol: 4000, alch: 936, limit: 125, members: false },
  "battlestaff": { name: "Battlestaff", high: 8200, low: 8050, vol: 30000, alch: 9000, limit: 11000, members: false },
  "onyx bolts (e)": { name: "Onyx bolts (e)", high: 9500, low: 9300, vol: 60000, alch: 18000, limit: 11000, members: true },
  "gold bar": { name: "Gold bar", high: 108, low: 99, vol: 400000, alch: 96, limit: 11000, members: false },
  "gold ore": { name: "Gold ore", high: 190, low: 178, vol: 250000, alch: 0, limit: 11000, members: false },
  "steel bar": { name: "Steel bar", high: 470, low: 455, vol: 600000, alch: 0, limit: 11000, members: false },
  "cannonball": { name: "Cannonball", high: 195, low: 188, vol: 8_000_000, alch: 0, limit: 11000, members: true },
  "flax": { name: "Flax", high: 22, low: 16, vol: 1_200_000, alch: 0, limit: 13000, members: false },
  "bow string": { name: "Bow string", high: 132, low: 124, vol: 2_000_000, alch: 36, limit: 13000, members: false },
  "adamant dart tip": { name: "Adamant dart tip", high: 28, low: 24, vol: 3_000_000, alch: 0, limit: 11000, members: true },
  "feather": { name: "Feather", high: 3, low: 2, vol: 20_000_000, alch: 0, limit: 30000, members: false },
  "adamant dart": { name: "Adamant dart", high: 42, low: 39, vol: 4_000_000, alch: 0, limit: 11000, members: true },
  "magic longbow (u)": { name: "Magic longbow (u)", high: 980, low: 940, vol: 120000, alch: 0, limit: 11000, members: false },
};

const fmt = (n) => { if (n == null || isNaN(n)) return "—"; const neg = n < 0, a = Math.abs(n); let s; if (a >= 1e9) s = (a / 1e9).toFixed(2).replace(/\.?0+$/, "") + "b"; else if (a >= 1e6) s = (a / 1e6).toFixed(2).replace(/\.?0+$/, "") + "m"; else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k"; else s = String(Math.round(a)); return (neg ? "−" : "") + s; };
const geTax = (p) => (p < 50 ? 0 : Math.min(Math.floor(p * 0.02), 5_000_000));
function priceOf(map, name, side) { const e = map[String(name).toLowerCase()]; if (!e) return null; return side === "low" ? (e.low ?? e.high ?? null) : (e.high ?? e.low ?? null); }

export default function Treasury({ onHome }) {
  const [tab, setTab] = useState("alch");
  const [priceMap, setPriceMap] = useState(SAMPLE_PRICES);
  const [sample, setSample] = useState(true);
  const [feedHasAlch, setFeedHasAlch] = useState(true);
  const [loading, setLoading] = useState(true);

  const [casts, setCasts] = useState(1200);
  const [members, setMembers] = useState("all");      // all | f2p
  const [minVol, setMinVol] = useState(1000);
  const [profitOnly, setProfitOnly] = useState(true);
  const [sort, setSort] = useState("cast");           // cast | gphr | xphr
  const [q, setQ] = useState("");
  const [showCfg, setShowCfg] = useState(false);

  const [rates, setRates] = useState(() => Object.fromEntries(CONVERSIONS.map((c) => [c.id, c.rate])));
  const [convInsta, setConvInsta] = useState(true);    // sell outputs insta (low) vs offer (high)

  const loadPrices = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${DATA_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        const hasAlch = Object.values(d).some((e) => e && e.alch != null);
        setFeedHasAlch(hasAlch);
        if (hasAlch) { setPriceMap(d); setSample(false); }
        else { setPriceMap(d); setSample(false); }   // convert works; alch shows banner
      }
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { loadPrices(); }, []);

  const natRune = priceOf(priceMap, "nature rune") ?? NAT_FALLBACK;

  const alchRows = useMemo(() => {
    const rows = [];
    for (const key in priceMap) {
      const e = priceMap[key];
      if (!e || e.alch == null || e.alch <= 0) continue;
      const buy = e.high ?? e.low; if (buy == null) continue;
      if (members === "f2p" && e.members) continue;
      const vol = e.vol || 0;
      if (vol < minVol) continue;
      const profit = e.alch - buy - natRune;
      if (profitOnly && profit <= 0) continue;
      const limit = e.limit || 0;
      const maxHr = limit ? Math.min(casts, limit / 4) : casts;   // 4h buy-limit → /hr
      const capped = limit && limit / 4 < casts;
      rows.push({ name: e.name || key, alch: e.alch, buy, profit, vol, limit, maxHr, capped, gpHr: profit * maxHr, xpHr: maxHr * ALCH_XP, members: e.members });
    }
    const ql = q.trim().toLowerCase();
    const filtered = ql ? rows.filter((r) => r.name.toLowerCase().includes(ql)) : rows;
    filtered.sort((a, b) => sort === "gphr" ? b.gpHr - a.gpHr : sort === "xphr" ? b.xpHr - a.xpHr : b.profit - a.profit);
    return filtered;
  }, [priceMap, natRune, members, minVol, profitOnly, casts, sort, q]);

  const convRows = useMemo(() => CONVERSIONS.map((c) => {
    const rate = rates[c.id] ?? c.rate;
    let inCost = 0, inPriced = true, capHr = Infinity, capItem = null;
    for (const i of c.inputs) {
      const p = priceOf(priceMap, i.n, "high"); if (p == null) inPriced = false; else inCost += p * i.q;
      const lim = priceMap[i.n.toLowerCase()]?.limit;
      if (lim) { const perHr = (lim / 4) / i.q; if (perHr < capHr) { capHr = perHr; capItem = i.n; } }
    }
    let outRev = 0, outPriced = true;
    for (const o of c.outputs) {
      const p = priceOf(priceMap, o.n, convInsta ? "low" : "high"); if (p == null) outPriced = false; else outRev += (p - geTax(p)) * o.q;
    }
    const priced = inPriced && outPriced;
    const perAction = priced ? outRev - inCost : null;
    const supplyCapped = capHr < rate;
    const effRate = supplyCapped ? capHr : rate;
    return { ...c, rate, inCost, outRev, perAction, gpHr: priced ? perAction * rate : null, sustGpHr: priced ? perAction * effRate : null, priced, supplyCapped, capItem, capHr };
  }), [priceMap, rates, convInsta]);

  return (
    <div className="tr">
      <style>{CSS}</style>
      <header className="hd">
        <div className="hd-l">{onHome && <button className="back" onClick={onHome} title="All tools"><ArrowLeft size={17} /></button>}<Coins size={18} /><h1>Treasury</h1></div>
        <div className="hd-r">
          <span className={"feed " + (sample ? "warn" : "live")}>{sample ? "Sample" : "Live"}</span>
          <button className="ic" onClick={loadPrices}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>
        </div>
      </header>

      <div className="tabs">
        <button className={tab === "alch" ? "on" : ""} onClick={() => setTab("alch")}><Flame size={14} /> High alch</button>
        <button className={tab === "convert" ? "on" : ""} onClick={() => setTab("convert")}><Hammer size={14} /> Convert</button>
      </div>

      {tab === "alch" && (
        <>
          {!feedHasAlch && !sample && <div className="banner"><AlertTriangle size={13} /> Your live feed doesn't carry alch values yet — redeploy the updated pipeline and run the Action once. Showing what the feed has.</div>}
          <div className="sub">Profit per cast = high-alch value − instant-buy price − nature rune (<b>{fmt(natRune)}</b>). Buy-limit aware.</div>

          <div className="search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter items…" /></div>

          <div className="seg-row">
            <div className="seg sort">{[["cast", "Profit/cast"], ["gphr", "Sustain gp/hr"], ["xphr", "Magic xp/hr"]].map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}</div>
          </div>
          <button className="cfg-toggle" onClick={() => setShowCfg(!showCfg)}>{members === "f2p" ? "F2P only" : "All items"} · {casts}/hr · vol ≥ {fmt(minVol)}{profitOnly ? " · profit only" : ""} <ChevronDown size={13} className={showCfg ? "flip" : ""} /></button>
          {showCfg && (
            <div className="cfg">
              <div className="cfg-row"><span>Members</span><div className="seg">{[["all", "All"], ["f2p", "F2P only"]].map(([k, l]) => <button key={k} className={members === k ? "on" : ""} onClick={() => setMembers(k)}>{l}</button>)}</div></div>
              <label className="num"><span>Casts / hr</span><input type="number" min="1" max="2400" value={casts} onChange={(e) => setCasts(Math.max(1, Math.min(2400, +e.target.value || 1)))} /></label>
              <div className="cfg-row"><span>Min 24h volume</span><div className="seg">{[["0", 0], ["1k", 1000], ["10k", 10000], ["100k", 100000]].map(([l, v]) => <button key={l} className={minVol === v ? "on" : ""} onClick={() => setMinVol(v)}>{l}</button>)}</div></div>
              <label className="chk" onClick={() => setProfitOnly(!profitOnly)}><span className={"box" + (profitOnly ? " on" : "")} />Profitable only</label>
            </div>
          )}

          <div className="count">{alchRows.length} item{alchRows.length !== 1 ? "s" : ""}{sort === "gphr" ? " · by sustainable gp/hr" : sort === "xphr" ? " · by Magic xp/hr" : " · by profit/cast"}</div>
          {alchRows.length === 0 && <div className="empty">Nothing matches. Loosen the volume filter or turn off “profitable only”.</div>}
          {alchRows.slice(0, 80).map((r) => (
            <div key={r.name} className="row">
              <div className="row-l">
                <span className="row-name">{r.name}{r.members && <span className="mem">P2P</span>}</span>
                <span className="row-sub">buy {fmt(r.buy)} · alch {fmt(r.alch)} · nat {fmt(natRune)}</span>
                <div className="chips">
                  <span className="chip">{fmt(r.gpHr)}/hr{r.capped && <em title="Limited by the 4h GE buy limit — you can't buy enough to alch faster.">·cap</em>}</span>
                  <span className="chip">{fmt(r.xpHr)} xp/hr</span>
                  <span className="chip">limit {fmt(r.limit)}/4h</span>
                  <span className="chip dim">vol {fmt(r.vol)}</span>
                </div>
              </div>
              <div className="row-fig"><span className={"fig " + (r.profit >= 0 ? "pos" : "neg")}>{r.profit >= 0 ? "+" : "−"}{fmt(Math.abs(r.profit))}</span><span className="fig-l">gp / cast</span></div>
            </div>
          ))}
          <div className="foot"><Info size={11} /> Cost basis is instant-buy; patient buy offers do better. Sustainable gp/hr is bounded by each item's 4h buy limit — high profit/cast on a 70-limit item still can't be farmed at scale.</div>
        </>
      )}

      {tab === "convert" && (
        <>
          <div className="sub">Deterministic conversions priced live. Costs = instant-buy inputs; revenue = outputs sold {convInsta ? "instantly (insta-sell)" : "at offer (ask price)"}, net GE tax.</div>
          <div className="seg-row"><div className="seg"><button className={convInsta ? "on" : ""} onClick={() => setConvInsta(true)}>Sell insta</button><button className={!convInsta ? "on" : ""} onClick={() => setConvInsta(false)}>Sell at offer</button></div></div>
          <div className="cmp-hint">Rates are editable — set them to your real throughput.</div>

          {[...convRows].sort((a, b) => (b.sustGpHr ?? -1e18) - (a.sustGpHr ?? -1e18)).map((c) => (
            <div key={c.id} className="conv">
              <div className="conv-top">
                <div className="conv-l"><span className="conv-name">{c.name}</span><span className="conv-meta">{c.skill} · {c.reqs}</span></div>
                <div className="row-fig"><span className={"fig " + (c.perAction >= 0 ? "pos" : "neg")}>{c.priced ? (c.gpHr >= 0 ? "+" : "−") + fmt(Math.abs(c.gpHr)) : "—"}</span><span className="fig-l">gp / hr</span></div>
              </div>
              <div className="conv-flow">
                <span className="flow-in">{c.inputs.map((i) => `${i.q}× ${i.n}`).join(" + ")}</span>
                <ArrowUpRight size={13} className="flow-arrow" />
                <span className="flow-out">{c.outputs.map((o) => `${o.q}× ${o.n}`).join(" + ")}</span>
              </div>
              <div className="conv-stats">
                <span>per action <b className={c.perAction >= 0 ? "pos" : "neg"}>{c.priced ? (c.perAction >= 0 ? "+" : "−") + fmt(Math.abs(c.perAction)) : "—"}</b></span>
                <span>cost <b>{fmt(c.inCost)}</b></span>
                <span>sells <b>{fmt(c.outRev)}</b></span>
                <span className="xp">{c.xp}</span>
              </div>
              <div className="conv-rate">
                <label><span>{c.unit}</span><input type="number" min="1" value={c.rate} onChange={(e) => setRates((s) => ({ ...s, [c.id]: Math.max(1, +e.target.value || 1) }))} /></label>
                {c.supplyCapped && <span className="cap"><AlertTriangle size={11} /> {c.capItem} buy-limit caps you to ~{fmt(c.capHr)}/hr → sustainable {fmt(c.sustGpHr)}/hr</span>}
              </div>
            </div>
          ))}
          <div className="foot"><Info size={11} /> A starter set of evergreen conversions. The price math is live; throughput is yours to tune. More methods (and the RNG/gathering engine) can be layered on next.</div>
        </>
      )}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
.tr{--bg:#0b0a07;--p1:#16130c;--p2:#1d1910;--p3:#241f13;--ln:rgba(255,255,255,.07);--ln2:rgba(255,255,255,.13);--tx:#f1ece0;--mu:#a59c86;--fa:#766e5a;--gold:#f5c542;--gold2:#ffd966;--pos:#6fe09a;--neg:#f0844e;
  font-family:'Sora',system-ui,sans-serif;color:var(--tx);background:var(--bg);min-height:100dvh;padding:0 calc(13px + env(safe-area-inset-right,0px)) calc(46px + env(safe-area-inset-bottom,0px)) calc(13px + env(safe-area-inset-left,0px));max-width:720px;margin:0 auto}
.tr *{box-sizing:border-box}
.spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.flip{transform:rotate(180deg)}
.hd{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:calc(14px + env(safe-area-inset-top,0px)) 2px 11px;background:linear-gradient(180deg,var(--bg) 88%,transparent);backdrop-filter:blur(6px)}
.hd-l{display:flex;align-items:center;gap:8px;min-width:0}.hd-l>svg{color:var(--gold);flex-shrink:0}
.hd-l h1{font-family:'Cinzel',serif;font-weight:700;font-size:21px;margin:0;color:var(--tx);white-space:nowrap}
.hd-r{display:flex;align-items:center;gap:8px;flex-shrink:0}
.feed{font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:20px;border:1px solid var(--ln);white-space:nowrap}
.feed.live{color:var(--gold);border-color:rgba(245,197,66,.3);background:rgba(245,197,66,.08)}
.feed.warn{color:var(--gold);border-color:rgba(245,197,66,.3);background:rgba(245,197,66,.08)}
.ic,.back{border-radius:9px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.ic{width:31px;height:31px}.back{width:33px;height:33px}.back:hover,.ic:hover{color:var(--gold2);border-color:var(--gold)}
.tabs{display:flex;gap:7px;margin:10px 0 12px}
.tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:10px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:13.5px;font-weight:600;cursor:pointer;transition:.14s}
.tabs button.on{color:var(--gold2);border-color:var(--gold);background:rgba(245,197,66,.08)}
.banner{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.5;color:var(--gold2);background:rgba(245,197,66,.08);border:1px solid rgba(245,197,66,.25);border-radius:11px;padding:11px 13px;margin-bottom:10px}
.banner svg{flex-shrink:0;margin-top:1px}
.sub{font-size:12.5px;line-height:1.5;color:var(--mu);margin-bottom:11px;padding:0 2px}.sub b{color:var(--gold2);font-family:'JetBrains Mono',monospace}
.search{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:11px;border:1px solid var(--ln);background:var(--p1);margin-bottom:10px}
.search svg{color:var(--fa);flex-shrink:0}
.search input{flex:1;padding:10px 0;border:none;background:none;color:var(--tx);font-size:14px;outline:none;font-family:'Sora'}
.search input::placeholder{color:var(--fa)}
.seg-row{margin-bottom:10px}
.seg{display:flex;background:var(--p1);border:1px solid var(--ln);border-radius:10px;padding:3px}
.seg.sort{width:100%}.seg.sort button{flex:1}
.seg button{padding:8px 12px;border-radius:7px;border:none;background:none;color:var(--mu);font-family:'Sora';font-size:12.5px;font-weight:600;cursor:pointer;transition:.12s;white-space:nowrap}
.seg button.on{background:var(--p3);color:var(--gold2)}
.cfg-toggle{width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:10px 13px;border-radius:11px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:12.5px;cursor:pointer;margin-bottom:11px}
.cfg-toggle svg{margin-left:auto;transition:.18s}
.cfg{background:var(--p1);border:1px solid var(--ln);border-radius:13px;padding:14px;margin-bottom:12px;display:flex;flex-direction:column;gap:13px}
.cfg-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.cfg-row>span{font-size:12.5px;color:var(--mu);font-weight:500}
.num{display:flex;align-items:center;justify-content:space-between;gap:10px}
.num span{font-size:12.5px;color:var(--mu);font-weight:500}
.num input{width:90px;padding:8px 10px;border-radius:9px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:14px;text-align:center;outline:none}
.num input:focus{border-color:var(--gold)}
.chk{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--tx);cursor:pointer}
.box{width:18px;height:18px;border-radius:6px;border:1.5px solid var(--fa);flex-shrink:0;position:relative;transition:.13s}
.box.on{background:var(--gold);border-color:var(--gold)}.box.on::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:9px;border:solid #1a1407;border-width:0 2px 2px 0;transform:rotate(45deg)}
.count{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--fa);font-weight:600;margin:2px 2px 9px}
.cmp-hint{font-size:11.5px;color:var(--fa);margin:-2px 2px 10px;line-height:1.4}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border-radius:13px;border:1px solid var(--ln);background:var(--p1);margin-bottom:8px}
.row-l{min-width:0;flex:1}
.row-name{display:flex;align-items:center;gap:7px;font-size:15px;font-weight:600;color:var(--tx)}
.mem{font-size:9px;font-weight:700;color:var(--gold);border:1px solid rgba(245,197,66,.3);border-radius:4px;padding:1px 4px}
.row-sub{display:block;font-size:11.5px;color:var(--mu);margin-top:3px;font-family:'JetBrains Mono',monospace}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.chip{font-size:10.5px;font-family:'JetBrains Mono',monospace;color:var(--mu);background:var(--p3);border:1px solid var(--ln);border-radius:6px;padding:2px 7px}
.chip.dim{color:var(--fa)}.chip em{font-style:normal;color:var(--gold);cursor:help}
.row-fig{text-align:right;flex-shrink:0;white-space:nowrap}
.fig{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;line-height:1}
.fig.pos{color:var(--gold)}.fig.neg{color:var(--neg)}
.fig-l{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--fa);margin-top:3px}
.conv{background:var(--p1);border:1px solid var(--ln);border-radius:14px;padding:14px;margin-bottom:10px}
.conv-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.conv-name{font-family:'Cinzel',serif;font-size:17px;font-weight:700;color:var(--tx)}
.conv-meta{display:block;font-size:11.5px;color:var(--mu);margin-top:3px}
.conv-flow{display:flex;align-items:center;gap:9px;margin-top:11px;font-size:12px;flex-wrap:wrap}
.flow-in{color:var(--neg)}.flow-out{color:var(--gold2)}.flow-arrow{color:var(--fa);flex-shrink:0}
.conv-stats{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:11px;padding-top:11px;border-top:1px solid var(--ln);font-size:11.5px;color:var(--mu)}
.conv-stats b{font-family:'JetBrains Mono',monospace;color:var(--tx);font-weight:700}
.conv-stats b.pos{color:var(--gold)}.conv-stats b.neg{color:var(--neg)}
.conv-stats .xp{color:var(--fa);width:100%}
.conv-rate{display:flex;align-items:center;gap:12px;margin-top:11px;flex-wrap:wrap}
.conv-rate label{display:flex;align-items:center;gap:8px}
.conv-rate label span{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--fa);font-weight:600}
.conv-rate input{width:88px;padding:7px 9px;border-radius:8px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:13.5px;text-align:center;outline:none}
.conv-rate input:focus{border-color:var(--gold)}
.cap{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--neg);line-height:1.4}.cap svg{flex-shrink:0}
.foot{display:flex;align-items:flex-start;gap:7px;font-size:11px;line-height:1.5;color:var(--fa);margin-top:14px}.foot svg{flex-shrink:0;margin-top:1px}
.empty{text-align:center;padding:30px 18px;color:var(--fa);font-size:14px}
@media(max-width:430px){.hd-l h1{font-size:18px}.fig{font-size:18px}.conv-name{font-size:16px}}
`;
