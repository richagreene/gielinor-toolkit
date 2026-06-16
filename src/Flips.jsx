import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { Coins, ArrowUpDown, SlidersHorizontal, ChevronDown, ArrowLeft, AlertTriangle, RefreshCw, Layers, Droplet, Info } from "lucide-react";

/* ============================================================
   Live feed produced by the GitHub Action (pipeline/build_flips.mjs).
   Falls back to SAMPLE_FEED if the feed can't be reached.
   ============================================================ */
const OWNER_REPO = "richagreene/gielinor-toolkit";
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

/* ---------- plain-language explanations for every metric ---------- */
const METRICS = {
  gphr: ["Profit per hour", "Roughly how much gp this flip makes per hour if you keep buying and reselling — margin per item × how many fill × how fast it turns over. This is the number the list is ranked by, so it's the headline."],
  order: ["Buy → Sell price", "Set your buy offer at the first price and your sell offer at the second. These sit just inside the item's real bid and ask so both sides actually fill — not the mirage prices a basic high-minus-low screener shows."],
  fill: ["Fill chance", "How likely both your buy and your sell go through at these prices, based on how often the item trades. High means orders should clear quickly; low means you may wait or have to chase the price."],
  liq: ["Liquidity", "How heavily this item trades. High = lots of buyers and sellers, so you can move large quantities fast. Low = thin, so orders can sit a while and big sizes won't fill."],
  margin: ["Margin per item", "Your profit on each item after the 2% GE sell tax, shown as a % of the buy price and as gp each. This is the raw edge per unit, before you multiply by quantity."],
  qty: ["How many to buy", "The suggested quantity to flip. It's capped by the GE 4-hour buy limit, the item's trade volume (so you don't flood the market), and your capital. Buying more than this won't reliably fill."],
  kelly: ["Suggested stake", "How much of your bankroll to put into this single flip, using a conservative half-Kelly rule so you don't over-commit to one item. Enter your bankroll above to see it."],
  fair: ["Fair buy / sell", "The engine's estimate of the item's true buy and sell price right now, built from recent trades and made resistant to one-off spikes. Your offers are placed just inside these."],
  spread: ["Realizable spread", "The part of the buy/sell gap you can actually capture — the real margin before tax. Roll is a second way of estimating the spread, shown only as a cross-check."],
  tax: ["GE tax per item", "The 2% Grand Exchange tax taken on the sell side (capped at 5m per item). It's already subtracted from your margin and gp/hour."],
  legs: ["Buy / sell fill legs", "The chance each side completes on its own at the suggested price within the time window — first the buy, then the sell. Both have to fill for the flip to work."],
  stab: ["Spread stability", "How steady the buy/sell gap has been recently. High means the edge is dependable; low means it flickers and the margin may not hold by the time you sell."],
  cap: ["What caps your size", "The thing limiting your suggested quantity — either the GE 4-hour buy limit, or your share of the item's trade volume."],
  imb: ["Order-flow imbalance", "Whether recent trading leans toward buyers or sellers. Positive means more buying pressure (price may drift up); negative means more selling (price may dip)."],
  sharpe: ["Risk-adjusted return", "Profit measured against how much it bounces around — reward per unit of risk. Higher means steadier, more reliable returns for the gp you tie up."],
  conf: ["Confidence", "Overall trust in this flip, combining data freshness, liquidity and spread stability. Higher means a more reliable signal; low means treat it with caution."],
  stale: ["Last trade", "How long ago the item actually traded. Fresh data (a few minutes) is reliable; a long gap means the prices may be out of date."],
};

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

/* ---------- info triggers (tap + hover) ---------- */
function Idot({ k, onInfo, sm, stop }) {
  return (
    <button type="button" className={"idot" + (sm ? " sm" : "")} aria-label="What's this?"
      onClick={(e) => { if (stop) e.stopPropagation(); onInfo(k, e.currentTarget, "toggle"); }}
      onPointerEnter={(e) => onInfo(k, e.currentTarget, "hover")}
      onPointerLeave={() => onInfo(null, null, "leave")}>
      <Info />
    </button>
  );
}
function Chip({ k, onInfo, cls, children }) {
  return (
    <button type="button" className={"chip idotchip " + (cls || "")}
      onClick={(e) => { e.stopPropagation(); onInfo(k, e.currentTarget, "toggle"); }}
      onPointerEnter={(e) => onInfo(k, e.currentTarget, "hover")}
      onPointerLeave={() => onInfo(null, null, "leave")}>
      {children}<Info size={10} className="chip-i" />
    </button>
  );
}
function WL({ k, onInfo, children }) {
  return (
    <button type="button" className="idotlbl"
      onClick={(e) => { e.stopPropagation(); onInfo(k, e.currentTarget, "toggle"); }}
      onPointerEnter={(e) => onInfo(k, e.currentTarget, "hover")}
      onPointerLeave={() => onInfo(null, null, "leave")}>
      {children}<Info className="wl-i" />
    </button>
  );
}

/* ---------- the viewport-clamped popover ---------- */
function InfoPopover({ info, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!info || !ref.current) return;
    const el = ref.current, r = info.rect;
    const vw = window.innerWidth, vh = window.innerHeight, pad = 10;
    const pw = el.offsetWidth, ph = el.offsetHeight;
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(pad, Math.min(left, vw - pw - pad));
    let place = "below", top = r.bottom + 9;
    if (top + ph > vh - pad) {
      const above = r.top - ph - 9;
      if (above >= pad) { top = above; place = "above"; }
      else { top = Math.max(pad, Math.min(r.bottom + 9, vh - ph - pad)); }
    }
    const arrow = Math.max(16, Math.min(r.left + r.width / 2 - left, pw - 16));
    setPos({ top, left, arrow, place });
  }, [info]);

  useEffect(() => {
    if (!info) return;
    const close = () => onClose();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const onDown = (e) => { const t = e.target; if (t && t.closest && (t.closest(".ipop") || t.closest(".idot,.idotchip,.idotlbl"))) return; onClose(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [info, onClose]);

  if (!info) return null;
  const m = METRICS[info.key] || ["", ""];
  return (
    <div ref={ref} className={"ipop " + (pos ? "show " + pos.place : "")} style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: 0 }}>
      <span className="ipop-arr" style={{ left: pos ? pos.arrow : 20 }} />
      <div className="ipop-t">{m[0]}</div>
      <div className="ipop-b">{m[1]}</div>
    </div>
  );
}

/* ---------- a single flip ---------- */
function FlipRow({ r, capital, onInfo }) {
  const [open, setOpen] = useState(false);
  const w = r.why || {};
  const q = capital ? r.affQty : r.qty;
  const toggle = () => setOpen((o) => !o);
  return (
    <div className={"row" + (r.manip ? " flagged" : "")}>
      <div className="row-head" role="button" tabIndex={0} onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
        <div className="row-id">
          <ItemIcon id={r.id} name={r.name} />
          <div className="row-name">
            <span className="nm">{r.name}{!r.members && <span className="f2p">F2P</span>}{r.manip && <span className="flag"><AlertTriangle size={10} /> thin</span>}</span>
            <div className="order">
              <span className="ord-cap">Buy</span><b>{gp(r.buy)}</b>
              <span className="arr">→</span>
              <span className="ord-cap">Sell</span><b>{gp(r.sell)}</b>
              <Idot k="order" onInfo={onInfo} sm stop />
            </div>
          </div>
        </div>
        <div className="row-fig">
          <span className="ev mono">{gp(r.evPerHr)}</span>
          <span className="ev-l">gp / hr <Idot k="gphr" onInfo={onInfo} sm stop /></span>
        </div>
      </div>

      <div className="chips">
        <Chip k="qty" onInfo={onInfo} cls="qty act">buy ×{q.toLocaleString()}</Chip>
        <Chip k="fill" onInfo={onInfo} cls={fillTone(r.pFill)}>{Math.round(r.pFill * 100)}% fill</Chip>
        <Chip k="liq" onInfo={onInfo} cls={"liq-" + r.liqTier.toLowerCase()}><Droplet size={10} /> {r.liqTier}</Chip>
        <Chip k="margin" onInfo={onInfo} cls="net">{pctf(r.netMarginPct)} · {gp(r.netMargin)}/ea</Chip>
        {r.kellyGp != null && <Chip k="kelly" onInfo={onInfo} cls="kelly">stake ~{gp(r.kellyGp)}</Chip>}
        <button type="button" className="why-btn" onClick={toggle}>Details <ChevronDown size={12} className={open ? "flip" : ""} /></button>
      </div>

      {open && (
        <div className="why">
          <div className="why-grid">
            <div><WL k="fair" onInfo={onInfo}>Fair buy / sell</WL><span className="wv mono">{gp(w.fairLow)} / {gp(w.fairHigh)}</span></div>
            <div><WL k="order" onInfo={onInfo}>Your orders</WL><span className="wv mono">{gp(r.buy)} / {gp(r.sell)}</span></div>
            <div><WL k="spread" onInfo={onInfo}>Realizable spread</WL><span className="wv mono">{gp(w.realizableSpread)}{w.rollSpread != null ? `  (Roll ${gp(w.rollSpread)})` : ""}</span></div>
            <div><WL k="tax" onInfo={onInfo}>GE tax / unit</WL><span className="wv mono">−{gp(w.taxPerItem)}</span></div>
            <div><WL k="legs" onInfo={onInfo}>Buy / sell fills</WL><span className="wv mono">{Math.round(r.pBuy * 100)}% / {Math.round(r.pSell * 100)}%</span></div>
            <div><WL k="stab" onInfo={onInfo}>Spread stability</WL><span className="wv mono">{Math.round((w.spreadStability ?? 0) * 100)}%</span></div>
            <div><WL k="cap" onInfo={onInfo}>Size capped by</WL><span className="wv">{w.capacityFrom}{r.buyLimit ? ` · 4h limit ${r.buyLimit.toLocaleString()}` : ""}</span></div>
            <div><WL k="liq" onInfo={onInfo}>Liquidity (2-sided)</WL><span className="wv mono">{r.liqPerHr.toLocaleString()}/hr</span></div>
            <div><WL k="imb" onInfo={onInfo}>Order-flow imbalance</WL><span className="wv mono">{r.imbalance > 0 ? "+" : ""}{(r.imbalance * 100).toFixed(0)}% {r.imbalance > 0.1 ? "(demand)" : r.imbalance < -0.1 ? "(supply)" : ""}</span></div>
            <div><WL k="sharpe" onInfo={onInfo}>Risk-adj (Sharpe)</WL><span className="wv mono">{r.sharpe.toFixed(2)}</span></div>
            <div><WL k="conf" onInfo={onInfo}>Confidence</WL><span className="wv mono">{Math.round(r.confidence * 100)}%</span></div>
            <div><WL k="stale" onInfo={onInfo}>Last trade</WL><span className="wv mono">{r.staleMin}m ago</span></div>
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
  const [members, setMembers] = useState("all");
  const [minFill, setMinFill] = useState(0);
  const [maxBuy, setMaxBuy] = useState("");
  const [minBuy, setMinBuy] = useState("");
  const [minLiq, setMinLiq] = useState("");
  const [excludeManip, setExcludeManip] = useState(true);
  const [sortOpen, setSortOpen] = useState(false);
  const [info, setInfo] = useState(null);

  const canHover = useRef(false);
  useEffect(() => { canHover.current = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches; }, []);

  const openInfo = useCallback((key, el, mode) => {
    if (mode === "hover") { if (!canHover.current || !el) return; setInfo((c) => (c && c.locked) ? c : { key, rect: el.getBoundingClientRect(), locked: false }); return; }
    if (mode === "leave") { if (!canHover.current) return; setInfo((c) => (c && !c.locked) ? null : c); return; }
    if (!el) return;
    setInfo((c) => (c && c.key === key && c.locked) ? null : { key, rect: el.getBoundingClientRect(), locked: true });
  }, []);

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
      {info && <InfoPopover key={info.key + ":" + Math.round(info.rect.top) + ":" + Math.round(info.rect.left)} info={info} onClose={() => setInfo(null)} />}

      <header className="hd">
        <div className="hd-l">{onHome && <button className="fl-back" onClick={onHome} title="All tools"><ArrowLeft size={18} /></button>}<Coins size={20} /><h1>Flips</h1></div>
        <div className="hd-r">
          <span className={"feed " + (feed.sample ? "warn" : "live")}>{feed.sample ? "Sample data" : "Live"} · {ago(feed.generatedAt)}</span>
          <button className="ic-btn" onClick={refresh}><RefreshCw size={15} className={loading ? "spin" : ""} /></button>
        </div>
      </header>
      {feed.sample && <div className="banner">Showing sample data — the live feed couldn't be reached. It'll switch over automatically once <code>{OWNER_REPO}</code>'s data branch is reachable.</div>}

      <div className="howto">
        <span className="howto-h">How to read a row</span>
        The big gold <b>gp / hr</b> is how the list is ranked. The gold <b>buy ×N</b> and the <b>Buy → Sell</b> prices are what you actually enter on the GE. The other chips are confidence checks. Tap any number for what it means.
      </div>

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
        {rows.slice(0, 80).map((r) => <FlipRow key={r.id} r={r} capital={capital} onInfo={openInfo} />)}
        {rows.length > 80 && <div className="more">Showing the top 80 of {rows.length} — tighten the filters to narrow it down.</div>}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
.flips{--bg:#0a0c10;--p1:#12151c;--p2:#171b24;--p3:#1d222c;--ln:rgba(255,255,255,.07);--ln2:rgba(255,255,255,.13);--tx:#eaeef5;--mu:#9aa3b3;--fa:#727c8d;--gold:#f5b62b;--gold2:#ffcf5e;--up:#46d07f;--warn:#f3a82f;--down:#f0664e;
  font-family:'Sora',system-ui,sans-serif;color:var(--tx);background:var(--bg);min-height:100dvh;padding:0 14px 60px;max-width:760px;margin:0 auto}
.flips *{box-sizing:border-box}
.mono{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
.spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.flip{transform:rotate(180deg)}

.hd{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:16px 2px 13px;background:linear-gradient(180deg,var(--bg) 78%,transparent);backdrop-filter:blur(6px)}
.hd-l{display:flex;align-items:center;gap:9px}.hd-l>svg{color:var(--gold)}
.hd-l h1{font-family:'Cinzel',serif;font-weight:700;font-size:23px;margin:0;letter-spacing:.01em;color:var(--tx)}
.hd-r{display:flex;align-items:center;gap:9px}
.feed{font-size:11.5px;font-weight:500;padding:3px 9px;border-radius:20px;border:1px solid var(--ln)}
.feed.live{color:var(--up);border-color:rgba(70,208,127,.3);background:rgba(70,208,127,.08)}
.feed.warn{color:var(--warn);border-color:rgba(243,168,47,.3);background:rgba(243,168,47,.08)}
.ic-btn{width:32px;height:32px;border-radius:9px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);display:grid;place-items:center;cursor:pointer}
.ic-btn:hover{color:var(--tx);border-color:var(--ln2)}
.fl-back{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;cursor:pointer;background:var(--p1);border:1px solid var(--ln);color:var(--mu);transition:.16s;margin-right:6px;flex-shrink:0}
.fl-back:hover{color:var(--gold2);border-color:var(--gold)}
.more{text-align:center;font-size:12.5px;color:var(--fa);padding:16px 0 4px}
.banner{font-size:12.5px;color:var(--warn);background:rgba(243,168,47,.07);border:1px solid rgba(243,168,47,.2);border-radius:9px;padding:9px 12px;margin-bottom:12px;line-height:1.5}
.banner code{font-family:'JetBrains Mono',monospace;font-size:11.5px;background:rgba(255,255,255,.07);padding:1px 5px;border-radius:4px}

.howto{font-size:12.5px;line-height:1.55;color:var(--mu);background:linear-gradient(180deg,rgba(245,182,43,.05),rgba(245,182,43,.02));border:1px solid rgba(245,182,43,.16);border-radius:11px;padding:11px 13px;margin-bottom:13px}
.howto-h{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold2);margin-bottom:5px}
.howto b{color:var(--tx);font-weight:600}

.cap-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.cap{position:relative;display:flex;flex-direction:column;gap:5px}
.cap>span{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mu)}
.cap input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--ln);background:var(--p1);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:15px;outline:none}
.cap input::placeholder{color:var(--fa)}
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
.filters input[inputmode=numeric]{width:100%;padding:9px 11px;border-radius:9px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:14px;outline:none}
.filters input[inputmode=numeric]:focus{border-color:var(--gold)}
.filters input::placeholder{color:var(--fa)}
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
.row-head{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;padding:13px 14px 11px;cursor:pointer;color:var(--tx);outline:none}
.row-head:focus-visible{box-shadow:inset 0 0 0 2px var(--gold)}
.row-id{display:flex;align-items:center;gap:11px;min-width:0}
.ico{object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.ico-g{display:grid;place-items:center;border-radius:7px;background:var(--p3);border:1px solid var(--ln);font-family:'Cinzel',serif;font-weight:700;color:var(--mu);font-size:15px}
.row-name{display:flex;flex-direction:column;gap:4px;min-width:0}
.nm{display:flex;align-items:center;gap:7px;font-size:15.5px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.f2p{font-size:9px;font-weight:700;letter-spacing:.05em;color:#8fb3ff;border:1px solid rgba(143,179,255,.35);border-radius:4px;padding:1px 4px}
.flag{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:600;color:var(--down);border:1px solid rgba(240,102,78,.4);border-radius:4px;padding:1px 4px}
.order{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ord-cap{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fa)}
.order b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:14.5px;font-weight:600;color:var(--tx)}
.order .arr{color:var(--fa);margin:0 2px}
.row-fig{text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.ev{display:block;font-size:19px;font-weight:700;color:var(--gold2);line-height:1}
.ev-l{display:inline-flex;align-items:center;gap:4px;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--fa)}

.chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 14px 13px}
.chip{font-size:11.5px;font-weight:500;padding:4px 9px;border-radius:7px;background:var(--p3);color:var(--mu);display:inline-flex;align-items:center;gap:4px;border:none;outline:none;cursor:pointer;font-family:'Sora';transition:.13s}
.chip:hover{filter:brightness(1.18)}
.chip .chip-i{opacity:.38;flex-shrink:0}
.chip.up{color:var(--up);background:rgba(70,208,127,.12)}.chip.warn{color:var(--warn);background:rgba(243,168,47,.12)}.chip.down{color:var(--down);background:rgba(240,102,78,.12)}
.chip.liq-high{color:#5ad0c4;background:rgba(90,208,196,.12)}.chip.liq-medium{color:#aeb8c8}.chip.liq-low{color:var(--fa)}
.chip.net{color:var(--tx)}
.chip.qty{font-family:'JetBrains Mono',monospace}
.chip.qty.act{color:var(--gold2);background:rgba(245,182,43,.14);font-weight:600}
.chip.kelly{color:var(--gold2);background:rgba(245,182,43,.12)}
.why-btn{margin-left:auto;display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:var(--mu);font-family:'Sora';font-size:12px;font-weight:600;cursor:pointer}
.why-btn:hover{color:var(--tx)}.why-btn svg{transition:.18s}

.why{border-top:1px solid var(--ln);padding:13px 14px;background:rgba(0,0,0,.18)}
.why-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 16px}
.why-grid>div{display:flex;flex-direction:column;gap:3px}
.wv{font-size:13.5px;color:var(--tx)}
.idotlbl{display:inline-flex;align-items:center;gap:4px;background:none;border:none;padding:0;margin:0;cursor:pointer;color:var(--fa);font-family:'Sora';font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;text-align:left;transition:.13s}
.idotlbl:hover{color:var(--gold2)}
.idotlbl .wl-i{width:10px;height:10px;opacity:.5;flex-shrink:0}
.why-warn{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding:9px 11px;border-radius:8px;background:rgba(240,102,78,.08);border:1px solid rgba(240,102,78,.2);font-size:12.5px;color:#f0a094;line-height:1.45}
.why-warn svg{color:var(--down);flex-shrink:0;margin-top:1px}

.idot{display:inline-grid;place-items:center;width:16px;height:16px;padding:0;border:none;border-radius:50%;background:rgba(255,255,255,.07);color:var(--fa);cursor:pointer;vertical-align:middle;transition:.13s;flex-shrink:0}
.idot:hover{background:rgba(245,182,43,.16);color:var(--gold2)}
.idot.sm{width:15px;height:15px}
.idot svg{width:11px;height:11px}

.ipop{position:fixed;z-index:1000;width:max-content;max-width:min(290px,calc(100vw - 20px));background:#1b2029;border:1px solid var(--ln2);border-radius:12px;padding:11px 13px;box-shadow:0 14px 40px rgba(0,0,0,.62);opacity:0;transform:translateY(3px);transition:opacity .12s ease,transform .12s ease;pointer-events:none}
.ipop.show{opacity:1;transform:none}
.ipop-t{font-family:'Sora';font-size:12.5px;font-weight:700;color:var(--gold2);margin-bottom:5px}
.ipop-b{font-family:'Sora';font-size:12.5px;line-height:1.5;color:var(--tx)}
.ipop-arr{position:absolute;width:9px;height:9px;background:#1b2029;border:1px solid var(--ln2);transform:rotate(45deg)}
.ipop.below .ipop-arr{top:-5px;border-right:none;border-bottom:none}
.ipop.above .ipop-arr{bottom:-5px;border-left:none;border-top:none}

.empty{text-align:center;padding:46px 20px;color:var(--fa)}.empty svg{opacity:.5;margin-bottom:10px}.empty p{font-size:14px;margin:0}

@media(max-width:480px){.why-grid{grid-template-columns:1fr 1fr}.ev{font-size:17px}.cap-row{gap:8px}}
`;
