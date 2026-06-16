import React, { useState, useMemo, useEffect } from "react";
import { ArrowLeft, RefreshCw, Coins, Sprout, TreePine, Info, ChevronDown, Leaf, AlertTriangle, Navigation, ArrowUpRight } from "lucide-react";

/* ============================================================
   Harvest — tree & herb run planner.
   Prices: shared prices.json from the pipeline (item-name → {high,low}).
   Levels: Wise Old Man (manual fallback).
   Yield: verified OSRS "harvest lives" model. Per-herb chance-to-save
   values are wiki-pinned (level-1 → 31.6% at level 99 for every herb).
   Tree check-health/plant XP and protection payments are wiki-verified.
   ============================================================ */
const OWNER_REPO = "richagreene/gielinor-toolkit";
const DATA_URL = `https://raw.githubusercontent.com/${OWNER_REPO}/data/prices.json`;

/* ---------- yield model ---------- */
const LIVES = { none: 3, compost: 4, super: 5, ultra: 6 };
const CTS_HIGH = 0.316;   // level-99 chance-to-save, identical for all herbs (wiki)

/* ---------- herb patches (ordered for an efficient run) ---------- */
const HERB_PATCHES = [
  { id: "ardougne",   name: "Ardougne",            unlock: "open",   diary: null,      save: 0,    tele: "Ardougne cloak / Ardy Teleport" },
  { id: "catherby",   name: "Catherby",            unlock: "open",   diary: "kandarin",save: 0,    tele: "Catherby tablet / Camelot" },
  { id: "falador",    name: "Falador",             unlock: "open",   diary: null,      save: 0,    tele: "Explorer's ring / Fally Teleport" },
  { id: "morytania",  name: "Morytania",           unlock: "open",   diary: null,      save: 0,    tele: "Ectophial" },
  { id: "hosidius",   name: "Hosidius",            unlock: "favour", diary: "kourend", save: 0.05, diseaseFree: true, tele: "Xeric's talisman" },
  { id: "guild65",    name: "Farming Guild",       unlock: "guild65",diary: "kourend", save: 0.05, tele: "Skills necklace / Farming cape" },
  { id: "weiss",      name: "Weiss",               unlock: "quest",  diary: null,      save: 0,    diseaseFree: true, tele: "Icy basalt" },
  { id: "trollheim",  name: "Trollheim",           unlock: "quest",  diary: null,      save: 0,    diseaseFree: true, tele: "Stony basalt / Trollheim Tele" },
  { id: "harmony",    name: "Harmony Island",      unlock: "quest",  diary: null,      save: 0,    tele: "Harmony teleport (POH board)" },
  { id: "varlamore",  name: "Civitas illa Fortis", unlock: "quest",  diary: null,      save: 0,    tele: "Civitas illa Fortis Teleport" },
];

/* ---------- herbs: cts = [level-1 chance, level-99 chance], wiki-pinned ---------- */
const HERBS = [
  { key: "guam",       name: "Guam",        farm: 9,  cts: [0.102, CTS_HIGH], seed: "Guam seed",        herb: "Grimy guam leaf",   potion: { key: "attack",    name: "Attack potion",   herb: 1  } },
  { key: "marrentill", name: "Marrentill",  farm: 14, cts: [0.113, CTS_HIGH], seed: "Marrentill seed",  herb: "Grimy marrentill",  potion: { key: "antipoison",name: "Antipoison",      herb: 5  } },
  { key: "tarromin",   name: "Tarromin",    farm: 19, cts: [0.125, CTS_HIGH], seed: "Tarromin seed",    herb: "Grimy tarromin",    potion: { key: "strength",  name: "Strength potion", herb: 12 } },
  { key: "harralander",name: "Harralander", farm: 26, cts: [0.145, CTS_HIGH], seed: "Harralander seed", herb: "Grimy harralander", potion: { key: "energy",    name: "Energy potion",   herb: 26 } },
  { key: "ranarr",     name: "Ranarr",      farm: 32, cts: [0.156, CTS_HIGH], seed: "Ranarr seed",      herb: "Grimy ranarr weed", potion: { key: "prayer",    name: "Prayer potion",   herb: 38 } },
  { key: "toadflax",   name: "Toadflax",    farm: 38, cts: [0.172, CTS_HIGH], seed: "Toadflax seed",    herb: "Grimy toadflax",    potion: { key: "brew",      name: "Saradomin brew",  herb: 81 } },
  { key: "irit",       name: "Irit",        farm: 44, cts: [0.184, CTS_HIGH], seed: "Irit seed",        herb: "Grimy irit leaf",   potion: { key: "superatt",  name: "Super attack",    herb: 45 } },
  { key: "avantoe",    name: "Avantoe",     farm: 50, cts: [0.199, CTS_HIGH], seed: "Avantoe seed",     herb: "Grimy avantoe",     potion: { key: "energy2",   name: "Super energy",    herb: 52 } },
  { key: "kwuarm",     name: "Kwuarm",      farm: 56, cts: [0.215, CTS_HIGH], seed: "Kwuarm seed",      herb: "Grimy kwuarm",      potion: { key: "superstr",  name: "Super strength",  herb: 55 } },
  { key: "snapdragon", name: "Snapdragon",  farm: 62, cts: [0.227, CTS_HIGH], seed: "Snapdragon seed",  herb: "Grimy snapdragon",  potion: { key: "restore",   name: "Super restore",   herb: 63 } },
  { key: "cadantine",  name: "Cadantine",   farm: 67, cts: [0.238, CTS_HIGH], seed: "Cadantine seed",   herb: "Grimy cadantine",   potion: { key: "superdef",  name: "Super defence",   herb: 66 } },
  { key: "lantadyme",  name: "Lantadyme",   farm: 73, cts: [0.254, CTS_HIGH], seed: "Lantadyme seed",   herb: "Grimy lantadyme",   potion: { key: "antifire",  name: "Antifire potion", herb: 69 } },
  { key: "dwarf",      name: "Dwarf weed",  farm: 79, cts: [0.266, CTS_HIGH], seed: "Dwarf weed seed",  herb: "Grimy dwarf weed",  potion: { key: "ranging",   name: "Ranging potion",  herb: 72 } },
  { key: "torstol",    name: "Torstol",     farm: 85, cts: [0.281, CTS_HIGH], seed: "Torstol seed",     herb: "Grimy torstol",     potion: { key: "supercb",   name: "Super combat",    herb: 90 } },
];

/* ---------- trees (XP = plant + check-health total; protection wiki-verified) ---------- */
const TREES = [   // regular tree patches
  { key: "oak",   name: "Oak",   farm: 15, sapling: "Oak sapling",   xp: 481.3,   protect: { item: "Tomatoes(5)", qty: 1 } },
  { key: "willow",name: "Willow",farm: 30, sapling: "Willow sapling",xp: 1481.5,  protect: { item: "Apples(5)",   qty: 1 } },
  { key: "maple", name: "Maple", farm: 45, sapling: "Maple sapling", xp: 3448.4,  protect: { item: "Oranges(5)",  qty: 1 } },
  { key: "yew",   name: "Yew",   farm: 60, sapling: "Yew sapling",   xp: 7150.9,  protect: { item: "Cactus spine",qty: 10 } },
  { key: "magic", name: "Magic", farm: 75, sapling: "Magic sapling", xp: 13913.8, protect: { item: "Coconut",     qty: 25 } },
];
const HARDWOODS = [   // hardwood patches — run with ultracompost, protection usually skipped
  { key: "teak",     name: "Teak",     farm: 35, sapling: "Teak sapling",     xp: 7325.0 },
  { key: "mahogany", name: "Mahogany", farm: 55, sapling: "Mahogany sapling", xp: 15783.0 },
];
const REDWOOD = { key: "redwood", name: "Redwood", farm: 90, sapling: "Redwood sapling", xp: 22680, protect: { item: "Dragonfruit", qty: 6 } };
const FRUIT = [
  { key: "apple",     name: "Apple",      farm: 27, sapling: "Apple sapling",      xp: 1221.5,  protect: { item: "Sweetcorn",       qty: 9 } },
  { key: "banana",    name: "Banana",     farm: 33, sapling: "Banana sapling",     xp: 1869.5,  protect: { item: "Apples(5)",       qty: 4 } },
  { key: "orange",    name: "Orange",     farm: 39, sapling: "Orange sapling",     xp: 2622.2,  protect: { item: "Strawberries(5)", qty: 3 } },
  { key: "curry",     name: "Curry",      farm: 42, sapling: "Curry sapling",      xp: 2986.9,  protect: { item: "Bananas(5)",      qty: 5 } },
  { key: "pineapple", name: "Pineapple",  farm: 51, sapling: "Pineapple sapling",  xp: 4848.7,  protect: { item: "Watermelon",      qty: 10 } },
  { key: "papaya",    name: "Papaya",     farm: 57, sapling: "Papaya sapling",     xp: 6452.4,  protect: { item: "Pineapple",       qty: 10 } },
  { key: "palm",      name: "Palm",       farm: 68, sapling: "Palm sapling",       xp: 10620.1, protect: { item: "Papaya fruit",    qty: 15 } },
  { key: "dragon",    name: "Dragonfruit",farm: 81, sapling: "Dragonfruit sapling",xp: 18055.5, protect: { item: "Coconut",         qty: 15 } },
];

/* tree-run patch routes (for teleport ordering) */
const TREE_PATCHES = [
  { name: "Gnome Stronghold", tele: "Spirit tree" },
  { name: "Tree Gnome Village", tele: "Spirit tree" },
  { name: "Falador", tele: "Explorer's ring / Fally Tele" },
  { name: "Taverley", tele: "Games necklace (Burthorpe)" },
  { name: "Varrock", tele: "Varrock Teleport (GE)" },
  { name: "Lumbridge", tele: "Lumbridge Teleport", unlock: "guild65inv" },
  { name: "Farming Guild", tele: "Skills necklace / Farming cape", unlock: "guild65" },
];
const HARDWOOD_PATCHES = [
  { name: "Fossil Island (W)", tele: "Digsite pendant / Fossil Is." },
  { name: "Fossil Island (E)", tele: "Digsite pendant / Fossil Is." },
];
const FRUIT_PATCHES = [
  { name: "Gnome Stronghold", tele: "Spirit tree" },
  { name: "Tree Gnome Village", tele: "Spirit tree" },
  { name: "Catherby", tele: "Catherby tablet" },
  { name: "Brimhaven", tele: "Charter ship / Brimhaven" },
  { name: "Lletya", tele: "Teleport crystal", unlock: "lletya" },
  { name: "Farming Guild", tele: "Skills necklace / Farming cape", unlock: "guild85" },
];

/* ---------- sample prices for offline preview ---------- */
const SAMPLE_PRICES = {
  "ultracompost": { high: 410, low: 380 }, "grimy ranarr weed": { high: 7100, low: 6950 }, "ranarr seed": { high: 38000, low: 37000 },
  "grimy snapdragon": { high: 3050, low: 2980 }, "snapdragon seed": { high: 53000, low: 52000 }, "grimy toadflax": { high: 4200, low: 4100 }, "toadflax seed": { high: 1600, low: 1500 },
  "grimy torstol": { high: 7300, low: 7150 }, "torstol seed": { high: 70000, low: 68000 }, "grimy irit leaf": { high: 600, low: 560 }, "irit seed": { high: 60, low: 45 },
  "grimy avantoe": { high: 1900, low: 1850 }, "avantoe seed": { high: 700, low: 650 }, "grimy kwuarm": { high: 2600, low: 2550 }, "kwuarm seed": { high: 320, low: 300 },
  "grimy cadantine": { high: 1300, low: 1250 }, "cadantine seed": { high: 350, low: 330 }, "grimy lantadyme": { high: 1500, low: 1450 }, "lantadyme seed": { high: 850, low: 800 },
  "grimy dwarf weed": { high: 1100, low: 1050 }, "dwarf weed seed": { high: 600, low: 560 }, "grimy harralander": { high: 6900, low: 6800 }, "harralander seed": { high: 100, low: 80 },
  "grimy guam leaf": { high: 30, low: 22 }, "guam seed": { high: 12, low: 8 }, "grimy marrentill": { high: 25, low: 18 }, "marrentill seed": { high: 14, low: 10 },
  "grimy tarromin": { high: 120, low: 100 }, "tarromin seed": { high: 30, low: 22 },
  "oak sapling": { high: 200, low: 150 }, "willow sapling": { high: 600, low: 500 }, "maple sapling": { high: 1200, low: 1000 }, "yew sapling": { high: 9000, low: 8500 }, "magic sapling": { high: 30000, low: 28000 },
  "teak sapling": { high: 1100, low: 1000 }, "mahogany sapling": { high: 2400, low: 2200 }, "redwood sapling": { high: 60000, low: 57000 },
  "apple sapling": { high: 600, low: 500 }, "banana sapling": { high: 700, low: 600 }, "orange sapling": { high: 900, low: 800 }, "curry sapling": { high: 1300, low: 1100 }, "pineapple sapling": { high: 2200, low: 2000 }, "papaya sapling": { high: 3500, low: 3200 }, "palm sapling": { high: 14000, low: 13000 }, "dragonfruit sapling": { high: 22000, low: 21000 },
  "tomatoes(5)": { high: 400, low: 350 }, "apples(5)": { high: 500, low: 420 }, "oranges(5)": { high: 700, low: 600 }, "strawberries(5)": { high: 600, low: 520 }, "bananas(5)": { high: 450, low: 400 },
  "cactus spine": { high: 350, low: 320 }, "coconut": { high: 600, low: 560 }, "sweetcorn": { high: 120, low: 100 }, "watermelon": { high: 220, low: 190 }, "pineapple": { high: 90, low: 70 }, "papaya fruit": { high: 280, low: 250 }, "dragonfruit": { high: 600, low: 540 }, "limpwurt root": { high: 380, low: 350 },
};

/* ---------- helpers ---------- */
const fmt = (n) => { if (n == null || isNaN(n)) return "—"; const neg = n < 0, a = Math.abs(n); let s; if (a >= 1e9) s = (a / 1e9).toFixed(2).replace(/\.?0+$/, "") + "b"; else if (a >= 1e6) s = (a / 1e6).toFixed(2).replace(/\.?0+$/, "") + "m"; else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k"; else s = String(Math.round(a)); return (neg ? "−" : "") + s; };
const geTax = (p) => (p < 50 ? 0 : Math.min(Math.floor(p * 0.02), 5_000_000));
function priceOf(map, name) { const e = map[String(name).toLowerCase()]; if (!e) return null; if (e.high != null && e.low != null) return (e.high + e.low) / 2; return e.high ?? e.low ?? null; }

function herbYield(crop, level, kit, patch) {
  const lives = LIVES[kit.compost] ?? 3;
  const [lo, hi] = crop.cts;
  let cts = lo + (hi - lo) * (Math.min(99, Math.max(1, level)) - 1) / 98;
  if (kit.secateurs) cts += 0.10;
  if (kit.cape) cts += 0.05;
  if (kit.attas) cts += 0.05;
  if (patch?.save) cts += patch.save;
  if (patch?.diary === "kandarin" && kit.kandarin) cts += kit.kandarin;
  if (patch?.diary === "kourend" && kit.kourendHard) cts += 0.05;
  cts = Math.min(0.95, Math.max(0, cts));
  return lives / (1 - cts);
}
function herbRun(crop, patches, level, kit, map) {
  const seedP = priceOf(map, crop.seed) ?? 0;
  const compP = kit.compost === "none" ? 0 : (priceOf(map, "ultracompost") ?? 0);
  const herbP = priceOf(map, crop.herb);
  let herbs = 0, cost = 0, revenue = 0; const priced = herbP != null;
  for (const p of patches) {
    const y = herbYield(crop, level, kit, p);
    herbs += y; cost += seedP + compP;
    if (priced) revenue += y * (herbP - geTax(herbP));
  }
  return { herbs, cost, revenue: priced ? revenue : null, net: priced ? revenue - cost : null, priced, perPatch: patches.length ? herbs / patches.length : 0 };
}
function bestGpHerb(patches, level, kit, map) {
  let best = null;
  for (const h of HERBS.filter((x) => x.farm <= level)) {
    const r = herbRun(h, patches, level, kit, map);
    if (r.net == null) continue;
    if (!best || r.net > best.net) best = { crop: h, ...r };
  }
  return best;
}

export default function Harvest({ onHome }) {
  const [tab, setTab] = useState("herb");
  const [priceMap, setPriceMap] = useState(SAMPLE_PRICES);
  const [sample, setSample] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rsn, setRsn] = useState("");
  const [farming, setFarming] = useState(82);
  const [herblore, setHerblore] = useState(79);
  const [womNote, setWomNote] = useState("");
  const [mode, setMode] = useState("gp");
  const [supplyTarget, setSupplyTarget] = useState("prayer");
  const [runsPerDay, setRunsPerDay] = useState(4);
  const [compost, setCompost] = useState("ultra");
  const [secateurs, setSecateurs] = useState(true);
  const [cape, setCape] = useState(false);
  const [attas, setAttas] = useState(false);
  const [kandarin, setKandarin] = useState(0.10);
  const [kourendHard, setKourendHard] = useState(false);
  const [unlocks, setUnlocks] = useState({ favour: true, guild65: true, weiss: false, trollheim: false, harmony: false, varlamore: false });
  const [showKit, setShowKit] = useState(false);

  const kit = { compost, secateurs, cape, attas, kandarin, kourendHard };

  const loadPrices = async () => {
    setLoading(true);
    try { const r = await fetch(`${DATA_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" }); if (r.ok) { const d = await r.json(); setPriceMap(d); setSample(false); } } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { loadPrices(); }, []);

  const loadWom = async () => {
    if (!rsn.trim()) return;
    setWomNote("Loading…");
    try {
      const r = await fetch(`https://api.wiseoldman.net/v2/players/${encodeURIComponent(rsn.trim())}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const sk = d?.latestSnapshot?.data?.skills || {};
      if (sk.farming?.level) setFarming(sk.farming.level);
      if (sk.herblore?.level) setHerblore(sk.herblore.level);
      setWomNote(`Loaded ${d.displayName}`);
    } catch (e) { setWomNote("Couldn't find that name — set levels manually below."); }
  };

  const openHerbPatches = useMemo(() => HERB_PATCHES.filter((p) => {
    if (p.unlock === "open") return true;
    if (p.unlock === "favour") return unlocks.favour;
    if (p.unlock === "guild65") return unlocks.guild65 && farming >= 65;
    if (p.unlock === "quest") return !!unlocks[p.id];
    return true;
  }), [unlocks, farming]);

  const herbPick = useMemo(() => {
    if (mode === "gp") return bestGpHerb(openHerbPatches, farming, kit, priceMap);
    const target = HERBS.find((h) => h.potion.key === supplyTarget);
    if (!target) return null;
    const r = herbRun(target, openHerbPatches, farming, kit, priceMap);
    return { crop: target, ...r, brewLocked: target.potion.herb > herblore };
  }, [mode, supplyTarget, openHerbPatches, farming, herblore, kit, priceMap]);

  // next-focus: gp angle (next unlock & whether it beats current) + xp angle (highest plantable)
  const nextFocus = useMemo(() => {
    const next = HERBS.find((h) => h.farm > farming);
    const highest = [...HERBS].reverse().find((h) => h.farm <= farming);
    let gpLine = null;
    if (next) {
      const projected = herbRun(next, openHerbPatches, next.farm, kit, priceMap);
      const cur = mode === "gp" ? herbPick : bestGpHerb(openHerbPatches, farming, kit, priceMap);
      if (projected.net != null && cur?.net != null) {
        const delta = projected.net - cur.net;
        gpLine = `At Farming ${next.farm}, ${next.name} unlocks → ~${fmt(projected.net)}/run (${delta >= 0 ? "+" + fmt(delta) + " vs now" : fmt(-delta) + " less than now"}).`;
      } else gpLine = `Next unlock: ${next.name} at Farming ${next.farm}.`;
    }
    return { next, highest, gpLine };
  }, [farming, openHerbPatches, kit, priceMap, mode, herbPick]);

  const rates = useMemo(() => {
    if (!herbPick || herbPick.net == null) return null;
    const patches = openHerbPatches.length;
    const activeMin = Math.round(patches * 2.5 + 5);
    return { activeMin, activeGpHr: herbPick.net / (activeMin / 60), gpDay: herbPick.net * runsPerDay };
  }, [herbPick, openHerbPatches, runsPerDay]);

  const shopping = useMemo(() => {
    if (!herbPick) return [];
    const n = openHerbPatches.length, c = herbPick.crop;
    const items = [{ name: c.seed, qty: n, each: priceOf(priceMap, c.seed) }];
    if (compost !== "none") items.push({ name: "Ultracompost", qty: n, each: priceOf(priceMap, "ultracompost") });
    return items.map((i) => ({ ...i, total: i.each != null ? i.each * i.qty : null }));
  }, [herbPick, openHerbPatches, compost, priceMap]);
  const shopTotal = shopping.reduce((s, i) => s + (i.total || 0), 0);

  // tree run: best regular (6) + best hardwood (2) + redwood (1, lvl90)
  const treeRun = useMemo(() => {
    const reg = [...TREES].reverse().find((t) => t.farm <= farming);
    const hard = [...HARDWOODS].reverse().find((t) => t.farm <= farming);
    const red = farming >= REDWOOD.farm ? REDWOOD : null;
    const cost = (t, n, withProt) => { const sap = priceOf(priceMap, t.sapling) ?? 0; const prot = withProt && t.protect ? (priceOf(priceMap, t.protect.item) ?? 0) * t.protect.qty : 0; const comp = withProt ? 0 : (priceOf(priceMap, "ultracompost") ?? 0); return (sap + prot + comp) * n; };
    let xp = 0, gp = 0; const lines = [];
    if (reg) { xp += reg.xp * 6; const c = cost(reg, 6, true); gp += c; lines.push({ name: reg.name, n: 6, xp: reg.xp * 6, cost: c, prot: reg.protect }); }
    if (hard) { xp += hard.xp * 2; const c = cost(hard, 2, false); gp += c; lines.push({ name: hard.name, n: 2, xp: hard.xp * 2, cost: c, comp: true }); }
    if (red) { xp += red.xp; const c = cost(red, 1, true); gp += c; lines.push({ name: red.name, n: 1, xp: red.xp, cost: c, prot: red.protect }); }
    return { reg, hard, red, xp, gp, lines };
  }, [farming, priceMap]);

  const fruitRun = useMemo(() => {
    const best = [...FRUIT].reverse().find((t) => t.farm <= farming);
    if (!best) return null;
    const sap = priceOf(priceMap, best.sapling) ?? 0;
    const prot = best.protect ? (priceOf(priceMap, best.protect.item) ?? 0) * best.protect.qty : 0;
    return { ...best, n: 6, xp: best.xp * 6, cost: (sap + prot) * 6 };
  }, [farming, priceMap]);

  const supplyTargets = HERBS.filter((h) => h.farm <= farming).map((h) => h.potion);

  const Route = ({ patches }) => (
    <div className="card">
      <div className="card-h"><Navigation size={14} /> Route &amp; teleports — {patches.length} stops</div>
      {patches.map((p, i) => <div key={p.name + i} className="route"><span className="rt-num">{i + 1}</span><span className="rt-name">{p.name}</span><span className="rt-tele">{p.tele}</span></div>)}
    </div>
  );

  return (
    <div className="hv">
      <style>{CSS}</style>
      <header className="hd">
        <div className="hd-l">{onHome && <button className="back" onClick={onHome} title="All tools"><ArrowLeft size={18} /></button>}<Sprout size={20} /><h1>Harvest</h1></div>
        <div className="hd-r">
          <span className={"feed " + (sample ? "warn" : "live")}>{sample ? "Sample prices" : "Live prices"}</span>
          <button className="ic" onClick={loadPrices}><RefreshCw size={15} className={loading ? "spin" : ""} /></button>
        </div>
      </header>

      <div className="lvls">
        <div className="lvl-in">
          <input value={rsn} onChange={(e) => setRsn(e.target.value)} placeholder="RuneScape name (optional)" onKeyDown={(e) => e.key === "Enter" && loadWom()} />
          <button className="lvl-go" onClick={loadWom}>Load</button>
        </div>
        <div className="lvl-pair">
          <label className="lvl"><span>Farming</span><input type="number" min="1" max="99" value={farming} onChange={(e) => setFarming(Math.max(1, Math.min(99, +e.target.value || 1)))} /></label>
          <label className="lvl"><span>Herblore</span><input type="number" min="1" max="99" value={herblore} onChange={(e) => setHerblore(Math.max(1, Math.min(99, +e.target.value || 1)))} /></label>
        </div>
      </div>
      {womNote && <div className="wom">{womNote}</div>}

      <div className="tabs">
        <button className={tab === "herb" ? "on" : ""} onClick={() => setTab("herb")}><Leaf size={14} /> Herb run</button>
        <button className={tab === "tree" ? "on" : ""} onClick={() => setTab("tree")}><TreePine size={14} /> Tree run</button>
        <button className={tab === "fruit" ? "on" : ""} onClick={() => setTab("fruit")}><Sprout size={14} /> Fruit run</button>
      </div>

      {tab === "herb" && (
        <>
          <div className="modes">
            <button className={mode === "gp" ? "on" : ""} onClick={() => setMode("gp")}>Maximize gp</button>
            <button className={mode === "supply" ? "on" : ""} onClick={() => setMode("supply")}>Self-supply</button>
          </div>

          {mode === "supply" && (
            <div className="supply-pick">
              <span className="sp-l">Potion to keep stocked</span>
              <div className="sp-row">{supplyTargets.map((p) => <button key={p.key} className={"sp" + (supplyTarget === p.key ? " on" : "")} onClick={() => setSupplyTarget(p.key)}>{p.name}</button>)}</div>
            </div>
          )}

          <button className="kit-toggle" onClick={() => setShowKit(!showKit)}>Run setup · {compost === "ultra" ? "ultra" : compost} compost{secateurs ? " · secateurs" : ""}{cape ? " · cape" : ""} <ChevronDown size={13} className={showKit ? "flip" : ""} /></button>
          {showKit && (
            <div className="kit">
              <div className="kit-row"><span>Compost</span><div className="seg">{["ultra", "super", "compost", "none"].map((c) => <button key={c} className={compost === c ? "on" : ""} onClick={() => setCompost(c)}>{c === "compost" ? "normal" : c}</button>)}</div></div>
              <label className="chk" onClick={() => setSecateurs(!secateurs)}><span className={"box" + (secateurs ? " on" : "")} />Magic secateurs (+10%)</label>
              <label className="chk" onClick={() => setCape(!cape)}><span className={"box" + (cape ? " on" : "")} />Farming cape (+5%)</label>
              <label className="chk" onClick={() => setAttas(!attas)}><span className={"box" + (attas ? " on" : "")} />Attas planted (+5%)</label>
              <label className="chk" onClick={() => setKourendHard(!kourendHard)}><span className={"box" + (kourendHard ? " on" : "")} />Kourend Hard diary (Hosidius/Guild)</label>
              <div className="kit-row"><span>Kandarin diary</span><div className="seg">{[["None", 0], ["Med", 0.05], ["Hard", 0.10], ["Elite", 0.15]].map(([l, v]) => <button key={l} className={kandarin === v ? "on" : ""} onClick={() => setKandarin(v)}>{l}</button>)}</div></div>
              <div className="kit-sub">Unlocked patches (what WOM can't see)</div>
              <div className="unlock-grid">
                {[["favour", "Hosidius (favour)"], ["guild65", "Farming Guild"], ["weiss", "Weiss"], ["trollheim", "Trollheim"], ["harmony", "Harmony"], ["varlamore", "Varlamore"]].map(([k, lbl]) =>
                  <label key={k} className="chk sm" onClick={() => setUnlocks((u) => ({ ...u, [k]: !u[k] }))}><span className={"box" + (unlocks[k] ? " on" : "")} />{lbl}</label>)}
              </div>
            </div>
          )}

          {!herbPick && <div className="empty">No herb available at Farming {farming}. Level up or check your unlocks.</div>}
          {herbPick && (
            <>
              <div className="hero">
                <div className="hero-top">
                  <div className="hero-herb">
                    <span className="hero-lbl">{mode === "gp" ? "Best herb to plant" : "Growing for " + (HERBS.find(h => h.potion.key === supplyTarget)?.potion.name)}</span>
                    <span className="hero-name">{herbPick.crop.name}</span>
                    <span className="hero-sub">{openHerbPatches.length} open patch{openHerbPatches.length !== 1 ? "es" : ""} · ~{herbPick.perPatch.toFixed(1)} herbs each</span>
                  </div>
                  <div className="hero-fig">{herbPick.net != null ? <><span className="hero-net">{fmt(herbPick.net)}</span><span className="hero-figl">net / run</span></> : <span className="hero-figl">price n/a</span>}</div>
                </div>
                {herbPick.brewLocked && <div className="warn-line"><AlertTriangle size={12} /> You can grow it, but {herbPick.crop.potion.name} needs Herblore {herbPick.crop.potion.herb}.</div>}
                <div className="rate-grid">
                  <div className="rate"><span>≈ herbs / run</span><b>{Math.round(herbPick.herbs)}</b></div>
                  <div className="rate"><span>seed + compost</span><b>{fmt(herbPick.cost)}</b></div>
                  {rates && <div className="rate hl"><span>active gp/hr <em title="Value of the minutes you actively spend — NOT sustainable, crops take ~80 min to regrow.">ⓘ</em></span><b>{fmt(rates.activeGpHr)}</b></div>}
                  {rates && <div className="rate"><span>realistic gp/day</span><b>{fmt(rates.gpDay)}</b></div>}
                </div>
                {rates && <div className="rate-note">Active gp/hr is the value of the ~{rates.activeMin} active min — you can't chain runs, so the honest figure is <b>{fmt(rates.gpDay)}/day</b> at {runsPerDay} runs/day.</div>}
                <div className="rpd"><span>Runs / day: <b>{runsPerDay}</b></span><input type="range" min="1" max="12" value={runsPerDay} onChange={(e) => setRunsPerDay(+e.target.value)} /></div>
              </div>

              <div className="nextf">
                <div className="nextf-h"><ArrowUpRight size={13} /> Next focus</div>
                {nextFocus.gpLine && <div className="nextf-row"><b>GP:</b> {nextFocus.gpLine}</div>}
                {!nextFocus.next && <div className="nextf-row"><b>GP:</b> You've unlocked every herb — plant the best-value one above.</div>}
                <div className="nextf-row"><b>XP:</b> For Farming/Herblore XP, plant the highest tier you can — {nextFocus.highest ? nextFocus.highest.name : "—"} is your top unlock right now{nextFocus.next ? `; ${nextFocus.next.name} opens at Farming ${nextFocus.next.farm}` : ""}.</div>
              </div>

              {mode === "supply" && herbPick.priced && <div className="supply-out"><Leaf size={13} /> One run ≈ <b>{Math.round(herbPick.herbs)}</b> {herbPick.crop.name.toLowerCase()} → ~<b>{Math.round(herbPick.herbs)}</b> {herbPick.crop.potion.name.toLowerCase()}s (≈1 herb per potion).</div>}

              <div className="card">
                <div className="card-h"><Coins size={14} /> Shopping list — {openHerbPatches.length} patches</div>
                {shopping.map((i) => <div key={i.name} className="shop"><span className="shop-n">{i.name}</span><span className="shop-q">×{i.qty}</span><span className="shop-t">{i.total != null ? fmt(i.total) : "—"}</span></div>)}
                <div className="shop total"><span className="shop-n">Total to buy</span><span /><span className="shop-t">{fmt(shopTotal)}</span></div>
              </div>

              <Route patches={openHerbPatches} />

              <div className="card">
                <div className="card-h"><Leaf size={14} /> Per-patch yield</div>
                {openHerbPatches.map((p) => { const y = herbYield(herbPick.crop, farming, kit, p); return <div key={p.id} className="route"><span className="rt-name">{p.name}{p.diseaseFree && <span className="df">disease-free</span>}</span><span className="rt-tele yld">{y.toFixed(1)} herbs</span></div>; })}
              </div>
            </>
          )}
        </>
      )}

      {tab === "tree" && (
        <>
          <div className="tree-note"><Info size={13} /> Tree runs are an <b>XP</b> activity — they cost gp and pay Farming experience toward max, not profit. Hardwoods run on ultracompost (protection skipped).</div>
          {treeRun.xp === 0 && <div className="empty">No trees available at Farming {farming}.</div>}
          {treeRun.xp > 0 && (
            <>
              <div className="hero">
                <div className="hero-top">
                  <div className="hero-herb">
                    <span className="hero-lbl">Best tree run for your level</span>
                    <span className="hero-name">{[treeRun.reg, treeRun.hard, treeRun.red].filter(Boolean).map(t => t.name).join(" · ")}</span>
                    <span className="hero-sub">6 tree + 2 hardwood{treeRun.red ? " + 1 redwood" : ""} patches</span>
                  </div>
                  <div className="hero-fig"><span className="hero-net xp">{fmt(treeRun.xp)}</span><span className="hero-figl">XP / run</span></div>
                </div>
                <div className="rate-grid">
                  <div className="rate"><span>gp cost / run</span><b className="cost">−{fmt(treeRun.gp)}</b></div>
                  <div className="rate"><span>gp / xp</span><b className="cost">−{(treeRun.gp / treeRun.xp).toFixed(2)}</b></div>
                </div>
                <div className="rate-note">Trees grow for hours, so this is ~1–2 runs/day. Cost is saplings + protection (hardwoods use ultracompost instead).</div>
              </div>

              <div className="card">
                <div className="card-h"><TreePine size={14} /> What to plant</div>
                {treeRun.lines.map((l) => <div key={l.name} className="route"><span className="rt-name">{l.name} <span className="req">×{l.n}</span></span><span className="rt-tele"><b className="xpv">{fmt(l.xp)} xp</b> · <span className="cost">−{fmt(l.cost)}</span></span></div>)}
                <div className="bring">Protection: {treeRun.reg ? `${treeRun.reg.name} → ${treeRun.reg.protect.qty}× ${treeRun.reg.protect.item}` : ""}{treeRun.red ? `; Redwood → 6× Dragonfruit` : ""}. Hardwoods: ultracompost, no payment.</div>
              </div>

              <Route patches={[...TREE_PATCHES.filter(p => !p.unlock || (p.unlock === "guild65" ? (unlocks.guild65 && farming >= 65) : true)), ...HARDWOOD_PATCHES, ...(treeRun.red ? [{ name: "Farming Guild (redwood)", tele: "Skills necklace / Farming cape" }] : [])]} />

              <div className="card">
                <div className="card-h"><TreePine size={14} /> Tree ladder</div>
                {[...TREES, ...HARDWOODS, REDWOOD].sort((a, b) => a.farm - b.farm).map((t) => <div key={t.key} className={"route" + (t.farm > farming ? " lock" : "")}><span className="rt-name">{t.name} <span className="req">Lv {t.farm}</span></span><span className="rt-tele yld">{fmt(t.xp)} xp</span></div>)}
              </div>
            </>
          )}
        </>
      )}

      {tab === "fruit" && (
        <>
          <div className="tree-note"><Info size={13} /> Fruit runs are an <b>XP</b> activity — they cost gp and pay Farming experience, not profit. Fruit trees grow ~16h, so ~1 run/day.</div>
          {!fruitRun && <div className="empty">No fruit tree available at Farming {farming}.</div>}
          {fruitRun && (
            <>
              <div className="hero">
                <div className="hero-top">
                  <div className="hero-herb"><span className="hero-lbl">Best fruit tree for your level</span><span className="hero-name">{fruitRun.name}</span><span className="hero-sub">{fruitRun.n} patches</span></div>
                  <div className="hero-fig"><span className="hero-net xp">{fmt(fruitRun.xp)}</span><span className="hero-figl">XP / run</span></div>
                </div>
                <div className="rate-grid">
                  <div className="rate"><span>XP each</span><b>{fmt(fruitRun.xp / fruitRun.n)}</b></div>
                  <div className="rate"><span>gp cost / run</span><b className="cost">−{fmt(fruitRun.cost)}</b></div>
                </div>
                <div className="rate-note">Cost is saplings + protection ({fruitRun.protect.qty}× {fruitRun.protect.item}) at live prices.</div>
              </div>
              <Route patches={FRUIT_PATCHES.filter(p => !p.unlock || (p.unlock === "guild85" ? farming >= 85 : true))} />
              <div className="card">
                <div className="card-h"><Sprout size={14} /> Fruit tree ladder</div>
                {FRUIT.map((t) => <div key={t.key} className={"route" + (t.farm > farming ? " lock" : "")}><span className="rt-name">{t.name} <span className="req">Lv {t.farm}</span></span><span className="rt-tele yld">{fmt(t.xp)} xp</span></div>)}
              </div>
            </>
          )}
        </>
      )}

      <div className="foot"><AlertTriangle size={11} /> Per-herb chance-to-save and tree XP are wiki-pinned; prices are GE mid. Teleport routes are a sensible default, not strictly optimal.</div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
.hv{--bg:#0a0d0b;--p1:#11160f;--p2:#161d14;--p3:#1c2519;--ln:rgba(255,255,255,.07);--ln2:rgba(255,255,255,.13);--tx:#eaf0e8;--mu:#94a394;--fa:#6a7869;--grn:#5fd07f;--grn2:#86e6a0;--gold:#f5c542;--cost:#f0844e;
  font-family:'Sora',system-ui,sans-serif;color:var(--tx);background:var(--bg);min-height:100dvh;padding:0 14px 46px;max-width:720px;margin:0 auto}
.hv *{box-sizing:border-box}
.spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.flip{transform:rotate(180deg)}
.hd{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:16px 2px 13px;background:linear-gradient(180deg,var(--bg) 80%,transparent);backdrop-filter:blur(6px)}
.hd-l{display:flex;align-items:center;gap:9px}.hd-l>svg{color:var(--grn)}
.hd-l h1{font-family:'Cinzel',serif;font-weight:700;font-size:23px;margin:0;color:var(--tx)}
.hd-r{display:flex;align-items:center;gap:9px}
.feed{font-size:11px;font-weight:500;padding:3px 9px;border-radius:20px;border:1px solid var(--ln)}
.feed.live{color:var(--grn);border-color:rgba(95,208,127,.3);background:rgba(95,208,127,.08)}
.feed.warn{color:var(--gold);border-color:rgba(245,197,66,.3);background:rgba(245,197,66,.08)}
.ic,.back{border-radius:9px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);display:grid;place-items:center;cursor:pointer}
.ic{width:32px;height:32px}.back{width:34px;height:34px;margin-right:4px}.back:hover,.ic:hover{color:var(--grn2);border-color:var(--grn)}
.lvls{display:flex;gap:10px;margin-bottom:8px;flex-wrap:wrap}
.lvl-in{flex:1;min-width:180px;display:flex;gap:6px}
.lvl-in input{flex:1;padding:9px 12px;border-radius:10px;border:1px solid var(--ln);background:var(--p1);color:var(--tx);font-size:14px;outline:none}
.lvl-in input:focus{border-color:var(--grn)}.lvl-in input::placeholder{color:var(--fa)}
.lvl-go{padding:0 16px;border-radius:10px;border:1px solid var(--ln);background:var(--p2);color:var(--tx);font-family:'Sora';font-weight:600;font-size:13px;cursor:pointer}
.lvl-go:hover{border-color:var(--grn)}
.lvl-pair{display:flex;gap:8px}
.lvl{display:flex;flex-direction:column;gap:3px}
.lvl span{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mu);font-weight:600;padding-left:2px}
.lvl input{width:64px;padding:8px 10px;border-radius:9px;border:1px solid var(--ln);background:var(--p1);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:15px;text-align:center;outline:none}
.lvl input:focus{border-color:var(--grn)}
.wom{font-size:12px;color:var(--mu);margin-bottom:8px;padding-left:2px}
.tabs{display:flex;gap:7px;margin:10px 0 12px}
.tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border-radius:10px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:13px;font-weight:600;cursor:pointer;transition:.14s}
.tabs button.on{color:var(--grn2);border-color:var(--grn);background:rgba(95,208,127,.08)}
.modes{display:flex;gap:8px;margin-bottom:11px}
.modes button{flex:1;padding:11px;border-radius:11px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:14px;font-weight:600;cursor:pointer;transition:.14s}
.modes button.on{background:linear-gradient(180deg,var(--grn2),var(--grn));color:#0a1f10;border-color:transparent}
.supply-pick{margin-bottom:11px}
.sp-l{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mu);font-weight:600;margin-bottom:7px;padding-left:2px}
.sp-row{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.sp-row::-webkit-scrollbar{display:none}
.sp{flex-shrink:0;padding:7px 13px;border-radius:18px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap}
.sp.on{background:rgba(95,208,127,.14);color:var(--grn2);border-color:var(--grn)}
.kit-toggle{width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:10px 13px;border-radius:11px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:13px;cursor:pointer;margin-bottom:11px}
.kit-toggle svg{margin-left:auto;transition:.18s}
.kit{background:var(--p1);border:1px solid var(--ln);border-radius:13px;padding:14px;margin-bottom:12px;display:flex;flex-direction:column;gap:12px}
.kit-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.kit-row>span{font-size:12.5px;color:var(--mu);font-weight:500}
.seg{display:flex;background:var(--bg);border:1px solid var(--ln);border-radius:9px;padding:3px}
.seg button{padding:6px 11px;border-radius:7px;border:none;background:none;color:var(--mu);font-family:'Sora';font-size:12.5px;font-weight:500;cursor:pointer}
.seg button.on{background:var(--p3);color:var(--grn2)}
.chk{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--tx);cursor:pointer}
.chk.sm{font-size:12.5px;color:var(--mu)}
.box{width:18px;height:18px;border-radius:6px;border:1.5px solid var(--fa);flex-shrink:0;position:relative;transition:.13s}
.box.on{background:var(--grn);border-color:var(--grn)}.box.on::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:9px;border:solid #0a1f10;border-width:0 2px 2px 0;transform:rotate(45deg)}
.kit-sub{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--fa);font-weight:600;padding-top:4px;border-top:1px solid var(--ln)}
.unlock-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.hero{background:linear-gradient(165deg,var(--p2),var(--p1));border:1px solid var(--ln2);border-radius:16px;padding:16px;margin-bottom:12px}
.hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.hero-lbl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--grn);font-weight:700;margin-bottom:5px}
.hero-name{display:block;font-family:'Cinzel',serif;font-size:24px;font-weight:700;line-height:1.1}
.hero-sub{display:block;font-size:12px;color:var(--mu);margin-top:5px}
.hero-fig{text-align:right;flex-shrink:0}
.hero-net{display:block;font-family:'JetBrains Mono',monospace;font-size:25px;font-weight:700;color:var(--gold);line-height:1}
.hero-net.xp{color:var(--grn2)}
.hero-figl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--fa);margin-top:4px}
.warn-line{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gold);margin-top:11px;padding:8px 10px;background:rgba(245,197,66,.07);border:1px solid rgba(245,197,66,.2);border-radius:9px}
.rate-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}
.rate{background:var(--p3);border:1px solid var(--ln);border-radius:11px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.rate.hl{border-color:rgba(245,197,66,.3);background:rgba(245,197,66,.06)}
.rate span{font-size:10.5px;color:var(--mu);font-weight:500;display:flex;align-items:center;gap:4px}
.rate span em{font-style:normal;color:var(--fa);cursor:help}
.rate b{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:600}
.rate.hl b{color:var(--gold)}.rate b.cost{color:var(--cost)}
.rate-note{font-size:12px;line-height:1.5;color:var(--mu);margin-top:11px}.rate-note b{color:var(--tx)}
.rpd{margin-top:13px;display:flex;flex-direction:column;gap:8px}
.rpd span{font-size:12px;color:var(--mu)}.rpd b{color:var(--grn2);font-family:'JetBrains Mono',monospace}
input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:var(--p3);outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--grn);cursor:pointer;box-shadow:0 0 0 4px rgba(95,208,127,.15)}
input[type=range]::-moz-range-thumb{width:18px;height:18px;border:none;border-radius:50%;background:var(--grn);cursor:pointer}
.nextf{background:linear-gradient(180deg,rgba(245,197,66,.05),rgba(245,197,66,.02));border:1px solid rgba(245,197,66,.18);border-radius:12px;padding:12px 13px;margin-bottom:12px}
.nextf-h{display:flex;align-items:center;gap:6px;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--gold);font-weight:700;margin-bottom:8px}
.nextf-row{font-size:12.5px;line-height:1.5;color:var(--mu);margin-top:4px}.nextf-row b{color:var(--tx);font-weight:600}
.supply-out{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--tx);background:rgba(95,208,127,.07);border:1px solid rgba(95,208,127,.2);border-radius:11px;padding:11px 13px;margin-bottom:12px;line-height:1.45}
.supply-out svg{color:var(--grn);flex-shrink:0}.supply-out b{color:var(--grn2)}
.card{background:var(--p1);border:1px solid var(--ln);border-radius:13px;padding:13px 14px;margin-bottom:11px}
.card-h{display:flex;align-items:center;gap:7px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--grn);font-weight:700;margin-bottom:11px}
.shop{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--ln);font-size:13.5px}
.shop:first-of-type{border-top:none}
.shop-n{color:var(--tx)}.shop-q{font-family:'JetBrains Mono',monospace;color:var(--mu);font-size:12.5px}
.shop-t{font-family:'JetBrains Mono',monospace;color:var(--tx);font-weight:600;min-width:56px;text-align:right}
.shop.total{border-top:1px solid var(--ln2);margin-top:3px}.shop.total .shop-n{color:var(--mu);font-size:12px;text-transform:uppercase;letter-spacing:.05em}.shop.total .shop-t{color:var(--gold)}
.bring{font-size:12px;color:var(--mu);margin-top:10px;padding-top:10px;border-top:1px solid var(--ln);line-height:1.45}
.route{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--ln);font-size:13px}
.route:first-of-type{border-top:none}
.route.lock{opacity:.5}
.rt-num{width:20px;height:20px;border-radius:6px;background:var(--p3);border:1px solid var(--ln);display:grid;place-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--grn2);flex-shrink:0}
.rt-name{color:var(--tx);flex:1;display:flex;align-items:center;gap:7px}
.rt-tele{font-size:12px;color:var(--mu);text-align:right}
.rt-tele.yld{font-family:'JetBrains Mono',monospace;color:var(--grn2);font-size:12.5px}
.rt-tele .xpv{color:var(--grn2);font-family:'JetBrains Mono',monospace}
.req{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--fa)}
.cost{color:var(--cost)}
.df{font-size:9px;font-weight:700;color:var(--grn);border:1px solid rgba(95,208,127,.3);border-radius:4px;padding:1px 4px}
.tree-note,.foot{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.5;color:var(--mu)}
.tree-note{background:rgba(95,208,127,.06);border:1px solid rgba(95,208,127,.18);border-radius:11px;padding:11px 13px;margin-bottom:12px}
.tree-note svg{color:var(--grn);flex-shrink:0;margin-top:1px}.tree-note b{color:var(--tx)}
.foot{margin-top:14px;color:var(--fa);font-size:11px}.foot svg{flex-shrink:0;margin-top:1px}
.empty{text-align:center;padding:34px 18px;color:var(--fa);font-size:14px}
@media(max-width:480px){.hero-name{font-size:21px}.hero-net{font-size:22px}.unlock-grid{grid-template-columns:1fr}}
`;
