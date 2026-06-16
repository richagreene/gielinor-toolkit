import React, { useState, useEffect, useMemo, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Search, Star, TrendingUp, TrendingDown, RefreshCw, Crown, Globe, X, Activity,
  ArrowUpRight, ArrowDownRight, Flame, Boxes, SlidersHorizontal, Coins, LayoutGrid,
  LineChart, Wallet, Wrench, Bell, Timer, Calculator, Plus, Trash2, Sparkles,
  AlertTriangle, Minus, Clock, Target, ArrowLeft, Swords, GraduationCap, Skull,
  Compass, Package, ChevronRight, Gauge, Map, Sprout
} from "lucide-react";
import Lodestar from "./Lodestar.jsx";
import Flips from "./Flips.jsx";
import Harvest from "./Harvest.jsx";

/* =============================== helpers =============================== */

function fmtGp(n) {
  if (n == null || isNaN(n)) return "—";
  const s = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return s + (a / 1e9).toFixed(a >= 1e10 ? 2 : 3).replace(/\.?0+$/, "") + "b";
  if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "m";
  if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return s + Math.round(a).toLocaleString();
}
const fmtFull = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString() + " gp");
const num = (v) => { const n = parseFloat(String(v).replace(/[, ]/g, "")); return isNaN(n) ? 0 : n; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtNum = (raw) => { const d = String(raw ?? "").replace(/[^0-9]/g, ""); return d ? Number(d).toLocaleString() : ""; };

function geTax(sell, exempt) {
  if (exempt || sell < 50) return 0;
  return Math.min(Math.floor(sell * 0.02), 5_000_000);
}
function hms(ms) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildSeries(id, low, high) {
  const r = mulberry((id * 2654435761) >>> 0);
  const n = 48, band = (high - low) || Math.max(1, high * 0.02);
  let v = ((low + high) / 2) * (0.97 + r() * 0.06);
  const out = [];
  for (let i = 0; i < n; i++) {
    v = Math.max(low * 0.92, Math.min(high * 1.06, v + (r() - 0.48) * band * 0.22));
    const sp = band * (0.08 + r() * 0.09);
    out.push({ t: i, low: Math.round(v - sp), high: Math.round(v + sp) });
  }
  return out;
}
function buildLongSeries(id, low, high) {
  const r = mulberry(((id * 40503 + 11) >>> 0));
  const n = 52, mid = (low + high) / 2;
  let v = mid * (0.62 + r() * 0.18);
  const drift = mid * (0.003 + r() * 0.006);
  const out = [];
  for (let i = 0; i < n; i++) {
    v = Math.max(mid * 0.4, v + drift + (r() - 0.5) * mid * 0.035);
    out.push({ t: i, v: Math.round(v) });
  }
  return out;
}
function computeSignals(series, vol) {
  if (!series || series.length < 8) return { dir: "neutral", score: 0, momentum: 0, dev: 0, vola: 0, reasons: [] };
  const mids = series.map((p) => (p.high + p.low) / 2);
  const n = mids.length;
  const recent = mids.slice(-6).reduce((a, b) => a + b, 0) / 6;
  const olderArr = mids.slice(-24, -6);
  const prior = olderArr.reduce((a, b) => a + b, 0) / Math.max(1, olderArr.length);
  const momentum = prior ? ((recent - prior) / prior) * 100 : 0;
  const avg = mids.reduce((a, b) => a + b, 0) / n;
  const cur = mids[n - 1];
  const dev = avg ? ((cur - avg) / avg) * 100 : 0;
  const variance = mids.reduce((a, b) => a + (b - avg) ** 2, 0) / n;
  const vola = avg ? (Math.sqrt(variance) / avg) * 100 : 0;
  let score = momentum + (-dev) * 0.3;
  let dir = "neutral";
  if (score > 1.2) dir = "up"; else if (score < -1.2) dir = "down";
  const reasons = [];
  if (momentum > 1) reasons.push({ t: "up", s: `The price has been climbing lately (up ${momentum.toFixed(1)}%).` });
  else if (momentum < -1) reasons.push({ t: "down", s: `The price has been sliding lately (down ${Math.abs(momentum).toFixed(1)}%).` });
  else reasons.push({ t: "flat", s: `The price is mostly flat right now (${momentum.toFixed(1)}%) — no real direction.` });
  if (dev < -3) reasons.push({ t: "up", s: `It's currently ${Math.abs(dev).toFixed(0)}% cheaper than its usual daily price, so it may bounce back up.` });
  else if (dev > 3) reasons.push({ t: "down", s: `It's currently ${dev.toFixed(0)}% pricier than usual, so it could dip back down.` });
  if (vola > 4) reasons.push({ t: "warn", s: `The price swings around a lot — higher risk, less predictable.` });
  else reasons.push({ t: "flat", s: `The price is steady and predictable.` });
  if (vol != null) {
    if (vol >= 100000) reasons.push({ t: "up", s: "Tons of these trade every day, so you can buy and sell fast." });
    else if (vol > 0 && vol < 500) reasons.push({ t: "warn", s: "Very few trade daily, so orders may sit and this read is less reliable." });
  }
  return { dir, score, momentum, dev, vola, reasons };
}

/* plain-English suggested action from the signals */
function recommend(sig) {
  const { dir, dev } = sig;
  if (dir === "up" && dev < -2) return { label: "Buy", tone: "buy", why: "Climbing and still priced below its daily average — a good spot to get in before it fully recovers." };
  if (dir === "up") return { label: "Buy", tone: "buy", why: "Trending upward — momentum is on your side for a buy." };
  if (dir === "down" && dev > 1) return { label: "Sell", tone: "sell", why: "Pricier than usual and starting to drop — a good time to take profit, not to buy." };
  if (dir === "down") return { label: "Don't buy", tone: "avoid", why: "Heading down right now — wait for it to settle before buying in." };
  if (dev < -3) return { label: "Buy", tone: "buy", why: "Flat, but cheaper than its usual price — a possible bargain if volume holds up." };
  if (dev > 3) return { label: "Hold off", tone: "hold", why: "Pricier than usual and going nowhere — wait for a better entry." };
  return { label: "Hold off", tone: "hold", why: "No clear edge right now — it's just drifting sideways. Wait for a clearer move." };
}

/* freshness (how long ago a side last traded) */
function ageStr(sec) {
  if (sec == null || sec < 0) return "—";
  if (sec < 60) return Math.max(1, Math.round(sec)) + "s";
  if (sec < 3600) return Math.round(sec / 60) + "m";
  if (sec < 86400) return Math.round(sec / 3600) + "h";
  return Math.round(sec / 86400) + "d";
}
function freshTier(sec) {
  if (sec == null) return "stale";
  if (sec < 300) return "fresh";
  if (sec < 1800) return "ok";
  return "stale";
}

/* fill in buy/sell volume split + last-trade times. Uses live fields when present, else synthesizes plausible values from volume (so the engine is demonstrable on sample data). */
function decorate(it) {
  const r = mulberry((((it.id || 1) * 2246822519) >>> 0));
  const total = it.vol != null ? it.vol : 0;
  let buyVol = it.buyVol, sellVol = it.sellVol;
  if (buyVol == null || sellVol == null) {
    const skew = 0.34 + r() * 0.32;
    buyVol = Math.round(total * skew);
    sellVol = Math.round(total * (1 - skew));
  }
  const pressure = (buyVol + sellVol) > 0 ? buyVol / (buyVol + sellVol) : 0.5;
  const nowSec = Math.floor(Date.now() / 1000);
  const ageBase = total > 0 ? Math.max(4, 80000 / Math.sqrt(total + 1)) : 6500;
  const lowTime = it.lowTime != null ? it.lowTime : nowSec - Math.round(ageBase * (0.45 + r() * 1.6));
  const highTime = it.highTime != null ? it.highTime : nowSec - Math.round(ageBase * (0.45 + r() * 1.6));
  return { buyVol, sellVol, pressure, lowTime, highTime };
}

/* where the current price sits inside its recent range */
function rangeFromSeries(s, low, high) {
  const mids = (s && s.length ? s : [{ high, low }]).map((p) => (p.high + p.low) / 2);
  const mn = Math.min(...mids), mx = Math.max(...mids), cur = (low + high) / 2;
  const pct = mx > mn ? Math.max(0, Math.min(100, ((cur - mn) / (mx - mn)) * 100)) : 50;
  return { min: mn, max: mx, pct, cur };
}
function rangeOf(id, low, high) { return rangeFromSeries(buildSeries(id, low, high), low, high); }
function pressureRead(p) {
  const b = Math.round(p * 100);
  if (b >= 57) return { b, label: "Buy pressure", tone: "up", text: "More buyers than sellers — upward pressure, and it may be harder to buy at the low." };
  if (b <= 43) return { b, label: "Sell pressure", tone: "down", text: "More sellers than buyers — easier to buy in, but it may be slower to sell." };
  return { b, label: "Balanced", tone: "flat", text: "Buying and selling are roughly even — clean two-way flipping." };
}
function rangeRead(pct) {
  if (pct <= 25) return { tone: "up", text: "Near its recent low — historically a value zone." };
  if (pct >= 75) return { tone: "down", text: "Near its recent high — pricier than usual, more risk buying here." };
  return { tone: "flat", text: "Mid-range — no strong value or risk signal from price position alone." };
}

/* persistent state via artifact storage, falls back to in-memory */
function usePersistent(key, initial) {
  const [val, setVal] = useState(initial);
  const ready = useRef(false);
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(key);
        if (raw != null) setVal(JSON.parse(raw));
      }
    } catch (e) { /* no stored value */ }
    ready.current = true;
  }, []);
  useEffect(() => {
    if (!ready.current) return;
    try { if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }, [val]);
  return [val, setVal];
}

const METRIC = {
  margin: "Profit per item after the 2% GE tax — that is sell price minus buy price minus tax. The core 'is this worth flipping' number.",
  roi: "Return on investment: margin as a percentage of the buy price. High ROI means more profit per gp invested — what matters when your cash stack is the limit.",
  potential: "Max realistic profit per 4-hour cycle = margin × buy limit. The true 'how much can I actually make here' figure.",
  limit: "The most of this item you can buy every 4 hours through the Grand Exchange.",
  volume: "How many of this item trade per day. High volume means your buy/sell offers fill quickly; low volume means they may sit unfilled.",
  tax: "A 2% tax taken from the seller on most items, capped at 5m per item. Items under 50 gp and a few special items (like bonds) are exempt.",
};

/* =============================== sample data =============================== */
const MOCK = [
  { id: 20997, name: "Twisted bow", low: 1_151_000_000, high: 1_184_000_000, limit: 8, members: true, highalch: 0, vol: 40, examine: "A mystical bow carved from the remains of the Great Olm." },
  { id: 27277, name: "Tumeken's shadow (uncharged)", low: 1_002_000_000, high: 1_041_000_000, limit: 8, members: true, highalch: 0, vol: 18, examine: "A staff that channels the power of Tumeken." },
  { id: 22486, name: "Scythe of vitur (uncharged)", low: 758_000_000, high: 791_000_000, limit: 8, members: true, highalch: 0, vol: 25, examine: "A scythe once wielded by Verzik Vitur." },
  { id: 13652, name: "Dragon claws", low: 78_200_000, high: 81_900_000, limit: 8, members: true, highalch: 0, vol: 1_200, examine: "A set of fearsome dragon claws." },
  { id: 11832, name: "Bandos chestplate", low: 22_900_000, high: 24_700_000, limit: 8, members: true, highalch: 0, vol: 1_600, examine: "A sturdy chestplate of Bandosian make." },
  { id: 11834, name: "Bandos tassets", low: 25_800_000, high: 27_600_000, limit: 8, members: true, highalch: 0, vol: 1_500, examine: "Sturdy plate leg armour." },
  { id: 11785, name: "Armadyl crossbow", low: 27_900_000, high: 29_900_000, limit: 8, members: true, highalch: 0, vol: 1_100, examine: "A crossbow blessed by Armadyl." },
  { id: 13576, name: "Dragon warhammer", low: 27_700_000, high: 29_600_000, limit: 70, members: true, highalch: 90_000, vol: 2_400, examine: "A powerful warhammer of dragon origin." },
  { id: 12924, name: "Toxic blowpipe (empty)", low: 2_680_000, high: 2_945_000, limit: 70, members: true, highalch: 0, vol: 3_500, examine: "A deadly blowpipe forged from a zulrah's fang." },
  { id: 4151, name: "Abyssal whip", low: 1_948_000, high: 2_158_000, limit: 70, members: true, highalch: 72_000, vol: 9_000, examine: "A weapon from the abyss." },
  { id: 13190, name: "Old school bond", low: 19_500_000, high: 20_350_000, limit: 100, members: true, highalch: 0, exempt: true, vol: 9_500, examine: "Redeemable for membership. Exempt from GE tax." },
  { id: 6685, name: "Saradomin brew (4)", low: 5_780, high: 6_320, limit: 2_000, members: true, highalch: 0, vol: 520_000, examine: "Restores stats and boosts defence." },
  { id: 2434, name: "Prayer potion (4)", low: 9_050, high: 9_820, limit: 2_000, members: true, highalch: 0, vol: 720_000, examine: "Restores your prayer points." },
  { id: 12695, name: "Super combat potion (4)", low: 11_480, high: 12_390, limit: 2_000, members: true, highalch: 0, vol: 410_000, examine: "A combined attack, strength and defence potion." },
  { id: 13441, name: "Anglerfish", low: 1_305, high: 1_452, limit: 6_000, members: true, highalch: 0, vol: 1_300_000, examine: "Heals more than its base level when low." },
  { id: 1513, name: "Magic logs", low: 1_010, high: 1_104, limit: 25_000, members: true, highalch: 0, vol: 480_000, examine: "Magical logs, used in high-level fires." },
  { id: 1127, name: "Rune platebody", low: 37_100, high: 39_050, limit: 70, members: false, highalch: 39_000, vol: 28_000, examine: "Provides excellent protection. (F2P)" },
  { id: 1333, name: "Rune scimitar", low: 14_050, high: 15_480, limit: 70, members: false, highalch: 22_200, vol: 35_000, examine: "A vicious, sharp scimitar. (F2P)" },
  { id: 561, name: "Nature rune", low: 96, high: 105, limit: 25_000, members: false, highalch: 108, vol: 4_800_000, examine: "Used for alchemy and binding spells." },
  { id: 560, name: "Death rune", low: 146, high: 161, limit: 25_000, members: false, highalch: 180, vol: 5_400_000, examine: "Used for high-level combat magic." },
  { id: 2, name: "Cannonball", low: 171, high: 185, limit: 9_000, members: true, highalch: 0, vol: 6_200_000, examine: "Ammunition for the dwarf multicannon." },
  { id: 1042, name: "Blue partyhat", low: 2_310_000_000, high: 2_362_000_000, limit: 2, members: false, highalch: 0, vol: 6, examine: "A nice hat from a cracker." },
  { id: 536, name: "Dragon bones", low: 2_610, high: 2_758, limit: 13_000, members: true, highalch: 0, vol: 2_800_000, examine: "These will give your prayer a great boost." },
];

const SAMPLE_CATALYSTS = [
  {
    event: "New raid / boss release", date: "On the roadmap", direction: "up", action: "Stock up early",
    items: ["Prayer potion (4)", "Saradomin brew (4)", "Super restore (4)", "Anglerfish", "Ranging / Super combat potions"],
    timing: "Buy supplies 1–2 weeks before launch while prices are still calm. Sell into the launch-week rush when everyone is grinding the new content. Expect prices to fade 2–4 weeks after as the hype dies down.",
    why: "New high-level PvM content reliably spikes demand for combat supplies and best-in-slot gear as thousands of players gear up to learn it at once.",
  },
  {
    event: "Double XP Weekend (DXP)", date: "Seasonal (usually announced ~2 wks ahead)", direction: "up", action: "Buy raw materials ahead",
    items: ["Magic / yew logs", "Raw fish", "Ores & bars", "Bones / dragon bones", "Herbs"],
    timing: "Accumulate skilling materials 1–2 weeks out; prices peak in the final days before and during the event. Sell into the weekend itself — don't buy at the peak.",
    why: "Players burn through skilling resources far faster during DXP, so raw and processable materials climb in the lead-up and soften afterward.",
  },
  {
    event: "Bot ban wave", date: "Periodic / unannounced", direction: "up", action: "Move fast if it hits",
    items: ["Nature rune", "Low-level ores & herbs", "Common farmed resources"],
    timing: "Hard to predict. If a big ban wave lands, buy within the first few days as supply tightens, then sell over the following 1–3 weeks before bot supply recovers.",
    why: "Mass bans cut the bot-driven supply of farmed resources, tightening supply and lifting prices until the farms come back online.",
  },
  {
    event: "PvP / DMM event", date: "Seasonal", direction: "up", action: "Stock PKing supplies",
    items: ["Sharks / Manta rays", "Combat potions", "Mid-tier PKing gear", "Looting bag supplies"],
    timing: "Buy PKing food and potions in the week before the event; sell during the event window when demand and consumption peak.",
    why: "PvP-focused events drive heavy consumption of food, potions and disposable gear as players fight and die repeatedly.",
  },
  {
    event: "Bond price ↔ membership demand", date: "Ongoing macro signal", direction: "up", action: "Watch, don't chase",
    items: ["Old school bond"],
    timing: "Not a quick flip — track it as a barometer. Sustained upward drift signals gold inflation and broad price rises across the economy.",
    why: "Bonds track real-money membership demand and the overall gold supply, making them a useful read on where the whole economy is heading.",
  },
];

const TIPS = [
  "Hype fades. After a popular update, item prices often spike then retrace — patience to fade the pump usually beats chasing it.",
  "Liquidity over margin. A 5% margin on a high-volume item you can flip 20× a day beats a 30% margin on something that trades twice a week.",
  "Buy limits reset every 4 hours. Stagger purchases across items so your cash is always working — use the limit timers in Tools.",
  "Watch the spread, not just the price. A widening buy/sell gap often signals uncertainty and a flipping opportunity.",
];

/* long-term holds — fundamental theses, not momentum. Illustrative; AI-refreshed on the live build. */
const LONGTERM = [
  {
    id: 20997, name: "Twisted bow", type: "Blue chip", horizon: "12–24 months",
    tagline: "BIS ranged weapon with content-driven demand",
    thesis: "The strongest ranged weapon in the game and effectively required for top-tier ranged PvM. Fresh ranged-heavy content keeps generating new demand, while supply enters only through Chambers of Xeric. Over long horizons it has tended to track playerbase growth and gold inflation.",
    bull: ["Near-mandatory for top ranged DPS — perennial demand", "Supply only drips in from one raid", "New PvM content historically lifts best-in-slot gear", "A high-value store of wealth that's still liquid for its tier"],
    risks: ["Big-ticket items fall hardest during major gold sinks or economy dips", "A direct nerf or a stronger ranged weapon would cap upside", "Low daily volume — exiting a large position takes patience"],
    approach: "A buy-and-hold core position. Accumulate on broad market dips, never into hype peaks. Think in many months.",
    watch: ["New raids or ranged bosses on the roadmap — bullish", "Any dev talk of ranged rebalancing — bearish"],
  },
  {
    id: 13190, name: "Old school bond", type: "Macro", horizon: "Ongoing",
    tagline: "Inflation hedge tied to membership demand",
    thesis: "Bonds convert real money into membership and gold, so their price reflects gold-supply inflation and how much players value membership. Over the long run, as gold floods the economy, the bond's gp price tends to drift upward — making it both a hedge and a barometer for the whole market.",
    bull: ["Tracks long-term gold inflation — a structural tailwind", "Always in demand; everyone needs membership", "Highly liquid for its value", "Exempt from GE tax"],
    risks: ["Jagex pricing or policy changes can move it directly", "Falling player numbers would soften demand", "Slow grind — not a quick flip"],
    approach: "Treat it as a savings vehicle and economy gauge rather than a flip. Sustained upward drift is your inflation signal.",
    watch: ["Membership price changes", "Large gold-sink updates that can temporarily reverse the drift"],
  },
  {
    id: 1042, name: "Blue partyhat", type: "Scarcity", horizon: "Multi-year",
    tagline: "Discontinued rare — fixed, shrinking supply",
    thesis: "Party hats are discontinued holiday items with a permanently fixed supply that only shrinks through bans and lost accounts. As the game's total wealth grows, an ever-larger pile of gp chases a static number of hats — the classic store-of-value play in OSRS.",
    bull: ["Supply can only fall, never rise", "Durable status and collector demand", "Has historically outpaced gold inflation over long stretches", "The market's de facto gold standard"],
    risks: ["Enormous entry price and very thin liquidity — slow to buy or sell", "Sentiment-driven; can stagnate for long stretches", "A duplication exploit or major shock could dent confidence"],
    approach: "Only with capital you can park for years. A pure patience play — buy and forget.",
    watch: ["Overall economy wealth trends", "Any rare-item duplication news — a real shock risk"],
  },
  {
    id: 27277, name: "Tumeken's shadow", type: "Growth", horizon: "6–18 months",
    tagline: "BIS magic weapon riding the magic meta",
    thesis: "The premier magic weapon, central to current high-level magic strategies. As Jagex keeps pushing magic-viable content and the spell meta evolves, demand scales with it — while supply comes only from Tombs of Amascut.",
    bull: ["Defines the magic DPS meta — sticky demand", "Supply gated behind a single raid", "Magic-focused content lifts it directly"],
    risks: ["Newer than tbow or scythe — less history, more volatile", "Directly exposed to any magic rebalancing", "High value, lower liquidity"],
    approach: "A growth-tilted hold. Accumulate on dips, but size it smaller than a blue-chip given the higher volatility.",
    watch: ["Magic-related update announcements", "Balance passes that touch magic"],
  },
  {
    id: 536, name: "Dragon bones", type: "Structural", horizon: "3–12 months",
    tagline: "Prayer-training staple with broad, steady demand",
    thesis: "Almost every account trains Prayer, and dragon bones are a backbone of efficient Prayer XP. Demand is broad and recurring, and tends to rise with the playerbase and with anything that pushes players toward high Prayer.",
    bull: ["Consumed constantly across the whole playerbase", "Demand grows with new high-level content", "Far more liquid than megarares — easy to scale in and out", "Reliably spikes around Double XP events"],
    risks: ["A new, cheaper Prayer method would undercut demand", "Supply bumps (drop-rate changes, new sources) can cap prices", "Lower absolute margins than big-ticket items"],
    approach: "Accumulate ahead of DXP and major PvM releases. A recurring-demand play you can actually flip in size.",
    watch: ["Double XP Weekend announcements — bullish", "New Prayer methods or bone sources — bearish"],
  },
];
const LT_COLOR = { "Blue chip": "var(--gold-bright)", "Macro": "#7fd6e8", "Scarcity": "#c98bff", "Growth": "var(--green)", "Structural": "var(--gold-dim)" };

/* =============================== small UI =============================== */
function InfoDot({ text }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, below: false });
  const btnRef = useRef(null);

  function toggle(e) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const W = 214, vw = window.innerWidth || 400, vh = window.innerHeight || 600;
      const left = Math.max(8, Math.min(vw - W - 8, r.left + r.width / 2 - W / 2));
      const below = r.top < vh * 0.35;
      setPos({ top: below ? r.bottom + 6 : r.top - 6, left, below });
    }
    setOpen((o) => !o);
  }
  useEffect(() => {
    if (!open) return;
    function dismiss(e) { if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("touchstart", dismiss);
    return () => { document.removeEventListener("mousedown", dismiss); document.removeEventListener("touchstart", dismiss); };
  }, [open]);

  return (
    <span className="info">
      <button className="info-dot" ref={btnRef} onClick={toggle} aria-label="definition">i</button>
      {open && (
        <span className="info-bub" style={{ position: "fixed", top: pos.top, left: pos.left, transform: pos.below ? "none" : "translateY(-100%)" }} onClick={(e) => e.stopPropagation()}>
          {text}
        </span>
      )}
    </span>
  );
}

/* Formatted number input — displays commas while typing; num() strips them for calculations */
function NumInput({ value, onChange, placeholder, style, className: cls }) {
  return (
    <input
      className={"num " + (cls || "").trim()}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(fmtNum(e.target.value))}
      placeholder={placeholder}
      style={style}
    />
  );
}

const ICON_SOURCES = [
  (id) => `https://static.runelite.net/cache/item/icon/${id}.png`,
  (id) => `https://secure.runescape.com/m=itemdb_oldschool/obj_sprite.gif?id=${id}`,
];
function Glyph({ id, name, members, size = 44 }) {
  const [srcIdx, setSrcIdx] = useState(0);
  useEffect(() => { setSrcIdx(0); }, [id]);
  const bg = members ? "linear-gradient(135deg,#3a2d12,#1c160a)" : "linear-gradient(135deg,#102a2a,#0a1717)";
  return (
    <div className="glyph" style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}>
      {srcIdx < ICON_SOURCES.length
        ? <img src={ICON_SOURCES[srcIdx](id)} alt="" onError={() => setSrcIdx((i) => i + 1)} style={{ width: "76%", height: "76%", objectFit: "contain", imageRendering: "pixelated" }} />
        : (name ? name.charAt(0) : "?")}
    </div>
  );
}
function Kpi({ label, value, sub, icon, accent, info }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}{info && <InfoDot text={info} />}</span>
        <span className="kpi-icon" style={{ color: accent }}>{icon}</span>
      </div>
      <div className="kpi-value mono" style={{ color: accent }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
function Chip({ active, onClick, children, icon }) {
  return <button className={"chip" + (active ? " chip-on" : "")} onClick={onClick}>{icon}<span>{children}</span></button>;
}
function ChartTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <div className="tip-row"><span style={{ color: "var(--green)" }}>Insta-buy</span><b className="mono">{fmtFull(p.high)}</b></div>
      <div className="tip-row"><span style={{ color: "var(--muted)" }}>Insta-sell</span><b className="mono">{fmtFull(p.low)}</b></div>
    </div>
  );
}
function DirBadge({ dir }) {
  if (dir === "up") return <span className="dirb dirb-up"><ArrowUpRight size={12} /> Upward bias</span>;
  if (dir === "down") return <span className="dirb dirb-down"><ArrowDownRight size={12} /> Downward bias</span>;
  return <span className="dirb dirb-flat"><Minus size={12} /> Range-bound</span>;
}
function ReasonIcon({ t }) {
  if (t === "up") return <TrendingUp size={13} style={{ color: "var(--green)" }} />;
  if (t === "down") return <TrendingDown size={13} style={{ color: "var(--red)" }} />;
  if (t === "warn") return <AlertTriangle size={13} style={{ color: "var(--gold-bright)" }} />;
  return <Minus size={13} style={{ color: "var(--muted2)" }} />;
}
function FreshPill({ lowTime, highTime, now }) {
  const sec = now / 1000 - Math.max(lowTime || 0, highTime || 0);
  const tier = freshTier(sec);
  return <span className={"fresh fresh-" + tier}><Clock size={10} /> {ageStr(sec)}</span>;
}
function RangeMini({ pct }) {
  const tone = pct <= 25 ? "var(--green)" : pct >= 75 ? "var(--red)" : "var(--gold-bright)";
  return (
    <div className="rmini" title="Where the price sits in its recent range">
      <div className="rmini-track"><div className="rmini-dot" style={{ left: pct + "%", background: tone }} /></div>
      <span className="rmini-lbl">lo</span><span className="rmini-lbl r">hi</span>
    </div>
  );
}
function PressureBar({ pressure }) {
  const r = pressureRead(pressure);
  return (
    <div>
      <div className="psr-head"><span>Order-book pressure</span><b style={{ color: r.tone === "up" ? "var(--green)" : r.tone === "down" ? "var(--red)" : "var(--muted)" }}>{r.label}</b></div>
      <div className="psr-bar"><div className="psr-buy" style={{ width: r.b + "%" }} /><div className="psr-sell" style={{ width: (100 - r.b) + "%" }} /></div>
      <div className="psr-legend"><span style={{ color: "var(--green)" }}>Buyers {r.b}%</span><span style={{ color: "var(--red)" }}>Sellers {100 - r.b}%</span></div>
      <div className="psr-text">{r.text}</div>
    </div>
  );
}
function RangeGauge({ range }) {
  const r = rangeRead(range.pct);
  const tone = r.tone === "up" ? "var(--green)" : r.tone === "down" ? "var(--red)" : "var(--gold-bright)";
  return (
    <div>
      <div className="rg-track"><div className="rg-dot" style={{ left: range.pct + "%", background: tone }} /></div>
      <div className="rg-ends mono"><span>{fmtGp(range.min)}</span><span>{fmtGp(range.max)}</span></div>
      <div className="psr-text">{r.text}</div>
    </div>
  );
}

/* =============================== detail modal =============================== */
function Detail({ item, onClose, watched, toggleWatch, addAlert, now }) {
  const [series, setSeries] = useState(null);
  const m = item.metrics;
  const [alType, setAlType] = useState("margin_above");
  const [alVal, setAlVal] = useState(fmtNum(String(Math.max(0, Math.round(m.margin)))));
  const [added, setAdded] = useState(false);
  const range = useMemo(() => rangeFromSeries(series || buildSeries(item.id, item.low, item.high), item.low, item.high), [series, item]);
  const lowAge = now / 1000 - (item.lowTime || 0);
  const highAge = now / 1000 - (item.highTime || 0);

  useEffect(() => {
    let dead = false;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3500);
    (async () => {
      try {
        const r = await fetch(`https://prices.runescape.wiki/api/v1/osrs/timeseries?timestep=5m&id=${item.id}`, { signal: ctrl.signal });
        if (!r.ok) throw 0;
        const d = (await r.json()).data || [];
        const pts = d.filter((x) => x.avgHighPrice && x.avgLowPrice).slice(-48).map((x, i) => ({ t: i, high: x.avgHighPrice, low: x.avgLowPrice }));
        if (!dead && pts.length > 6) { setSeries(pts); return; }
        throw 0;
      } catch { if (!dead) setSeries(buildSeries(item.id, item.low, item.high)); }
      finally { clearTimeout(to); }
    })();
    return () => { dead = true; ctrl.abort(); clearTimeout(to); };
  }, [item]);

  const alch = item.highalch ? item.highalch - item.low - 100 : null;
  const doAdd = () => { addAlert({ itemId: item.id, itemName: item.name, type: alType, value: num(alVal) }); setAdded(true); setTimeout(() => setAdded(false), 2200); };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="row gap" style={{ alignItems: "center" }}>
            <Glyph id={item.id} name={item.name} members={item.members} size={48} />
            <div>
              <div className="sheet-name display">{item.name}</div>
              <div className="row gap-sm" style={{ marginTop: 4 }}>
                {item.members ? <span className="tag tag-members"><Crown size={11} /> Members</span> : <span className="tag tag-f2p"><Globe size={11} /> Free</span>}
                <span className="tag">Limit {item.limit ? item.limit.toLocaleString() : "—"} / 4h</span>
              </div>
            </div>
          </div>
          <div className="row gap-sm">
            <button className={"star-btn" + (watched ? " star-on" : "")} onClick={() => toggleWatch(item.id)}><Star size={18} fill={watched ? "currentColor" : "none"} /></button>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="examine">{item.examine}</div>

        <div className="chart-wrap">
          <div className="chart-label">PRICE · LAST 24H {series ? "" : "· loading"}</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={series || []} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#48dd96" stopOpacity={0.35} /><stop offset="100%" stopColor="#48dd96" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e7b94a" stopOpacity={0.22} /><stop offset="100%" stopColor="#e7b94a" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="t" hide /><YAxis hide domain={["auto", "auto"]} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="high" stroke="#48dd96" strokeWidth={2} fill="url(#gHigh)" dot={false} />
                <Area type="monotone" dataKey="low" stroke="#e7b94a" strokeWidth={1.6} fill="url(#gLow)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="break">
          <div className="break-row"><span>Buy at (insta-sell)</span><b className="mono">{fmtFull(item.low)}</b></div>
          <div className="break-row"><span>Sell at (insta-buy)</span><b className="mono">{fmtFull(item.high)}</b></div>
          <div className="break-row sub"><span>GE tax (2%{item.exempt ? " · exempt" : ""}) <InfoDot text={METRIC.tax} /></span><b className="mono" style={{ color: "var(--red)" }}>{m.tax ? "-" + fmtFull(m.tax) : "0 gp"}</b></div>
          <div className="break-row total"><span>Net margin / item <InfoDot text={METRIC.margin} /></span><b className="mono" style={{ color: m.margin >= 0 ? "var(--green)" : "var(--red)" }}>{(m.margin >= 0 ? "+" : "") + fmtFull(m.margin)}</b></div>
        </div>

        <div className="grid2">
          <div className="mini"><span>ROI <InfoDot text={METRIC.roi} /></span><b className="mono" style={{ color: "var(--green)" }}>{m.roi.toFixed(2)}%</b></div>
          <div className="mini"><span>Potential / limit <InfoDot text={METRIC.potential} /></span><b className="mono" style={{ color: "var(--gold-bright)" }}>{fmtGp(m.potential)}</b></div>
          <div className="mini"><span>Daily volume <InfoDot text={METRIC.volume} /></span><b className="mono">{item.vol != null ? fmtGp(item.vol) : "—"}</b></div>
          <div className="mini"><span>High alch</span><b className="mono">{alch != null ? `${fmtGp(item.highalch)} (${alch > 0 ? "+" : ""}${fmtGp(alch)})` : "—"}</b></div>
        </div>

        <div className="liq"><Activity size={13} style={{ color: m.liqColor }} /><span>{m.liqText}</span></div>

        <div className="market-read">
          <div className="mr-title"><Gauge size={14} /> Live market read</div>
          <div className="mr-fresh">
            <div className={"mr-fresh-cell " + freshTier(highAge)}><span>Last buy</span><b className="mono"><Clock size={11} /> {ageStr(highAge)} ago</b></div>
            <div className={"mr-fresh-cell " + freshTier(lowAge)}><span>Last sell</span><b className="mono"><Clock size={11} /> {ageStr(lowAge)} ago</b></div>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>How recently each side actually traded. If one side is stale, that price is less reliable to act on.</div>
          <div className="mr-block"><PressureBar pressure={item.pressure != null ? item.pressure : 0.5} /></div>
          <div className="mr-block"><div className="mr-sub">Position in recent range</div><RangeGauge range={range} /></div>
        </div>

        <div className="alert-mini">
          <div className="alert-mini-title"><Bell size={13} /> Set a price alert</div>
          <div className="alert-row">
            <select value={alType} onChange={(e) => setAlType(e.target.value)}>
              <option value="margin_above">Margin at or above</option>
              <option value="price_below">Buy price at or below</option>
              <option value="price_above">Sell price at or above</option>
            </select>
            <NumInput value={alVal} onChange={setAlVal} placeholder="value" />
            <button className="btn-gold" onClick={doAdd}>{added ? "Added ✓" : "Add"}</button>
          </div>
          <div className="hint">Alerts are checked when you refresh. Manage them in the Tools tab.</div>
        </div>
      </div>
    </div>
  );
}

/* =============================== flips tab =============================== */
function FlipsTab({ loading, filtered, kpis, query, setQuery, sort, setSort, filter, setFilter, isWatched, toggleWatch, onSelect, now }) {
  return (
    <>
      {kpis && (
        <div className="kpis">
          <Kpi label="Top margin" value={"+" + fmtGp(kpis.byMargin.metrics.margin)} sub={kpis.byMargin.name} icon={<TrendingUp size={15} />} accent="var(--green)" info={METRIC.margin} />
          <Kpi label="Best ROI" value={kpis.byRoi.metrics.roi.toFixed(1) + "%"} sub={kpis.byRoi.name} icon={<ArrowUpRight size={15} />} accent="var(--gold-bright)" info={METRIC.roi} />
          <Kpi label="Top potential" value={fmtGp(kpis.byPot.metrics.potential)} sub={kpis.byPot.name} icon={<Flame size={15} />} accent="var(--gold)" info={METRIC.potential} />
          <Kpi label="Watching" value={kpis.watchN} sub={kpis.watchN ? fmtGp(kpis.watchPot) + " potential" : "tap ★ to track"} icon={<Star size={15} />} accent="var(--text)" />
        </div>
      )}

      <div className="controls">
        <div className="search">
          <Search size={16} className="search-ic" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items…" />
          {query && <button className="search-x" onClick={() => setQuery("")}><X size={14} /></button>}
        </div>
        <div className="chips">
          <Chip active={filter === "best"} onClick={() => setFilter("best")} icon={<Boxes size={13} />}>All</Chip>
          <Chip active={filter === "members"} onClick={() => setFilter("members")} icon={<Crown size={13} />}>Members</Chip>
          <Chip active={filter === "f2p"} onClick={() => setFilter("f2p")} icon={<Globe size={13} />}>F2P</Chip>
          <Chip active={filter === "volume"} onClick={() => setFilter("volume")} icon={<Activity size={13} />}>High volume</Chip>
          <Chip active={filter === "watch"} onClick={() => setFilter("watch")} icon={<Star size={13} />}>Watchlist</Chip>
        </div>
        <div className="sort">
          <SlidersHorizontal size={13} /><span className="sort-lbl">Sort</span>
          {[["potential", "Potential"], ["margin", "Margin"], ["roi", "ROI %"], ["volume", "Volume"], ["price", "Price"]].map(([k, l]) => (
            <button key={k} className={"sort-pill" + (sort === k ? " sort-on" : "")} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="list">
        {loading && <Skeletons />}
        {!loading && filtered.length === 0 && <div className="empty">No items match. Try clearing filters.</div>}
        {!loading && filtered.map((it, i) => {
          const m = it.metrics;
          return (
            <button key={it.id} className="card" style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }} onClick={() => onSelect(it)}>
              <span className={"card-star" + (isWatched(it.id) ? " on" : "")} onClick={(e) => { e.stopPropagation(); toggleWatch(it.id); }}><Star size={16} fill={isWatched(it.id) ? "currentColor" : "none"} /></span>
              <div className="card-id">
                <Glyph id={it.id} name={it.name} members={it.members} />
                <div className="card-name-wrap">
                  <div className="card-name">{it.name}</div>
                  <div className="row gap-sm card-tags">
                    {it.members ? <span className="tag tag-members"><Crown size={10} /> P2P</span> : <span className="tag tag-f2p"><Globe size={10} /> F2P</span>}
                    <span className="tag">×{it.limit ? it.limit.toLocaleString() : "—"}</span>
                    <FreshPill lowTime={it.lowTime} highTime={it.highTime} now={now} />
                  </div>
                </div>
              </div>
              <div className="card-stats">
                <div className="stat"><span>Buy</span><b className="mono">{fmtGp(it.low)}</b></div>
                <div className="stat"><span>Sell</span><b className="mono">{fmtGp(it.high)}</b></div>
                <div className="stat"><span>Margin</span><b className="mono" style={{ color: m.margin >= 0 ? "var(--green)" : "var(--red)" }}>{(m.margin >= 0 ? "+" : "") + fmtGp(m.margin)}</b></div>
                <div className="stat stat-hi"><span>Potential</span><b className="mono" style={{ color: "var(--gold-bright)" }}>{fmtGp(m.potential)}</b></div>
              </div>
              <div className="card-range"><div className="card-range-lbl">range</div><RangeMini pct={it.range ? it.range.pct : 50} /></div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* =============================== long-term thesis modal =============================== */
function LongTermModal({ entry, item, source, onClose, onOpenDetail }) {
  const [series, setSeries] = useState(null);
  const low = item ? item.low : 0, high = item ? item.high : 0;

  useEffect(() => {
    let dead = false;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3500);
    (async () => {
      try {
        const r = await fetch(`https://prices.runescape.wiki/api/v1/osrs/timeseries?timestep=24h&id=${entry.id}`, { signal: ctrl.signal });
        if (!r.ok) throw 0;
        const d = (await r.json()).data || [];
        const pts = d.filter((x) => x.avgHighPrice && x.avgLowPrice).map((x, i) => ({ t: i, v: Math.round((x.avgHighPrice + x.avgLowPrice) / 2) }));
        if (!dead && pts.length > 8) { setSeries(pts); return; }
        throw 0;
      } catch { if (!dead) setSeries(buildLongSeries(entry.id, low || 1000, high || 1100)); }
      finally { clearTimeout(to); }
    })();
    return () => { dead = true; ctrl.abort(); clearTimeout(to); };
  }, [entry]);

  const cur = item ? Math.round((item.low + item.high) / 2) : null;
  const accent = LT_COLOR[entry.type] || "var(--muted)";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="row gap" style={{ alignItems: "center" }}>
            <Glyph id={entry.id} name={entry.name} members={item ? item.members : false} size={48} />
            <div>
              <div className="sheet-name display">{entry.name}</div>
              <div className="row gap-sm" style={{ marginTop: 4, alignItems: "center" }}>
                <span className="lt-badge" style={{ color: accent, borderColor: "var(--line2)", border: "1px solid var(--line2)", padding: "3px 8px", borderRadius: 6 }}>{entry.type}</span>
                <span className="tag"><Clock size={11} /> {entry.horizon}</span>
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="lt-modal-tag">{entry.tagline}</div>

        <div className="chart-wrap">
          <div className="chart-label">PRICE · LONG RANGE {series ? "" : "· loading"} {cur != null && <span style={{ float: "right", color: "var(--gold-bright)" }}>now {fmtGp(cur)}</span>}</div>
          <div style={{ width: "100%", height: 150 }}>
            <ResponsiveContainer>
              <AreaChart data={series || []} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs><linearGradient id="gLT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c98bff" stopOpacity={0.3} /><stop offset="100%" stopColor="#c98bff" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="t" hide /><YAxis hide domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "#0c0f14", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }} formatter={(v) => [fmtFull(v), "Price"]} labelFormatter={() => ""} />
                <Area type="monotone" dataKey="v" stroke="#c98bff" strokeWidth={2} fill="url(#gLT)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lt-sec"><div className="lt-sec-h">Thesis</div><p className="lt-body">{entry.thesis}</p></div>
        <div className="lt-sec"><div className="lt-sec-h" style={{ color: "var(--green)" }}>The bull case</div><ul className="lt-list">{entry.bull.map((b, i) => <li key={i}><TrendingUp size={13} style={{ color: "var(--green)" }} /><span>{b}</span></li>)}</ul></div>
        <div className="lt-sec"><div className="lt-sec-h" style={{ color: "var(--red)" }}>Risks</div><ul className="lt-list">{entry.risks.map((b, i) => <li key={i}><AlertTriangle size={13} style={{ color: "var(--red)" }} /><span>{b}</span></li>)}</ul></div>
        <div className="lt-sec"><div className="lt-sec-h">Horizon &amp; approach</div><p className="lt-body">{entry.approach}</p></div>
        <div className="lt-sec"><div className="lt-sec-h">What to watch</div><ul className="lt-list">{entry.watch.map((b, i) => <li key={i}><Activity size={13} style={{ color: "var(--gold-bright)" }} /><span>{b}</span></li>)}</ul></div>

        <div className="lt-note"><AlertTriangle size={13} /><span>A long-term thesis about supply and demand — not a guarantee or financial advice. Longer horizons mean more can change. {source === "sample" ? "The price chart here is modeled; it uses real long-range history once hosted." : ""}</span></div>

        {item && <button className="btn-gold wide" onClick={() => onOpenDetail(item)}>View price &amp; flip detail</button>}
      </div>
    </div>
  );
}

/* =============================== forecast tab =============================== */
function ForecastTab({ pool, derived, source, onSelect, onOpenThesis }) {
  const [aiState, setAiState] = useState("idle");
  const [aiCatalysts, setAiCatalysts] = useState(null);

  const rising = useMemo(() => [...pool].sort((a, b) => Math.abs(b.sig.score) - Math.abs(a.sig.score)).slice(0, 5), [pool]);
  const risingIds = useMemo(() => new Set(rising.map((x) => x.id)), [rising]);
  const cooling = useMemo(() => [...pool].filter((x) => x.sig.score < 0 && !risingIds.has(x.id)).sort((a, b) => a.sig.score - b.sig.score).slice(0, 4), [pool, risingIds]);
  const pulse = useMemo(() => {
    if (!pool.length) return null;
    const up = [...pool].sort((a, b) => b.sig.momentum - a.sig.momentum)[0];
    const down = [...pool].sort((a, b) => a.sig.momentum - b.sig.momentum)[0];
    const vola = [...pool].sort((a, b) => b.sig.vola - a.sig.vola)[0];
    const volu = [...pool].sort((a, b) => (b.vol || 0) - (a.vol || 0))[0];
    return { up, down, vola, volu };
  }, [pool]);

  async function runAI() {
    setAiState("loading");
    try {
      const res = await fetch("/api/catalyst", { method: "POST" });
      const data = await res.json();
      if (!data || !data.ok || !Array.isArray(data.arr) || !data.arr.length) throw 0;
      setAiCatalysts(data.arr.slice(0, 5));
      setAiState("done");
    } catch (e) { setAiState("fail"); }
  }
  const catalysts = aiCatalysts || SAMPLE_CATALYSTS;

  return (
    <div className="tabwrap">
      <div className="tab-h"><LineChart size={18} /><h2 className="display">Forecast</h2></div>

      <div className="disclaimer">
        <AlertTriangle size={15} />
        <div>
          <b>Decision support, not a crystal ball.</b> No tool reliably predicts a market. These are signals and analysis to inform buy-low / sell-high timing — weigh them, don't bet the bank on them.
          <div className="disc-sub">{source === "live" ? "Signals computed on live OSRS price history." : "In this preview, signals are computed on sample price history. Live history powers them once hosted."}</div>
        </div>
      </div>

      <div className="sec-h">Top 5 to watch — near term <InfoDot text="Ranked by how strong the near-term signal is, based on recent price direction, how far the price sits from its usual daily level, and how much it trades. The suggested move is a starting point, not a guarantee." /></div>
      <div className="fc-list">
        {rising.map((it) => {
          const strength = Math.min(100, Math.abs(it.sig.score) * 8 + 8);
          const rec = recommend(it.sig);
          return (
            <button key={it.id} className="fc-card" onClick={() => onSelect(it)}>
              <div className="fc-top">
                <div className="row gap" style={{ alignItems: "center", minWidth: 0 }}>
                  <Glyph id={it.id} name={it.name} members={it.members} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div className="fc-name">{it.name}</div>
                    <DirBadge dir={it.sig.dir} />
                  </div>
                </div>
                <div className={"rec-pill rec-" + rec.tone}>{rec.label}</div>
              </div>
              <div className="rec-why">{rec.why}</div>
              <div className="bar-label">Signal strength</div>
              <div className="bar"><div className="bar-fill" style={{ width: strength + "%", background: it.sig.dir === "down" ? "linear-gradient(90deg,#7a2a30,var(--red))" : "linear-gradient(90deg,var(--gold-dim),var(--green))" }} /></div>
              <div className="why-h">Why</div>
              <ul className="reasons">
                {it.sig.reasons.slice(0, 3).map((r, i) => (<li key={i}><ReasonIcon t={r.t} /><span>{r.s}</span></li>))}
              </ul>
              <div className="fc-foot mono">Buy {fmtGp(it.low)} · Sell {fmtGp(it.high)} · Margin <b style={{ color: it.metrics.margin >= 0 ? "var(--green)" : "var(--red)" }}>{(it.metrics.margin >= 0 ? "+" : "") + fmtGp(it.metrics.margin)}</b></div>
            </button>
          );
        })}
      </div>

      {cooling.length > 0 && (
        <>
          <div className="sec-h">Cooling — watch for re-entry</div>
          <div className="cool-list">
            {cooling.map((it) => (
              <button key={it.id} className="cool-row" onClick={() => onSelect(it)}>
                <Glyph id={it.id} name={it.name} members={it.members} size={30} />
                <span className="cool-name">{it.name}</span>
                <span className="mono" style={{ color: "var(--red)" }}><ArrowDownRight size={12} /> {it.sig.momentum.toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sec-h"><Target size={14} /> Long-term watchlist <InfoDot text="Buy-and-hold ideas based on supply/demand fundamentals — rarity, structural demand, the economy — rather than short-term price moves. Tap a pick for the full thesis. Long horizons carry more uncertainty; these are ideas, not guarantees." /></div>
      <div className="lt-cards">
        {LONGTERM.map((e) => {
          const it = derived.find((x) => x.id === e.id);
          return (
            <button key={e.id} className="lt-card" onClick={() => onOpenThesis(e)}>
              <Glyph id={e.id} name={e.name} members={it ? it.members : false} size={40} />
              <div className="lt-main">
                <div className="lt-row1"><span className="lt-name">{e.name}</span><span className="lt-badge" style={{ color: LT_COLOR[e.type] || "var(--muted)" }}>{e.type}</span></div>
                <div className="lt-tag">{e.tagline}</div>
                <div className="lt-meta mono">{it ? fmtGp((it.low + it.high) / 2) : "—"} · {e.horizon}</div>
              </div>
              <span className="lt-open">Read <ChevronRight size={14} /></span>
            </button>
          );
        })}
      </div>

      <div className="sec-h"><Sparkles size={14} style={{ color: "var(--gold-bright)" }} /> Catalyst watch — events that move prices</div>
      <div className="ai-bar">
        <button className="btn-gold" onClick={runAI} disabled={aiState === "loading"}>
          {aiState === "loading" ? "Analyzing…" : <><Sparkles size={13} /> Generate live AI analysis</>}
        </button>
        <span className="ai-note">
          {aiState === "done" ? "Live analysis complete — sourced from Claude." : aiState === "fail" ? "Analysis unavailable — illustrative examples shown. If your key is set, check Vercel's function logs for the error." : "Uses Claude to cross-reference the OSRS roadmap. Illustrative examples shown below."}
        </span>
      </div>
      <div className="cat-list">
        {catalysts.map((c, i) => (
          <div key={i} className="cat-card">
            <div className="cat-top">
              <span className="cat-event">{c.event}</span>
              <span className="cat-date">{c.date}</span>
            </div>
            {c.action && <div className={"cat-action " + (c.direction === "down" ? "down" : "up")}>{c.direction === "down" ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}{c.action}</div>}
            <div className="cat-items-label">Best supplies</div>
            <div className="cat-items">{(c.items || []).map((it, j) => <span key={j} className="cat-chip">{it}</span>)}</div>
            {c.timing && <div className="cat-timing"><Clock size={13} /><span><b>When to buy &amp; sell:</b> {c.timing}</span></div>}
            <div className="cat-why">{c.why}</div>
          </div>
        ))}
      </div>

      {pulse && (
        <>
          <div className="sec-h"><Activity size={14} /> Market pulse</div>
          <div className="pulse">
            <button className="pulse-row" onClick={() => onSelect(pulse.up)}><span><TrendingUp size={13} style={{ color: "var(--green)" }} /> Biggest mover up</span><span className="pulse-v">{pulse.up.name} <b className="mono" style={{ color: "var(--green)" }}>+{pulse.up.sig.momentum.toFixed(1)}%</b></span></button>
            <button className="pulse-row" onClick={() => onSelect(pulse.down)}><span><TrendingDown size={13} style={{ color: "var(--red)" }} /> Biggest mover down</span><span className="pulse-v">{pulse.down.name} <b className="mono" style={{ color: "var(--red)" }}>{pulse.down.sig.momentum.toFixed(1)}%</b></span></button>
            <button className="pulse-row" onClick={() => onSelect(pulse.vola)}><span><Activity size={13} style={{ color: "var(--gold-bright)" }} /> Most volatile</span><span className="pulse-v">{pulse.vola.name} <b className="mono">{pulse.vola.sig.vola.toFixed(1)}%</b></span></button>
            <button className="pulse-row" onClick={() => onSelect(pulse.volu)}><span><Boxes size={13} style={{ color: "var(--muted)" }} /> Highest volume</span><span className="pulse-v">{pulse.volu.name} <b className="mono">{fmtGp(pulse.volu.vol)}</b></span></button>
          </div>
        </>
      )}

      <div className="sec-h">Things to think about</div>
      <div className="tips">{TIPS.map((t, i) => <div key={i} className="tip-card"><span className="tip-num mono">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></div>)}</div>
    </div>
  );
}

/* =============================== tracker tab =============================== */
function TrackerTab({ flips, addFlip, removeFlip }) {
  const [name, setName] = useState("");
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const [qty, setQty] = useState("1");

  const stats = useMemo(() => {
    const sorted = [...flips].sort((a, b) => a.ts - b.ts);
    let profit = 0, invested = 0, cum = 0; const chart = []; let best = null;
    sorted.forEach((f, i) => {
      const p = (f.sell - f.buy) * f.qty - geTax(f.sell) * f.qty;
      profit += p; invested += f.buy * f.qty; cum += p; chart.push({ t: i + 1, cum });
      if (!best || p > best.p) best = { ...f, p };
    });
    return { profit, invested, roi: invested ? (profit / invested) * 100 : 0, count: flips.length, chart, best };
  }, [flips]);

  const canAdd = name.trim() && num(buy) > 0 && num(sell) > 0 && num(qty) > 0;
  const submit = () => { if (!canAdd) return; addFlip({ name: name.trim(), buy: num(buy), sell: num(sell), qty: Math.round(num(qty)) }); setName(""); setBuy(""); setSell(""); setQty("1"); };

  return (
    <div className="tabwrap">
      <div className="tab-h"><Wallet size={18} /><h2 className="display">Profit Tracker</h2></div>

      <div className="kpis">
        <Kpi label="Total profit" value={(stats.profit >= 0 ? "+" : "") + fmtGp(stats.profit)} sub={`${stats.count} flips logged`} icon={<TrendingUp size={15} />} accent={stats.profit >= 0 ? "var(--green)" : "var(--red)"} />
        <Kpi label="Capital used" value={fmtGp(stats.invested)} sub="total spent on buys" icon={<Coins size={15} />} accent="var(--text)" />
        <Kpi label="Avg ROI" value={stats.roi.toFixed(1) + "%"} sub="profit ÷ capital" icon={<ArrowUpRight size={15} />} accent="var(--gold-bright)" info={METRIC.roi} />
        <Kpi label="Best flip" value={stats.best ? "+" + fmtGp(stats.best.p) : "—"} sub={stats.best ? stats.best.name : "log your first"} icon={<Flame size={15} />} accent="var(--gold)" />
      </div>

      <div className="form-card">
        <div className="form-title">Log a flip</div>
        <input className="ti" value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name (e.g. Abyssal whip)" />
        <div className="form-grid">
          <label className="fl"><span>Buy / ea</span><NumInput value={buy} onChange={setBuy} placeholder="0" /></label>
          <label className="fl"><span>Sell / ea</span><NumInput value={sell} onChange={setSell} placeholder="0" /></label>
          <label className="fl"><span>Qty</span><NumInput value={qty} onChange={setQty} placeholder="1" /></label>
        </div>
        {canAdd && <div className="form-preview mono">Profit after tax: <b style={{ color: (num(sell) - num(buy)) * num(qty) - geTax(num(sell)) * num(qty) >= 0 ? "var(--green)" : "var(--red)" }}>{fmtGp((num(sell) - num(buy)) * Math.round(num(qty)) - geTax(num(sell)) * Math.round(num(qty)))}</b></div>}
        <button className="btn-gold wide" onClick={submit} disabled={!canAdd}><Plus size={14} /> Log flip</button>
      </div>

      {stats.chart.length > 1 && (
        <div className="chart-wrap">
          <div className="chart-label">CUMULATIVE PROFIT</div>
          <div style={{ width: "100%", height: 170 }}>
            <ResponsiveContainer>
              <AreaChart data={stats.chart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#48dd96" stopOpacity={0.32} /><stop offset="100%" stopColor="#48dd96" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="t" hide /><YAxis hide />
                <Tooltip contentStyle={{ background: "#0c0f14", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }} formatter={(v) => [fmtFull(v), "Cumulative"]} labelFormatter={() => ""} />
                <Area type="monotone" dataKey="cum" stroke="#48dd96" strokeWidth={2} fill="url(#gP)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="sec-h">History</div>
      {flips.length === 0 && <div className="empty">No flips logged yet. Add one above to start tracking your gp.</div>}
      <div className="hist">
        {[...flips].sort((a, b) => b.ts - a.ts).map((f) => {
          const p = (f.sell - f.buy) * f.qty - geTax(f.sell) * f.qty;
          return (
            <div key={f.id} className="hist-row">
              <div className="hist-main">
                <div className="hist-name">{f.name} <span className="mono hist-qty">×{f.qty.toLocaleString()}</span></div>
                <div className="hist-sub mono">{fmtGp(f.buy)} → {fmtGp(f.sell)} · {new Date(f.ts).toLocaleDateString()}</div>
              </div>
              <div className="mono hist-p" style={{ color: p >= 0 ? "var(--green)" : "var(--red)" }}>{(p >= 0 ? "+" : "") + fmtGp(p)}</div>
              <button className="del" onClick={() => removeFlip(f.id)}><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
      <div className="persist-note"><Clock size={12} /> Saved on this device and restored when you return.</div>
    </div>
  );
}

/* =============================== tools tab =============================== */
function ToolsTab({ alerts, addAlert, removeAlert, timers, addTimer, removeTimer, now, derived }) {
  const [aName, setAName] = useState(""); const [aType, setAType] = useState("margin_above"); const [aVal, setAVal] = useState("");
  const [tName, setTName] = useState("");
  // flip calc
  const [cb, setCb] = useState(""); const [cs, setCs] = useState(""); const [cq, setCq] = useState("1");
  // alch calc (item lookup)
  const [alchQuery, setAlchQuery] = useState("");
  const [alchItem, setAlchItem] = useState(null);
  const [ab, setAb] = useState("");   // purchase price per item
  const [an, setAn] = useState("");   // nature rune price override
  const [aq, setAq] = useState("1");  // quantity / casts
  const naturePrice = useMemo(() => { const nr = derived.find((x) => x.id === 561); return nr ? nr.low : 100; }, [derived]);
  const alchMatches = useMemo(() => {
    const q = alchQuery.trim().toLowerCase();
    if (!q || (alchItem && alchItem.name.toLowerCase() === q)) return [];
    return derived.filter((x) => x.name.toLowerCase().includes(q)).slice(0, 6);
  }, [alchQuery, alchItem, derived]);
  const pickAlch = (it) => { setAlchItem(it); setAlchQuery(it.name); setAb(String(it.low)); };

  function evalAlert(a) {
    const list = derived;
    const it = list.find((x) => (a.itemId ? x.id === a.itemId : x.name.toLowerCase() === (a.itemName || "").toLowerCase())) || list.find((x) => x.name.toLowerCase().includes((a.itemName || "").toLowerCase()));
    if (!it) return { met: false, cur: null, label: "—", missing: true };
    if (a.type === "margin_above") return { met: it.metrics.margin >= a.value, cur: it.metrics.margin, label: "margin" };
    if (a.type === "price_below") return { met: it.low <= a.value, cur: it.low, label: "buy" };
    return { met: it.high >= a.value, cur: it.high, label: "sell" };
  }
  const typeLabel = { margin_above: "margin ≥", price_below: "buy ≤", price_above: "sell ≥" };
  const addA = () => { if (!aName.trim() || num(aVal) <= 0) return; addAlert({ itemName: aName.trim(), type: aType, value: num(aVal) }); setAName(""); setAVal(""); };

  const cTax = geTax(num(cs)) * Math.round(num(cq));
  const cProfit = (num(cs) - num(cb)) * Math.round(num(cq)) - cTax;
  const cRoi = num(cb) > 0 ? ((num(cs) - num(cb) - geTax(num(cs))) / num(cb)) * 100 : 0;
  const alchVal = alchItem ? (alchItem.highalch || 0) : 0;
  const effNature = num(an) || naturePrice;
  const aQty = Math.max(1, Math.round(num(aq)));
  const alchPerCast = alchVal - num(ab) - effNature;
  const alchTotal = alchPerCast * aQty;

  return (
    <div className="tabwrap">
      <div className="tab-h"><Wrench size={18} /><h2 className="display">Tools</h2></div>

      <div className="sec-h"><Bell size={14} /> Price &amp; margin alerts</div>
      <div className="form-card">
        <input className="ti" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Item name" />
        <div className="alert-row">
          <select value={aType} onChange={(e) => setAType(e.target.value)}>
            <option value="margin_above">Margin at or above</option>
            <option value="price_below">Buy price at or below</option>
            <option value="price_above">Sell price at or above</option>
          </select>
          <NumInput value={aVal} onChange={setAVal} placeholder="value" />
          <button className="btn-gold" onClick={addA}>Add</button>
        </div>
      </div>
      {alerts.length === 0 && <div className="empty sm">No alerts yet.</div>}
      <div className="alert-list">
        {alerts.map((a) => {
          const e = evalAlert(a);
          return (
            <div key={a.id} className={"alert-item" + (e.met ? " met" : "")}>
              <div>
                <div className="alert-name">{a.itemName}</div>
                <div className="alert-cond mono">{typeLabel[a.type]} {fmtGp(a.value)} {e.missing ? "· not in data" : `· now ${fmtGp(e.cur)}`}</div>
              </div>
              <div className="row gap-sm" style={{ alignItems: "center" }}>
                <span className={"alert-status " + (e.met ? "on" : "off")}>{e.met ? "Triggered" : "Pending"}</span>
                <button className="del" onClick={() => removeAlert(a.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="persist-note"><Clock size={12} /> Checked each time you refresh prices. Background push notifications come with hosting.</div>

      <div className="sec-h"><Timer size={14} /> Buy-limit timers</div>
      <div className="form-card">
        <div className="alert-row">
          <input className="ti" style={{ flex: 1 }} value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Item you just bought" />
          <button className="btn-gold" onClick={() => { if (!tName.trim()) return; addTimer(tName.trim()); setTName(""); }}><Plus size={13} /> Start</button>
        </div>
        <div className="hint">GE buy limits reset 4 hours after your first purchase.</div>
      </div>
      {timers.length === 0 && <div className="empty sm">No active timers.</div>}
      <div className="timer-list">
        {timers.map((t) => {
          const remain = t.start + 14400000 - now;
          const done = remain <= 0;
          const pct = Math.max(0, Math.min(100, (remain / 14400000) * 100));
          return (
            <div key={t.id} className={"timer-item" + (done ? " done" : "")}>
              <div className="timer-head">
                <span className="timer-name">{t.name}</span>
                <span className="mono timer-val" style={{ color: done ? "var(--green)" : "var(--gold-bright)" }}>{done ? "Reset — clear to buy" : hms(remain)}</span>
              </div>
              <div className="bar"><div className="bar-fill" style={{ width: (100 - pct) + "%", background: done ? "var(--green)" : "linear-gradient(90deg,var(--gold-dim),var(--gold-bright))" }} /></div>
              <button className="timer-del del" onClick={() => removeTimer(t.id)}><Trash2 size={13} /></button>
            </div>
          );
        })}
      </div>

      <div className="sec-h"><Calculator size={14} /> Calculators</div>
      <div className="form-card">
        <div className="form-title">Flip calculator</div>
        <div className="form-grid">
          <label className="fl"><span>Buy / ea</span><NumInput value={cb} onChange={setCb} placeholder="0" /></label>
          <label className="fl"><span>Sell / ea</span><NumInput value={cs} onChange={setCs} placeholder="0" /></label>
          <label className="fl"><span>Qty</span><NumInput value={cq} onChange={setCq} placeholder="1" /></label>
        </div>
        <div className="calc-out">
          <div><span>GE tax</span><b className="mono" style={{ color: "var(--red)" }}>-{fmtGp(cTax)}</b></div>
          <div><span>Net profit</span><b className="mono" style={{ color: cProfit >= 0 ? "var(--green)" : "var(--red)" }}>{(cProfit >= 0 ? "+" : "") + fmtGp(cProfit)}</b></div>
          <div><span>ROI</span><b className="mono" style={{ color: "var(--gold-bright)" }}>{cRoi.toFixed(2)}%</b></div>
        </div>
      </div>
      <div className="form-card">
        <div className="form-title">High alch calculator</div>
        <div className="picker">
          <input className="ti" value={alchQuery} onChange={(e) => { setAlchQuery(e.target.value); setAlchItem(null); }} placeholder="Search an item to alch…" />
          {alchMatches.length > 0 && (
            <div className="picker-list">
              {alchMatches.map((it) => (
                <button key={it.id} className="picker-item" onClick={() => pickAlch(it)}>
                  <Glyph id={it.id} name={it.name} members={it.members} size={26} />
                  <span className="picker-name">{it.name}</span>
                  <span className="mono picker-alch">{it.highalch ? "alch " + fmtGp(it.highalch) : "no alch"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {alchItem && (
          <>
            <div className="picker-selected">
              <span>High alch value of <b>{alchItem.name}</b></span>
              <b className="mono" style={{ color: alchVal ? "var(--gold-bright)" : "var(--muted2)" }}>{alchVal ? fmtGp(alchVal) : "—"}</b>
            </div>
            {!alchVal && <div className="hint">This item has no high alch value — it can't be alched.</div>}
            <div className="form-grid">
              <label className="fl"><span>Purchase price</span><NumInput value={ab} onChange={setAb} placeholder="0" /></label>
              <label className="fl"><span>Nature rune</span><NumInput value={an} onChange={setAn} placeholder={String(naturePrice)} /></label>
              <label className="fl"><span>Quantity</span><NumInput value={aq} onChange={setAq} placeholder="1" /></label>
            </div>
            <div className="calc-out">
              <div><span>Profit / cast</span><b className="mono" style={{ color: alchPerCast >= 0 ? "var(--green)" : "var(--red)" }}>{(alchPerCast >= 0 ? "+" : "") + fmtGp(alchPerCast)}</b></div>
              <div><span>Total ({aQty.toLocaleString()})</span><b className="mono" style={{ color: alchTotal >= 0 ? "var(--green)" : "var(--red)" }}>{(alchTotal >= 0 ? "+" : "") + fmtGp(alchTotal)}</b></div>
              <div><span>Nature / cast</span><b className="mono">{fmtGp(effNature)}</b></div>
            </div>
          </>
        )}
        {!alchItem && <div className="hint">Pick an item and Coffer fills in its high alch value automatically. The nature rune price is pulled from the market (override it if you like).</div>}
      </div>
    </div>
  );
}

/* =============================== plan tab (decision engine) =============================== */
function PlanTab({ derived, bankroll, setBankroll, onSelect, now }) {
  const [liquidOnly, setLiquidOnly] = useState(true);
  const B = num(bankroll);

  const plan = useMemo(() => {
    if (B <= 0) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    let cands = derived.filter((x) => x.metrics.margin > 0 && x.low > 0 && x.low <= B);
    if (liquidOnly) cands = cands.filter((x) => (x.vol || 0) >= 1000);
    cands = cands.filter((x) => (nowSec - Math.max(x.lowTime || 0, x.highTime || 0)) < 4 * 3600 || (x.vol || 0) >= 100000);
    cands = [...cands].sort((a, b) => b.metrics.roi - a.metrics.roi);
    let remaining = B; const rows = []; let totalProfit = 0, totalDeploy = 0;
    for (const it of cands) {
      if (rows.length >= 12) break;
      if (remaining < it.low) continue;
      const maxByCash = Math.floor(remaining / it.low);
      const qty = Math.min(it.limit || maxByCash, maxByCash);
      if (qty <= 0) continue;
      const deploy = qty * it.low;
      const profit = qty * it.metrics.margin;
      if (profit <= 0) continue;
      rows.push({ it, qty, deploy, profit, roi: it.metrics.roi });
      remaining -= deploy; totalProfit += profit; totalDeploy += deploy;
    }
    rows.sort((a, b) => b.profit - a.profit);
    return { rows, totalProfit, totalDeploy, idle: B - totalDeploy, roi: totalDeploy > 0 ? (totalProfit / totalDeploy) * 100 : 0 };
  }, [derived, B, liquidOnly]);

  const chips = [["10m", 10_000_000], ["50m", 50_000_000], ["100m", 100_000_000], ["1b", 1_000_000_000]];

  return (
    <div className="tabwrap">
      <div className="tab-h"><Target size={18} /><h2 className="display">Decision Engine</h2></div>
      <div className="eng-intro">Tell it your cash stack and it builds a concrete 4-hour buy plan — what to buy, how much, and the profit to expect — ranked for the best return on your gp.</div>

      <div className="form-card">
        <div className="bankroll">
          <Coins size={18} style={{ color: "var(--gold-bright)" }} />
          <NumInput className="bankroll-in" value={bankroll} onChange={setBankroll} placeholder="Your bankroll (gp)" />
        </div>
        <div className="chip-row">{chips.map(([l, v]) => <button key={l} className="amt-chip" onClick={() => setBankroll(fmtNum(String(v)))}>{l}</button>)}</div>
        <button className={"toggle" + (liquidOnly ? " on" : "")} onClick={() => setLiquidOnly((x) => !x)}>
          <span className="toggle-dot" />{liquidOnly ? "Liquid items only (recommended)" : "Including thin / low-volume items"}
        </button>
      </div>

      {B <= 0 && <div className="empty">Enter your bankroll above to build a plan.</div>}

      {plan && plan.rows.length === 0 && <div className="empty">No solid flips fit that bankroll right now. Try a larger amount or include thinner items.</div>}

      {plan && plan.rows.length > 0 && (
        <>
          <div className="kpis">
            <Kpi label="Profit / 4h" value={"+" + fmtGp(plan.totalProfit)} sub="if all offers fill" icon={<TrendingUp size={15} />} accent="var(--green)" />
            <Kpi label="Deployed" value={fmtGp(plan.totalDeploy)} sub={Math.round((plan.totalDeploy / B) * 100) + "% of bankroll"} icon={<Coins size={15} />} accent="var(--text)" />
            <Kpi label="Idle cash" value={fmtGp(plan.idle)} sub="no good flip found" icon={<Wallet size={15} />} accent="var(--gold)" />
            <Kpi label="Blended ROI" value={plan.roi.toFixed(1) + "%"} sub="per cycle" icon={<ArrowUpRight size={15} />} accent="var(--gold-bright)" info={METRIC.roi} />
          </div>

          <div className="sec-h">Your buy plan — this cycle</div>
          <div className="plan-list">
            {plan.rows.map(({ it, qty, deploy, profit, roi }, idx) => (
              <button key={it.id} className="plan-row" onClick={() => onSelect(it)}>
                <span className="plan-rank mono">{idx + 1}</span>
                <Glyph id={it.id} name={it.name} members={it.members} size={38} />
                <div className="plan-main">
                  <div className="plan-name">{it.name}</div>
                  <div className="plan-buy mono">Buy {qty.toLocaleString()} @ {fmtGp(it.low)} <span className="plan-deploy">· {fmtGp(deploy)} in</span></div>
                  <div className="row gap-sm" style={{ marginTop: 5 }}>
                    <FreshPill lowTime={it.lowTime} highTime={it.highTime} now={now} />
                    <span className="psr-mini">{pressureRead(it.pressure != null ? it.pressure : 0.5).label}</span>
                  </div>
                </div>
                <div className="plan-prof">
                  <b className="mono" style={{ color: "var(--green)" }}>+{fmtGp(profit)}</b>
                  <span className="mono plan-roi">{roi.toFixed(1)}% ROI</span>
                </div>
              </button>
            ))}
          </div>
          <div className="disclaimer" style={{ marginTop: 14 }}>
            <AlertTriangle size={15} />
            <div>This assumes every offer fills at the current price. Real fills depend on volume — the freshness and pressure tags flag where that's riskier. Buy limits reset every 4 hours, so this is one cycle's worth.</div>
          </div>
        </>
      )}
    </div>
  );
}

/* =============================== nav + skeleton =============================== */
function BottomNav({ tab, setTab }) {
  const items = [
    { k: "flips", label: "Flips", icon: <LayoutGrid size={19} /> },
    { k: "plan", label: "Plan", icon: <Target size={19} /> },
    { k: "forecast", label: "Forecast", icon: <LineChart size={19} /> },
    { k: "tracker", label: "Tracker", icon: <Wallet size={19} /> },
    { k: "tools", label: "Tools", icon: <Wrench size={19} /> },
  ];
  return (
    <nav className="nav">
      <div className="nav-inner nav5">
        {items.map((i) => (
          <button key={i.k} className={"nav-btn" + (tab === i.k ? " nav-on" : "")} onClick={() => setTab(i.k)}>
            {i.icon}<span>{i.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
function Skeletons() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="card sk">
          <div className="sk-glyph shimmer" />
          <div style={{ flex: 1 }}><div className="sk-line shimmer" style={{ width: "45%" }} /><div className="sk-line shimmer" style={{ width: "25%", marginTop: 8 }} /></div>
          <div className="sk-line shimmer" style={{ width: 120, height: 26 }} />
        </div>
      ))}
    </>
  );
}

/* =============================== main =============================== */
function Coffer({ onHome }) {
  const [items, setItems] = useState(MOCK);
  const [source, setSource] = useState("sample");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("flips");
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState(null);
  const [thesis, setThesis] = useState(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("potential");
  const [filter, setFilter] = useState("best");

  const [watch, setWatch] = usePersistent("coffer.watch", [4151, 13652]);
  const [alerts, setAlerts] = usePersistent("coffer.alerts", []);
  const [flips, setFlips] = usePersistent("coffer.flips", []);
  const [timers, setTimers] = usePersistent("coffer.timers", []);
  const [bankroll, setBankroll] = usePersistent("coffer.bankroll", "");

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  useEffect(() => {
    let dead = false;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3800);
    (async () => {
      setLoading(true);
      try {
        const [lR, mR] = await Promise.all([
          fetch("https://prices.runescape.wiki/api/v1/osrs/latest", { signal: ctrl.signal }),
          fetch("https://prices.runescape.wiki/api/v1/osrs/mapping", { signal: ctrl.signal }),
        ]);
        if (!lR.ok || !mR.ok) throw 0;
        const latest = (await lR.json()).data;
        const map = await mR.json();
        let vol = {};
        try { const vR = await fetch("https://prices.runescape.wiki/api/v1/osrs/24h", { signal: ctrl.signal }); if (vR.ok) vol = (await vR.json()).data || {}; } catch {}
        const merged = map.map((mm) => {
          const p = latest[mm.id]; const v = vol[mm.id];
          if (!p || p.high == null || p.low == null) return null;
          const buyVol = v ? (v.highPriceVolume || 0) : null;
          const sellVol = v ? (v.lowPriceVolume || 0) : null;
          return {
            id: mm.id, name: mm.name, low: p.low, high: p.high, limit: mm.limit || 0,
            members: mm.members, highalch: mm.highalch || 0, examine: mm.examine || "", exempt: false,
            vol: v ? (buyVol + sellVol) : null, buyVol, sellVol,
            highTime: p.highTime || null, lowTime: p.lowTime || null,
          };
        }).filter(Boolean).filter((x) => {
          if (x.limit <= 0 || x.high <= x.low) return false;
          // Spread cap: high/low > 5x is virtually always stale or irregular data, not a real flip.
          if (x.high / x.low > 5) return false;
          // Volume gate: if we have 24h volume data, drop items with < 10 daily trades.
          // Megarares (tbow ~40/day) pass easily; zero-volume junk is excluded.
          if (x.vol !== null && x.vol < 10) return false;
          // Freshness: if the API has timestamps, BOTH sides must have traded within 6 hours.
          // A stale side means the "price" could be hours or days out of date.
          if (x.highTime && x.lowTime) {
            const ms6h = 6 * 3600 * 1000;
            const now = Date.now();
            if ((now - x.highTime * 1000) > ms6h || (now - x.lowTime * 1000) > ms6h) return false;
          }
          return true;
        });
        if (!dead && merged.length > 50) { setItems(merged); setSource("live"); setLoading(false); return; }
        throw 0;
      } catch { if (!dead) { setItems(MOCK); setSource("sample"); setLoading(false); } }
      finally { clearTimeout(to); }
    })();
    return () => { dead = true; ctrl.abort(); clearTimeout(to); };
  }, [tick]);

  const isWatched = (id) => watch.includes(id);
  const toggleWatch = (id) => setWatch((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const addAlert = (a) => setAlerts((p) => [...p, { id: uid(), ...a }]);
  const removeAlert = (id) => setAlerts((p) => p.filter((x) => x.id !== id));
  const addFlip = (f) => setFlips((p) => [...p, { id: uid(), ts: Date.now(), ...f }]);
  const removeFlip = (id) => setFlips((p) => p.filter((x) => x.id !== id));
  const addTimer = (name) => setTimers((p) => [...p, { id: uid(), name, start: Date.now() }]);
  const removeTimer = (id) => setTimers((p) => p.filter((x) => x.id !== id));

  const derived = useMemo(() => items.map((it) => {
    const meta = decorate(it);
    const tax = geTax(it.high, it.exempt);
    const margin = it.high - it.low - tax;
    const roi = it.low > 0 ? (margin / it.low) * 100 : 0;
    const potential = margin * (it.limit || 0);
    const v = it.vol || 0;
    let liqText = "Volume unknown — verify before committing.", liqColor = "var(--muted)";
    if (v >= 100000) { liqText = "Deep liquidity — buy/sell offers fill fast."; liqColor = "var(--green)"; }
    else if (v >= 5000) { liqText = "Healthy volume — should flip reliably."; liqColor = "var(--green)"; }
    else if (v >= 500) { liqText = "Moderate volume — offers may sit a while."; liqColor = "var(--gold-bright)"; }
    else if (v > 0) { liqText = "Thin volume — patience needed, watch slippage."; liqColor = "var(--red)"; }
    return { ...it, ...meta, metrics: { tax, margin, roi, potential, liqText, liqColor } };
  }), [items]);

  const forecastPool = useMemo(() => {
    const top = [...derived].sort((a, b) => b.metrics.potential - a.metrics.potential).slice(0, 150);
    return top.map((it) => { const series = buildSeries(it.id, it.low, it.high); return { ...it, series, sig: computeSignals(series, it.vol) }; });
  }, [derived]);

  const filtered = useMemo(() => {
    let list = derived;
    if (query.trim()) { const q = query.toLowerCase(); list = list.filter((x) => x.name.toLowerCase().includes(q)); }
    if (filter === "members") list = list.filter((x) => x.members);
    else if (filter === "f2p") list = list.filter((x) => !x.members);
    else if (filter === "volume") list = list.filter((x) => (x.vol || 0) >= 50000);
    else if (filter === "watch") list = list.filter((x) => watch.includes(x.id));
    const key = { potential: "potential", margin: "margin", roi: "roi" }[sort];
    if (key) list = [...list].sort((a, b) => b.metrics[key] - a.metrics[key]);
    else if (sort === "volume") list = [...list].sort((a, b) => (b.vol || 0) - (a.vol || 0));
    else if (sort === "price") list = [...list].sort((a, b) => b.high - a.high);
    return list.slice(0, 80).map((it) => ({ ...it, range: rangeOf(it.id, it.low, it.high) }));
  }, [derived, query, filter, sort, watch]);

  const kpis = useMemo(() => {
    if (!derived.length) return null;
    const byMargin = [...derived].sort((a, b) => b.metrics.margin - a.metrics.margin)[0];
    const byRoi = [...derived].filter((x) => x.low > 1000).sort((a, b) => b.metrics.roi - a.metrics.roi)[0] || derived[0];
    const byPot = [...derived].sort((a, b) => b.metrics.potential - a.metrics.potential)[0];
    const watched = derived.filter((x) => watch.includes(x.id));
    return { byMargin, byRoi, byPot, watchN: watched.length, watchPot: watched.reduce((s, x) => s + x.metrics.potential, 0) };
  }, [derived, watch]);

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="bg-glow" /><div className="bg-noise" />

      <div className="wrap">
        <header className="hdr">
          <div className="brand">
            {onHome && <button className="back-btn" onClick={onHome} title="All tools"><ArrowLeft size={18} /></button>}
            <div className="brand-mark"><Coins size={20} /></div>
            <div><div className="brand-name display">COFFER</div><div className="brand-sub">Grand Exchange Intelligence</div></div>
          </div>
          <div className="row gap-sm" style={{ alignItems: "center" }}>
            <span className={"src " + (source === "live" ? "src-live" : "src-sample")}><span className="dot" />{source === "live" ? "Live" : "Sample data"}</span>
            <button className="icon-btn" onClick={() => setTick((t) => t + 1)} title="Refresh"><RefreshCw size={16} className={loading ? "spin" : ""} /></button>
          </div>
        </header>

        {tab === "flips" && <FlipsTab loading={loading} filtered={filtered} kpis={kpis} query={query} setQuery={setQuery} sort={sort} setSort={setSort} filter={filter} setFilter={setFilter} isWatched={isWatched} toggleWatch={toggleWatch} onSelect={setSelected} now={now} />}
        {tab === "plan" && <PlanTab derived={derived} bankroll={bankroll} setBankroll={setBankroll} onSelect={setSelected} now={now} />}
        {tab === "forecast" && <ForecastTab pool={forecastPool} derived={derived} source={source} onSelect={setSelected} onOpenThesis={setThesis} />}
        {tab === "tracker" && <TrackerTab flips={flips} addFlip={addFlip} removeFlip={removeFlip} />}
        {tab === "tools" && <ToolsTab alerts={alerts} addAlert={addAlert} removeAlert={removeAlert} timers={timers} addTimer={addTimer} removeTimer={removeTimer} now={now} derived={derived} />}

        {tab === "flips" && (
          <footer className="foot">
            {source === "sample" ? "Showing sample data inside the preview sandbox. The same build pulls live OSRS Wiki prices once hosted." : `Live OSRS Wiki prices · ${derived.length.toLocaleString()} items tracked.`}
            <br />Margin = sell − buy − 2% GE tax (capped 5m). Potential = margin × 4-hour buy limit.
          </footer>
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
      {selected && <Detail item={selected} onClose={() => setSelected(null)} watched={isWatched(selected.id)} toggleWatch={toggleWatch} addAlert={addAlert} now={now} />}
      {thesis && <LongTermModal entry={thesis} item={derived.find((x) => x.id === thesis.id) || null} source={source} onClose={() => setThesis(null)} onOpenDetail={(it) => { setThesis(null); setSelected(it); }} />}
    </div>
  );
}

/* =============================== launcher (hub) =============================== */
const TOOLS = [
  { k: "flips", live: true, name: "Flips", tag: "Live Flip Finder", desc: "A live, ranked feed of flips that actually fill — screened and priced by a quant engine for fill probability, liquidity and real margin.", icon: <TrendingUp size={22} />, accent: "#48dd96" },
  { k: "harvest", live: true, name: "Harvest", tag: "Tree & Herb Runs", desc: "Plans your herb and tree runs from live GE prices and your levels — best crop to plant, full shopping list, and honest gp.", icon: <Sprout size={22} />, accent: "#5fd07f" },
  { k: "lodestar", live: true, name: "Lodestar", tag: "Ironman Progression", desc: "What to do next, readiness checks for every milestone boss, and the QoL unlocks that matter — built for ironmen.", icon: <Compass size={22} />, accent: "#5cc8ff" },
  { k: "drops", live: false, name: "Drop Ledger", tag: "Boss & raid profit", desc: "Log kills and drops, track GP/hour and splits, and see your real loot luck over time.", icon: <Skull size={22} />, accent: "#c98bff" },
  { k: "dps", live: false, name: "Gear & DPS Lab", tag: "Combat optimiser", desc: "Compare setups, max hits and DPS against any monster to find your best loadout.", icon: <Swords size={22} />, accent: "#ff8a93" },
  { k: "skill", live: false, name: "Skill Planner", tag: "XP routes & costs", desc: "Fastest and cheapest training paths, with live material costs from the GE.", icon: <GraduationCap size={22} />, accent: "#7fd6e8" },
  { k: "clue", live: false, name: "Clue Companion", tag: "Treasure trails", desc: "Step lookups, reward odds and expected value per casket tier.", icon: <Map size={22} />, accent: "#48dd96" },
];
function Launcher({ onOpen }) {
  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="bg-glow" /><div className="bg-noise" />
      <div className="wrap hub-wrap">
        <header className="hub-hdr">
          <div className="hub-mark"><Sparkles size={26} /></div>
          <h1 className="hub-name display">GIELINOR</h1>
          <div className="hub-sub">An OSRS toolkit · tools for the grind</div>
        </header>

        <div className="hub-grid">
          {TOOLS.map((t) => (
            <button key={t.k} className={"tool-card" + (t.live ? "" : " soon")} onClick={() => t.live && onOpen(t.k)} disabled={!t.live}>
              <div className="tool-top">
                <div className="tool-icon" style={{ color: t.accent, borderColor: "var(--line)" }}>{t.icon}</div>
                {t.live ? <span className="tool-badge live">Live</span> : <span className="tool-badge">Coming soon</span>}
              </div>
              <div className="tool-name display">{t.name}</div>
              <div className="tool-tag">{t.tag}</div>
              <div className="tool-desc">{t.desc}</div>
              {t.live && <div className="tool-open">Open <ChevronRight size={14} /></div>}
            </button>
          ))}
        </div>

        <div className="hub-foot">More tools land here over time — all under one roof, one login, no extra setup.</div>
      </div>
    </div>
  );
}

/* =============================== app shell =============================== */
export default function App() {
  const [view, setView] = useState("home");
  useEffect(() => { try { window.scrollTo(0, 0); } catch (e) {} }, [view]);
  if (view === "flips") return <Flips onHome={() => setView("home")} />;
  if (view === "harvest") return <Harvest onHome={() => setView("home")} />;
  if (view === "lodestar") return <Lodestar onHome={() => setView("home")} />;
  return <Launcher onOpen={(k) => setView(k)} />;
}

/* =============================== styles =============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
:root{
  --bg:#0a0c10; --card:#13171e; --card2:#171c25;
  --gold:#e7b94a; --gold-bright:#f6cf6b; --gold-dim:#b58a2e;
  --green:#48dd96; --red:#ff6b78;
  --text:#f3efe6; --muted:#9aa1ad; --muted2:#6b7280;
  --line:rgba(231,185,74,0.14); --line2:rgba(255,255,255,0.06);
}
*{box-sizing:border-box}
.display{font-family:'Cinzel',serif;letter-spacing:.02em}
.mono{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.app{position:relative;min-height:100vh;width:100%;background:var(--bg);color:var(--text);font-family:'Sora',sans-serif;overflow-x:hidden}
.bg-glow{position:fixed;inset:0;pointer-events:none;background:radial-gradient(900px 480px at 78% -10%,rgba(231,185,74,.10),transparent 60%),radial-gradient(700px 520px at 8% 4%,rgba(72,221,150,.05),transparent 55%)}
.bg-noise{position:fixed;inset:0;pointer-events:none;opacity:.025;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{position:relative;max-width:900px;margin:0 auto;padding:20px 16px 96px}
.row{display:flex}.gap{gap:12px}.gap-sm{gap:7px}

.hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:13px}
.brand-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#1a1407;background:linear-gradient(135deg,var(--gold-bright),var(--gold-dim));box-shadow:0 6px 22px rgba(231,185,74,.28),inset 0 1px 0 rgba(255,255,255,.4)}
.brand-name{font-size:22px;font-weight:700;line-height:1;background:linear-gradient(180deg,#fff,var(--gold-bright));-webkit-background-clip:text;background-clip:text;color:transparent}
.brand-sub{font-size:11px;color:var(--muted);letter-spacing:.16em;text-transform:uppercase;margin-top:3px}
.src{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:5px 10px;border-radius:20px;border:1px solid var(--line2)}
.src .dot{width:6px;height:6px;border-radius:50%}
.src-live{color:var(--green)}.src-live .dot{background:var(--green);box-shadow:0 0 8px var(--green)}
.src-sample{color:var(--gold-bright)}.src-sample .dot{background:var(--gold-bright);box-shadow:0 0 8px var(--gold)}
.icon-btn{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);transition:.16s}
.icon-btn:hover{color:var(--text);border-color:var(--line);background:var(--card2)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:20px}
.kpi{background:linear-gradient(160deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:15px;padding:14px;position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--line),transparent)}
.kpi-top{display:flex;justify-content:space-between;align-items:center}
.kpi-label{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:600;display:inline-flex;align-items:center;gap:4px}
.kpi-value{font-size:20px;font-weight:700;margin-top:9px;line-height:1}
.kpi-sub{font-size:11px;color:var(--muted2);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.controls{margin-bottom:16px;display:flex;flex-direction:column;gap:11px}
.search{position:relative;display:flex;align-items:center}
.search-ic{position:absolute;left:13px;color:var(--muted2)}
.search input{width:100%;padding:12px 14px 12px 38px;border-radius:12px;background:var(--card);border:1px solid var(--line2);color:var(--text);font-family:'Sora';font-size:14px;outline:none;transition:.16s}
.search input:focus{border-color:var(--line);background:var(--card2);box-shadow:0 0 0 3px rgba(231,185,74,.07)}
.search input::placeholder{color:var(--muted2)}
.search-x{position:absolute;right:10px;background:none;border:none;color:var(--muted);cursor:pointer;display:grid;place-items:center}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
.chip{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;padding:8px 13px;border-radius:20px;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);font-family:'Sora';font-size:12.5px;font-weight:500;transition:.16s}
.chip:hover{color:var(--text)}
.chip-on{background:linear-gradient(135deg,rgba(231,185,74,.18),rgba(231,185,74,.06));border-color:var(--gold-dim);color:var(--gold-bright)}
.sort{display:flex;align-items:center;gap:7px;color:var(--muted2);flex-wrap:wrap}
.sort-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.1em;margin-right:2px}
.sort-pill{padding:6px 11px;border-radius:9px;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);font-family:'Sora';font-size:12px;font-weight:500;transition:.16s}
.sort-pill:hover{color:var(--text)}.sort-on{background:var(--card2);border-color:var(--gold-dim);color:var(--gold-bright)}

.list{display:flex;flex-direction:column;gap:10px}
.card{position:relative;text-align:left;width:100%;cursor:pointer;display:flex;align-items:center;gap:14px;background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:16px;padding:14px 16px;color:var(--text);font-family:'Sora';transition:.18s;animation:fadeUp .4s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.card:hover{border-color:var(--line);transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.35)}
.card-star{position:absolute;top:10px;right:12px;color:var(--muted2);transition:.16s;display:grid;place-items:center;cursor:pointer}
.card-star:hover{color:var(--gold-bright)}.card-star.on{color:var(--gold-bright);filter:drop-shadow(0 0 6px rgba(231,185,74,.5))}
.card-id{display:flex;align-items:center;gap:12px;min-width:0;flex:1.1}
.glyph{border-radius:12px;display:grid;place-items:center;flex-shrink:0;font-family:'Cinzel';font-weight:700;color:var(--gold-bright);border:1px solid var(--line);overflow:hidden}
.card-name-wrap{min-width:0}
.card-name{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
.card-tags{margin-top:5px}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:3px 7px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid var(--line2);color:var(--muted)}
.tag-members{color:var(--gold-bright);background:rgba(231,185,74,.08);border-color:rgba(231,185,74,.2)}
.tag-f2p{color:#7fd6e8;background:rgba(127,214,232,.08);border-color:rgba(127,214,232,.2)}
.card-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;flex:1.5}
.stat{display:flex;flex-direction:column;gap:3px;min-width:0}
.stat span{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted2);font-weight:600}
.stat b{font-size:13.5px;font-weight:700}.stat-hi b{font-size:14.5px}
.empty{text-align:center;color:var(--muted);padding:50px 0;font-size:14px}.empty.sm{padding:18px 0;font-size:13px}
.foot{margin-top:26px;text-align:center;font-size:11.5px;color:var(--muted2);line-height:1.7}

.sk{pointer-events:none}.sk-glyph{width:44px;height:44px;border-radius:12px}.sk-line{height:11px;border-radius:6px}
.shimmer{background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:200% 100%;animation:sh 1.3s infinite}@keyframes sh{to{background-position:-200% 0}}

/* info dot */
.info{position:relative;display:inline-flex}
.info-dot{width:14px;height:14px;border-radius:50%;border:1px solid var(--line);background:rgba(231,185,74,.1);color:var(--gold-bright);font-size:9px;font-weight:700;font-style:italic;cursor:pointer;display:grid;place-items:center;line-height:1;font-family:Georgia,serif}
.info-bub{width:214px;background:#0c0f14;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:11.5px;line-height:1.5;color:var(--muted);font-weight:400;text-transform:none;letter-spacing:normal;z-index:1000;box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:'Sora'}

/* tabs shared */
.tabwrap{animation:fadeUp .3s ease both}
.tab-h{display:flex;align-items:center;gap:10px;margin-bottom:16px;color:var(--gold-bright)}
.tab-h h2{font-size:20px;font-weight:700;margin:0;color:var(--text)}
.sec-h{display:flex;align-items:center;gap:7px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600;margin:22px 0 12px}
.btn-gold{display:inline-flex;align-items:center;gap:6px;justify-content:center;padding:9px 14px;border-radius:10px;border:1px solid var(--gold-dim);background:linear-gradient(135deg,rgba(231,185,74,.2),rgba(231,185,74,.08));color:var(--gold-bright);font-family:'Sora';font-size:13px;font-weight:600;cursor:pointer;transition:.16s;white-space:nowrap}
.btn-gold:hover{background:linear-gradient(135deg,rgba(231,185,74,.3),rgba(231,185,74,.14))}
.btn-gold:disabled{opacity:.5;cursor:default}
.btn-gold.wide{width:100%;margin-top:10px;padding:12px}

/* disclaimer */
.disclaimer{display:flex;gap:11px;align-items:flex-start;background:linear-gradient(135deg,rgba(231,185,74,.08),rgba(231,185,74,.02));border:1px solid var(--line);border-radius:14px;padding:14px;font-size:13px;line-height:1.55;color:var(--text)}
.disclaimer svg{color:var(--gold-bright);flex-shrink:0;margin-top:2px}
.disc-sub{font-size:11.5px;color:var(--muted);margin-top:6px}

/* forecast cards */
.fc-list{display:flex;flex-direction:column;gap:11px}
.fc-card{text-align:left;width:100%;cursor:pointer;background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:16px;padding:15px;color:var(--text);font-family:'Sora';transition:.16s}
.fc-card:hover{border-color:var(--line);transform:translateY(-2px)}
.fc-top{display:flex;justify-content:space-between;align-items:center;gap:10px}
.fc-name{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px}
.fc-score{font-size:18px;font-weight:700;color:var(--gold-bright)}
.dirb{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:6px}
.dirb-up{color:var(--green);background:rgba(72,221,150,.1)}
.dirb-down{color:var(--red);background:rgba(255,107,120,.1)}
.dirb-flat{color:var(--muted);background:rgba(255,255,255,.05)}
.bar{height:6px;border-radius:6px;background:rgba(255,255,255,.06);margin:11px 0;overflow:hidden}
.bar-fill{height:100%;border-radius:6px;transition:width .5s ease}
.reasons{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}
.reasons li{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--muted);line-height:1.45}
.reasons li svg{flex-shrink:0;margin-top:2px}
.fc-foot{font-size:11.5px;color:var(--muted2);margin-top:11px;padding-top:11px;border-top:1px solid var(--line2)}
.cool-list{display:flex;flex-direction:column;gap:7px}
.cool-row{display:flex;align-items:center;gap:11px;width:100%;cursor:pointer;background:var(--card);border:1px solid var(--line2);border-radius:11px;padding:9px 13px;color:var(--text);font-family:'Sora';font-size:13px;transition:.16s}
.cool-row:hover{border-color:var(--line)}
.cool-name{flex:1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.ai-bar{display:flex;align-items:center;gap:12px;margin-bottom:13px;flex-wrap:wrap}
.ai-note{font-size:11.5px;color:var(--muted2);flex:1;min-width:160px}
.cat-list{display:flex;flex-direction:column;gap:11px}
.cat-card{background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:14px;padding:14px}
.cat-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}
.cat-event{font-weight:600;font-size:14px}
.cat-date{font-size:10.5px;color:var(--muted2);text-transform:uppercase;letter-spacing:.07em}
.cat-items{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px}
.cat-chip{font-size:11px;font-weight:500;padding:4px 9px;border-radius:7px;background:rgba(231,185,74,.08);border:1px solid rgba(231,185,74,.18);color:var(--gold-bright)}
.cat-why{font-size:12.5px;line-height:1.55;color:var(--muted)}
.cat-action{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:8px;margin-bottom:11px}
.cat-action.up{color:var(--green);background:rgba(72,221,150,.1);border:1px solid rgba(72,221,150,.22)}
.cat-action.down{color:var(--red);background:rgba(255,107,120,.1);border:1px solid rgba(255,107,120,.22)}
.cat-items-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted2);font-weight:600;margin-bottom:6px}
.cat-timing{display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.5;color:var(--muted);background:rgba(231,185,74,.06);border:1px solid var(--line2);border-radius:10px;padding:10px 11px;margin-bottom:9px}
.cat-timing svg{color:var(--gold-bright);flex-shrink:0;margin-top:1px}
.cat-timing b{color:var(--text);font-weight:600}

/* recommendation + bar labels */
.rec-pill{font-size:13px;font-weight:700;padding:7px 14px;border-radius:10px;white-space:nowrap;letter-spacing:.01em}
.rec-buy{color:#0a1f15;background:linear-gradient(135deg,#5fe6a6,#36b97a);box-shadow:0 4px 14px rgba(72,221,150,.3)}
.rec-sell{color:#2a0d10;background:linear-gradient(135deg,#ff8a93,#ef5a66);box-shadow:0 4px 14px rgba(255,107,120,.3)}
.rec-avoid{color:var(--red);background:rgba(255,107,120,.12);border:1px solid rgba(255,107,120,.3)}
.rec-hold{color:var(--gold-bright);background:rgba(231,185,74,.12);border:1px solid rgba(231,185,74,.3)}
.rec-why{font-size:13px;line-height:1.5;color:var(--text);margin:11px 0 4px}
.bar-label,.why-h{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted2);font-weight:600}
.bar-label{margin-bottom:5px}
.why-h{margin:12px 0 8px}

/* item picker (alch) */
.picker{position:relative}
.picker-list{position:absolute;top:100%;left:0;right:0;margin-top:6px;background:#0c0f14;border:1px solid var(--line);border-radius:12px;padding:6px;z-index:20;box-shadow:0 14px 36px rgba(0,0,0,.55);max-height:240px;overflow-y:auto}
.picker-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;cursor:pointer;background:none;border:none;border-radius:9px;padding:8px 9px;color:var(--text);font-family:'Sora';font-size:13px;transition:.12s}
.picker-item:hover{background:rgba(255,255,255,.05)}
.picker-name{flex:1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.picker-alch{font-size:11px;color:var(--gold-dim);font-weight:600;white-space:nowrap}
.picker-selected{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;font-size:13px;color:var(--muted)}
.picker-selected b{color:var(--text)}
.picker-selected .mono{font-size:16px}

.pulse{display:flex;flex-direction:column;gap:8px}
.pulse-row{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;cursor:pointer;background:var(--card);border:1px solid var(--line2);border-radius:11px;padding:11px 13px;color:var(--text);font-family:'Sora';font-size:12.5px;transition:.16s}
.pulse-row:hover{border-color:var(--line)}
.pulse-row>span:first-child{display:inline-flex;align-items:center;gap:7px;color:var(--muted)}
.pulse-v{text-align:right;font-size:12px}
.tips{display:flex;flex-direction:column;gap:9px}
.tip-card{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line2);border-radius:12px;padding:13px;font-size:13px;line-height:1.5;color:var(--muted)}
.tip-num{color:var(--gold-dim);font-weight:700;font-size:13px;flex-shrink:0}

/* long-term watchlist */
.lt-cards{display:flex;flex-direction:column;gap:10px}
.lt-card{display:flex;align-items:center;gap:13px;width:100%;text-align:left;cursor:pointer;background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:15px;padding:13px 15px;color:var(--text);font-family:'Sora';transition:.16s}
.lt-card:hover{border-color:var(--line);transform:translateY(-2px)}
.lt-main{flex:1;min-width:0}
.lt-row1{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.lt-name{font-weight:600;font-size:14.5px}
.lt-badge{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.lt-tag{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.4}
.lt-meta{font-size:11px;color:var(--muted2);margin-top:5px}
.lt-open{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;font-weight:600;color:var(--gold-bright);white-space:nowrap;flex-shrink:0}
.lt-modal-tag{font-size:13.5px;color:var(--muted);margin:14px 0;line-height:1.5;font-style:italic}
.lt-sec{margin-top:16px}
.lt-sec-h{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700;margin-bottom:9px}
.lt-body{font-size:13.5px;line-height:1.6;color:var(--text);margin:0}
.lt-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px}
.lt-list li{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.5;color:var(--muted)}
.lt-list li svg{flex-shrink:0;margin-top:2px}
.lt-note{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;line-height:1.5;color:var(--muted2);background:rgba(255,255,255,.025);border:1px solid var(--line2);border-radius:11px;padding:11px 12px;margin-top:18px}
.lt-note svg{color:var(--gold-bright);flex-shrink:0;margin-top:1px}

/* forms / inputs */
.form-card{background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:15px;padding:15px;margin-bottom:12px}
.form-title{font-size:13px;font-weight:600;margin-bottom:11px;color:var(--text)}
.ti,.num,select{width:100%;padding:10px 12px;border-radius:10px;background:#0d1016;border:1px solid var(--line2);color:var(--text);font-family:'Sora';font-size:13.5px;outline:none;transition:.16s}
.num{font-family:'JetBrains Mono';font-variant-numeric:tabular-nums}
.ti:focus,.num:focus,select:focus{border-color:var(--line);box-shadow:0 0 0 3px rgba(231,185,74,.07)}
.ti::placeholder,.num::placeholder{color:var(--muted2)}
select{cursor:pointer;-webkit-appearance:none;appearance:none}
.form-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:10px}
.fl{display:flex;flex-direction:column;gap:5px}
.fl span{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted2);font-weight:600}
.form-preview{margin-top:11px;font-size:12.5px;color:var(--muted)}
.alert-row{display:flex;gap:8px;align-items:center;margin-top:10px}
.alert-row select{flex:1.4}.alert-row .num{flex:1}
.hint{font-size:11px;color:var(--muted2);margin-top:9px;line-height:1.45}
.alert-mini{margin-top:14px;background:rgba(255,255,255,.025);border:1px solid var(--line2);border-radius:13px;padding:13px}
.alert-mini-title{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--gold-bright)}

.alert-list,.timer-list{display:flex;flex-direction:column;gap:8px}
.alert-item{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line2);border-radius:12px;padding:11px 13px}
.alert-item.met{border-color:rgba(72,221,150,.4);background:linear-gradient(135deg,rgba(72,221,150,.08),transparent)}
.alert-name{font-weight:600;font-size:13.5px}
.alert-cond{font-size:11px;color:var(--muted2);margin-top:3px}
.alert-status{font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:7px}
.alert-status.on{color:var(--green);background:rgba(72,221,150,.12)}
.alert-status.off{color:var(--muted2);background:rgba(255,255,255,.05)}
.del{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;cursor:pointer;background:rgba(255,107,120,.08);border:1px solid rgba(255,107,120,.18);color:var(--red);transition:.16s}
.del:hover{background:rgba(255,107,120,.18)}

.timer-item{position:relative;background:var(--card);border:1px solid var(--line2);border-radius:12px;padding:13px 13px 11px}
.timer-item.done{border-color:rgba(72,221,150,.4)}
.timer-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-right:36px}
.timer-name{font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.timer-val{font-size:15px;font-weight:700}
.timer-del{position:absolute;top:11px;right:11px;width:26px;height:26px}

.calc-out{display:flex;gap:16px;flex-wrap:wrap;margin-top:13px;padding-top:13px;border-top:1px solid var(--line2)}
.calc-out>div{display:flex;flex-direction:column;gap:4px}
.calc-out span{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted2);font-weight:600}
.calc-out b{font-size:16px}

/* tracker history */
.hist{display:flex;flex-direction:column;gap:8px}
.hist-row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line2);border-radius:12px;padding:11px 13px}
.hist-main{flex:1;min-width:0}
.hist-name{font-weight:600;font-size:13.5px}
.hist-qty{color:var(--muted2);font-size:11px;font-weight:500}
.hist-sub{font-size:11px;color:var(--muted2);margin-top:3px}
.hist-p{font-size:14.5px;font-weight:700}
.persist-note{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;color:var(--muted2);margin-top:14px}

/* overlay/sheet */
.overlay{position:fixed;inset:0;z-index:50;background:rgba(5,7,10,.7);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:fade .2s ease}
@keyframes fade{from{opacity:0}to{opacity:1}}
.sheet{width:100%;max-width:560px;max-height:92vh;overflow-y:auto;background:linear-gradient(180deg,var(--card2),var(--bg));border:1px solid var(--line);border-bottom:none;border-radius:24px 24px 0 0;padding:20px;animation:slideUp .28s cubic-bezier(.2,.8,.2,1)}
@keyframes slideUp{from{transform:translateY(40px);opacity:.5}to{transform:none;opacity:1}}
.sheet::-webkit-scrollbar{width:8px}.sheet::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px}
.sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.sheet-name{font-size:18px;font-weight:600}
.star-btn{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);transition:.16s}
.star-btn:hover{color:var(--gold-bright)}.star-on{color:var(--gold-bright);border-color:var(--gold-dim)}
.examine{margin:14px 0;font-size:13px;color:var(--muted);font-style:italic;line-height:1.5}
.chart-wrap{background:var(--card);border:1px solid var(--line2);border-radius:16px;padding:14px 10px 8px;margin-bottom:14px}
.chart-label{font-size:10px;letter-spacing:.14em;color:var(--muted2);font-weight:600;padding:0 6px 6px}
.tip{background:#0c0f14;border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-size:12px}
.tip-row{display:flex;justify-content:space-between;gap:18px;padding:1px 0}
.break{background:var(--card);border:1px solid var(--line2);border-radius:14px;padding:6px 14px;margin-bottom:12px}
.break-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;font-size:13px;color:var(--muted);border-bottom:1px solid var(--line2)}
.break-row b{color:var(--text);font-size:13.5px}.break-row.sub{font-size:12px;padding:7px 0}
.break-row span{display:inline-flex;align-items:center;gap:5px}
.break-row.total{border-bottom:none;padding-top:11px;font-size:14px;color:var(--text);font-weight:600}.break-row.total b{font-size:17px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.mini{background:var(--card);border:1px solid var(--line2);border-radius:12px;padding:11px 13px;display:flex;flex-direction:column;gap:5px}
.mini span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted2);font-weight:600;display:inline-flex;align-items:center;gap:5px}
.mini b{font-size:15px}
.liq{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);background:rgba(255,255,255,.025);border:1px solid var(--line2);border-radius:11px;padding:11px 13px}

/* bottom nav */
.nav{position:fixed;bottom:0;left:0;right:0;z-index:40;background:rgba(10,12,16,.85);backdrop-filter:blur(16px);border-top:1px solid var(--line2)}
.nav-inner{max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);padding:8px 12px calc(8px + env(safe-area-inset-bottom))}
.nav-inner.nav5{grid-template-columns:repeat(5,1fr)}
.nav-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 0;background:none;border:none;cursor:pointer;color:var(--muted2);font-family:'Sora';font-size:10.5px;font-weight:600;transition:.16s}
.nav-btn span{letter-spacing:.02em}
.nav-btn:hover{color:var(--muted)}
.nav-on{color:var(--gold-bright)}
.nav-on svg{filter:drop-shadow(0 0 8px rgba(231,185,74,.4))}

/* freshness pill */
.fresh{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;padding:3px 7px;border-radius:6px;border:1px solid var(--line2)}
.fresh-fresh{color:var(--green);background:rgba(72,221,150,.1);border-color:rgba(72,221,150,.2)}
.fresh-ok{color:var(--gold-bright);background:rgba(231,185,74,.1);border-color:rgba(231,185,74,.2)}
.fresh-stale{color:var(--red);background:rgba(255,107,120,.08);border-color:rgba(255,107,120,.2)}

/* card range mini */
.card-range{width:84px;flex-shrink:0;display:flex;flex-direction:column;gap:5px;align-items:center}
.card-range-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted2);font-weight:600}
.rmini{position:relative;width:100%}
.rmini-track{height:5px;border-radius:5px;background:linear-gradient(90deg,rgba(72,221,150,.35),rgba(255,255,255,.08),rgba(255,107,120,.35))}
.rmini-dot{position:absolute;top:50%;width:9px;height:9px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid var(--bg);box-shadow:0 0 6px rgba(0,0,0,.5)}
.rmini-lbl{font-size:8px;color:var(--muted2);position:absolute;top:8px}.rmini-lbl.r{right:0}

/* market read in detail */
.market-read{background:var(--card);border:1px solid var(--line2);border-radius:14px;padding:14px;margin-bottom:12px}
.mr-title{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--gold-bright);margin-bottom:11px}
.mr-fresh{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.mr-fresh-cell{border:1px solid var(--line2);border-radius:11px;padding:10px 11px;display:flex;flex-direction:column;gap:5px}
.mr-fresh-cell span{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted2);font-weight:600}
.mr-fresh-cell b{font-size:13.5px;display:inline-flex;align-items:center;gap:5px}
.mr-fresh-cell.fresh b{color:var(--green)}.mr-fresh-cell.ok b{color:var(--gold-bright)}.mr-fresh-cell.stale b{color:var(--red)}
.mr-block{margin-top:13px;padding-top:13px;border-top:1px solid var(--line2)}
.mr-sub{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted2);font-weight:600;margin-bottom:9px}
.psr-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted2);text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:8px}
.psr-bar{display:flex;height:9px;border-radius:6px;overflow:hidden;background:rgba(255,255,255,.06)}
.psr-buy{background:linear-gradient(90deg,#2a9d6a,var(--green))}
.psr-sell{background:linear-gradient(90deg,var(--red),#b3424c)}
.psr-legend{display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-top:6px}
.psr-text{font-size:12px;line-height:1.5;color:var(--muted);margin-top:8px}
.rg-track{position:relative;height:7px;border-radius:6px;background:linear-gradient(90deg,rgba(72,221,150,.4),rgba(231,185,74,.3),rgba(255,107,120,.4))}
.rg-dot{position:absolute;top:50%;width:13px;height:13px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid var(--bg);box-shadow:0 0 8px rgba(0,0,0,.6)}
.rg-ends{display:flex;justify-content:space-between;font-size:11px;color:var(--muted2);margin-top:7px}

/* decision engine */
.eng-intro{font-size:13px;line-height:1.55;color:var(--muted);margin-bottom:14px}
.bankroll{display:flex;align-items:center;gap:10px;background:#0d1016;border:1px solid var(--line2);border-radius:11px;padding:4px 12px}
.bankroll:focus-within{border-color:var(--line);box-shadow:0 0 0 3px rgba(231,185,74,.07)}
.bankroll-in{border:none;background:none;box-shadow:none;font-size:16px;padding:11px 0}
.bankroll-in:focus{box-shadow:none}
.chip-row{display:flex;gap:8px;margin-top:10px}
.amt-chip{flex:1;padding:8px;border-radius:9px;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);font-family:'JetBrains Mono';font-size:13px;font-weight:600;transition:.16s}
.amt-chip:hover{color:var(--gold-bright);border-color:var(--gold-dim)}
.toggle{display:flex;align-items:center;gap:9px;margin-top:12px;width:100%;cursor:pointer;background:none;border:none;color:var(--muted);font-family:'Sora';font-size:12.5px;font-weight:500;padding:0}
.toggle-dot{width:34px;height:19px;border-radius:20px;background:rgba(255,255,255,.1);position:relative;transition:.18s;flex-shrink:0}
.toggle-dot::after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:var(--muted);transition:.18s}
.toggle.on .toggle-dot{background:rgba(72,221,150,.3)}
.toggle.on .toggle-dot::after{left:17px;background:var(--green)}
.plan-list{display:flex;flex-direction:column;gap:9px}
.plan-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:14px;padding:12px 14px;color:var(--text);font-family:'Sora';transition:.16s}
.plan-row:hover{border-color:var(--line);transform:translateY(-2px)}
.plan-rank{font-size:12px;font-weight:700;color:var(--gold-dim);width:16px;flex-shrink:0}
.plan-main{flex:1;min-width:0}
.plan-name{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plan-buy{font-size:11.5px;color:var(--muted);margin-top:3px}
.plan-deploy{color:var(--muted2)}
.psr-mini{font-size:10px;font-weight:600;padding:3px 7px;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid var(--line2);color:var(--muted)}
.plan-prof{text-align:right;display:flex;flex-direction:column;gap:3px;flex-shrink:0}
.plan-prof b{font-size:15px}
.plan-roi{font-size:11px;color:var(--muted2)}

/* hub / launcher */
.hub-wrap{padding-top:42px}
.hub-hdr{text-align:center;margin-bottom:34px}
.hub-mark{width:60px;height:60px;border-radius:18px;margin:0 auto 16px;display:grid;place-items:center;color:#1a1407;background:linear-gradient(135deg,var(--gold-bright),var(--gold-dim));box-shadow:0 8px 30px rgba(231,185,74,.3),inset 0 1px 0 rgba(255,255,255,.4)}
.hub-name{font-size:34px;font-weight:700;line-height:1;background:linear-gradient(180deg,#fff,var(--gold-bright));-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:.06em}
.hub-sub{font-size:12px;color:var(--muted);letter-spacing:.18em;text-transform:uppercase;margin-top:9px}
.hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.tool-card{text-align:left;cursor:pointer;background:linear-gradient(155deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:18px;padding:18px;color:var(--text);font-family:'Sora';transition:.18s;display:flex;flex-direction:column;min-height:178px;position:relative;overflow:hidden}
.tool-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--line),transparent)}
.tool-card:hover:not(.soon){border-color:var(--gold-dim);transform:translateY(-3px);box-shadow:0 14px 36px rgba(0,0,0,.4)}
.tool-card.soon{opacity:.62;cursor:default}
.tool-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:13px}
.tool-icon{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;border:1px solid var(--line);background:rgba(255,255,255,.02)}
.tool-badge{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:4px 8px;border-radius:6px;color:var(--muted2);background:rgba(255,255,255,.05);border:1px solid var(--line2)}
.tool-badge.live{color:var(--green);background:rgba(72,221,150,.12);border-color:rgba(72,221,150,.25)}
.tool-name{font-size:18px;font-weight:700}
.tool-tag{font-size:11px;color:var(--gold-bright);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-top:3px}
.tool-desc{font-size:12px;line-height:1.5;color:var(--muted);margin-top:9px;flex:1}
.tool-open{display:inline-flex;align-items:center;gap:3px;font-size:12.5px;font-weight:600;color:var(--gold-bright);margin-top:12px}
.hub-foot{text-align:center;font-size:11.5px;color:var(--muted2);margin-top:26px}

/* back button */
.back-btn{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);transition:.16s;margin-right:2px}
.back-btn:hover{color:var(--gold-bright);border-color:var(--gold-dim)}

@media(max-width:640px){
  .kpis{grid-template-columns:1fr 1fr}
  .card{flex-direction:column;align-items:stretch;gap:13px;padding:14px}
  .card-id{flex:none}.card-name{max-width:none}
  .card-stats{flex:none;gap:8px}.stat b{font-size:13px}.stat-hi b{font-size:13.5px}
  .card-star{top:14px;right:14px}
  .card-range{width:100%}
  .brand-name{font-size:19px}
  .form-grid{grid-template-columns:1fr 1fr 1fr}
  .hub-grid{grid-template-columns:1fr}
  .hub-name{font-size:30px}
  .nav-btn span{font-size:10px}
}
`;
