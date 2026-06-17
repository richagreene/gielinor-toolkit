import React, { useState, useMemo, useEffect } from "react";
import { ArrowLeft, RefreshCw, Coins, Sprout, TreePine, Info, ChevronDown, Leaf, AlertTriangle, Navigation, ArrowUpRight, Clock, Target } from "lucide-react";

/* ============================================================
   Harvest — tree & herb run planner.
   Prices: shared prices.json from the pipeline (item-name → {high,low}).
   Levels: Wise Old Man (manual fallback). Last RSN persists + auto-loads.
   Yield: verified OSRS "harvest lives" model. Per-herb chance-to-save
   values are wiki-pinned (level-1 → 31.6% at level 99 for every herb).
   Tree check-health/plant XP and protection payments are wiki-verified.
   ============================================================ */
const OWNER_REPO = "richagreene/gielinor-toolkit";
const DATA_URL = `https://raw.githubusercontent.com/${OWNER_REPO}/data/prices.json`;
const SAVE_KEY = "harvest.v1";

const LIVES = { none: 3, compost: 4, super: 5, ultra: 6 };
const CTS_HIGH = 0.316;

/* OSRS cumulative XP per level (index = level) */
const XP_TABLE = [0,0,83,174,276,388,512,650,801,969,1154,1358,1584,1833,2107,2411,2746,3115,3523,3973,4470,5018,5624,6291,7028,7842,8740,9730,10824,12031,13363,14833,16456,18247,20224,22406,24815,27473,30408,33648,37224,41171,45529,50339,55649,61512,67983,75127,83014,91721,101333,111945,123660,136594,150872,166636,184040,203254,224466,247886,273742,302288,333804,368599,407015,449428,496254,547953,605032,668051,737627,814445,899257,992895,1096278,1210421,1336443,1475581,1629200,1798808,1986068,2192818,2421087,2673114,2951373,3258594,3597792,3972294,4385776,4842295,5346332,5902831,6517253,7195629,7944614,8771558,9684577,10692629,11805606,13034431];

const HERB_PATCHES = [
  { id: "ardougne",   name: "Ardougne",            unlock: "open",   diary: null,      save: 0,    tele: "Ardougne cloak / Ardy Tele" },
  { id: "catherby",   name: "Catherby",            unlock: "open",   diary: "kandarin",save: 0,    tele: "Catherby tablet / Camelot" },
  { id: "falador",    name: "Falador",             unlock: "open",   diary: null,      save: 0,    tele: "Explorer's ring / Fally Tele" },
  { id: "morytania",  name: "Morytania",           unlock: "open",   diary: null,      save: 0,    tele: "Ectophial" },
  { id: "hosidius",   name: "Hosidius",            unlock: "favour", diary: "kourend", save: 0.05, diseaseFree: true, tele: "Xeric's talisman" },
  { id: "guild65",    name: "Farming Guild",       unlock: "guild65",diary: "kourend", save: 0.05, tele: "Skills necklace / Farm cape" },
  { id: "weiss",      name: "Weiss",               unlock: "quest",  diary: null,      save: 0,    diseaseFree: true, tele: "Icy basalt" },
  { id: "trollheim",  name: "Trollheim",           unlock: "quest",  diary: null,      save: 0,    diseaseFree: true, tele: "Stony basalt" },
  { id: "harmony",    name: "Harmony Island",      unlock: "quest",  diary: null,      save: 0,    tele: "Harmony teleport (POH)" },
  { id: "varlamore",  name: "Civitas illa Fortis", unlock: "quest",  diary: null,      save: 0,    tele: "Civitas Teleport" },
];

const HERBS = [
  { key: "guam",       name: "Guam",        farm: 9,  cts: [0.102, CTS_HIGH], seed: "Guam seed",        herb: "Grimy guam leaf" },
  { key: "marrentill", name: "Marrentill",  farm: 14, cts: [0.113, CTS_HIGH], seed: "Marrentill seed",  herb: "Grimy marrentill" },
  { key: "tarromin",   name: "Tarromin",    farm: 19, cts: [0.125, CTS_HIGH], seed: "Tarromin seed",    herb: "Grimy tarromin" },
  { key: "harralander",name: "Harralander", farm: 26, cts: [0.145, CTS_HIGH], seed: "Harralander seed", herb: "Grimy harralander" },
  { key: "ranarr",     name: "Ranarr",      farm: 32, cts: [0.156, CTS_HIGH], seed: "Ranarr seed",      herb: "Grimy ranarr weed" },
  { key: "toadflax",   name: "Toadflax",    farm: 38, cts: [0.172, CTS_HIGH], seed: "Toadflax seed",    herb: "Grimy toadflax" },
  { key: "irit",       name: "Irit",        farm: 44, cts: [0.184, CTS_HIGH], seed: "Irit seed",        herb: "Grimy irit leaf" },
  { key: "avantoe",    name: "Avantoe",     farm: 50, cts: [0.199, CTS_HIGH], seed: "Avantoe seed",     herb: "Grimy avantoe" },
  { key: "kwuarm",     name: "Kwuarm",      farm: 56, cts: [0.215, CTS_HIGH], seed: "Kwuarm seed",      herb: "Grimy kwuarm" },
  { key: "snapdragon", name: "Snapdragon",  farm: 62, cts: [0.227, CTS_HIGH], seed: "Snapdragon seed",  herb: "Grimy snapdragon" },
  { key: "cadantine",  name: "Cadantine",   farm: 67, cts: [0.238, CTS_HIGH], seed: "Cadantine seed",   herb: "Grimy cadantine" },
  { key: "lantadyme",  name: "Lantadyme",   farm: 73, cts: [0.254, CTS_HIGH], seed: "Lantadyme seed",   herb: "Grimy lantadyme" },
  { key: "dwarf",      name: "Dwarf weed",  farm: 79, cts: [0.266, CTS_HIGH], seed: "Dwarf weed seed",  herb: "Grimy dwarf weed" },
  { key: "torstol",    name: "Torstol",     farm: 85, cts: [0.281, CTS_HIGH], seed: "Torstol seed",     herb: "Grimy torstol" },
];

/* self-supply: only potions actually used. Each maps to the herb you grow + its Herblore req. */
const POTIONS = [
  { key: "prayer",    name: "Prayer",        herb: "ranarr",     hReq: 38 },
  { key: "restore",   name: "Super restore", herb: "snapdragon", hReq: 63 },
  { key: "brew",      name: "Saradomin brew",herb: "toadflax",   hReq: 81 },
  { key: "supercb",   name: "Super combat",  herb: "torstol",    hReq: 90 },
  { key: "superatt",  name: "Super attack",  herb: "irit",       hReq: 45 },
  { key: "superstr",  name: "Super strength",herb: "kwuarm",     hReq: 55 },
  { key: "superdef",  name: "Super defence", herb: "cadantine",  hReq: 66 },
  { key: "stamina",   name: "Stamina",       herb: "avantoe",    hReq: 77, note: "via super energy + amylase" },
  { key: "antifire",  name: "Antifire",      herb: "lantadyme",  hReq: 69 },
  { key: "ranging",   name: "Ranging",       herb: "dwarf",      hReq: 72 },
  { key: "antivenom", name: "Antivenom+",    herb: "irit",       hReq: 87, note: "super antipoison + Zulrah scales" },
];

const TREES = [
  { key: "oak",   name: "Oak",   farm: 15, sapling: "Oak sapling",   xp: 481.3,   protect: { item: "Tomatoes(5)", qty: 1 } },
  { key: "willow",name: "Willow",farm: 30, sapling: "Willow sapling",xp: 1481.5,  protect: { item: "Apples(5)",   qty: 1 } },
  { key: "maple", name: "Maple", farm: 45, sapling: "Maple sapling", xp: 3448.4,  protect: { item: "Oranges(5)",  qty: 1 } },
  { key: "yew",   name: "Yew",   farm: 60, sapling: "Yew sapling",   xp: 7150.9,  protect: { item: "Cactus spine",qty: 10 } },
  { key: "magic", name: "Magic", farm: 75, sapling: "Magic sapling", xp: 13913.8, protect: { item: "Coconut",     qty: 25 } },
];
const HARDWOODS = [
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

const TREE_PATCHES = [
  { name: "Gnome Stronghold", tele: "Spirit tree" }, { name: "Tree Gnome Village", tele: "Spirit tree" },
  { name: "Falador", tele: "Explorer's ring" }, { name: "Taverley", tele: "Games necklace" },
  { name: "Varrock", tele: "Varrock Tele (GE)" }, { name: "Lumbridge", tele: "Lumbridge Tele" },
  { name: "Farming Guild", tele: "Skills necklace", unlock: "guild65" },
];
const HARDWOOD_PATCHES = [{ name: "Fossil Island (W)", tele: "Digsite pendant" }, { name: "Fossil Island (E)", tele: "Digsite pendant" }];
const FRUIT_PATCHES = [
  { name: "Gnome Stronghold", tele: "Spirit tree" }, { name: "Tree Gnome Village", tele: "Spirit tree" },
  { name: "Catherby", tele: "Catherby tablet" }, { name: "Brimhaven", tele: "Charter / Brimhaven" },
  { name: "Lletya", tele: "Teleport crystal" }, { name: "Farming Guild", tele: "Skills necklace", unlock: "guild85" },
];

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
  "cactus spine": { high: 350, low: 320 }, "coconut": { high: 600, low: 560 }, "sweetcorn": { high: 120, low: 100 }, "watermelon": { high: 220, low: 190 }, "pineapple": { high: 90, low: 70 }, "papaya fruit": { high: 280, low: 250 }, "dragonfruit": { high: 600, low: 540 },
};

const fmt = (n) => { if (n == null || isNaN(n)) return "—"; const neg = n < 0, a = Math.abs(n); let s; if (a >= 1e9) s = (a / 1e9).toFixed(2).replace(/\.?0+$/, "") + "b"; else if (a >= 1e6) s = (a / 1e6).toFixed(2).replace(/\.?0+$/, "") + "m"; else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k"; else s = String(Math.round(a)); return (neg ? "−" : "") + s; };
const dur = (mins) => { if (mins == null || !isFinite(mins)) return "—"; if (mins < 90) return `${Math.round(mins)} min`; const h = mins / 60; if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} hr`; const d = h / 24; if (d < 60) return `${d.toFixed(d < 10 ? 1 : 0)} days`; return `${(d / 30).toFixed(1)} mo`; };
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
  for (const p of patches) { const y = herbYield(crop, level, kit, p); herbs += y; cost += seedP + compP; if (priced) revenue += y * (herbP - geTax(herbP)); }
  return { herbs, cost, revenue: priced ? revenue : null, net: priced ? revenue - cost : null, priced, perPatch: patches.length ? herbs / patches.length : 0 };
}
function bestGpHerb(patches, level, kit, map) {
  let best = null;
  for (const h of HERBS.filter((x) => x.farm <= level)) { const r = herbRun(h, patches, level, kit, map); if (r.net == null) continue; if (!best || r.net > best.net) best = { crop: h, ...r }; }
  return best;
}
/* all unlocked species with cost + gp/xp metrics */
function treeOpts(list, level, map, useCompost) {
  return list.filter((t) => t.farm <= level).map((t) => {
    const sap = priceOf(map, t.sapling) ?? 0;
    const prot = useCompost ? (priceOf(map, "ultracompost") ?? 0) : (t.protect ? (priceOf(map, t.protect.item) ?? 0) * t.protect.qty : 0);
    const cost = sap + prot;
    return { ...t, cost, gpxp: cost / t.xp };
  });
}
/* choose a species: manual selection wins if unlocked, else mode default ('xp'=highest xp, 'value'=lowest gp/xp) */
function pickTree(list, level, map, mode, useCompost, sel) {
  const opts = treeOpts(list, level, map, useCompost);
  if (!opts.length) return null;
  if (sel) { const s = opts.find((o) => o.key === sel); if (s) return s; }
  return mode === "value" ? opts.reduce((a, b) => (b.gpxp < a.gpxp ? b : a)) : opts.reduce((a, b) => (b.xp > a.xp ? b : a));
}

export default function Harvest({ onHome }) {
  const [tab, setTab] = useState("herb");
  const [priceMap, setPriceMap] = useState(SAMPLE_PRICES);
  const [sample, setSample] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rsn, setRsn] = useState("");
  const [farming, setFarming] = useState(82);
  const [farmXp, setFarmXp] = useState(XP_TABLE[82]);
  const [herblore, setHerblore] = useState(79);
  const [womNote, setWomNote] = useState("");
  const [mode, setMode] = useState("gp");
  const [supplyTarget, setSupplyTarget] = useState("prayer");
  const [herbRuns, setHerbRuns] = useState(4);
  const [treeRuns, setTreeRuns] = useState(2);
  const [goalFarm, setGoalFarm] = useState(99);
  const [treeMode, setTreeMode] = useState("xp");
  const [fruitMode, setFruitMode] = useState("xp");
  const [regSel, setRegSel] = useState(null);
  const [hardSel, setHardSel] = useState(null);
  const [fruitSel, setFruitSel] = useState(null);
  const [compost, setCompost] = useState("ultra");
  const [secateurs, setSecateurs] = useState(true);
  const [cape, setCape] = useState(false);
  const [attas, setAttas] = useState(false);
  const [kandarin, setKandarin] = useState(0.10);
  const [kourendHard, setKourendHard] = useState(false);
  const [unlocks, setUnlocks] = useState({ favour: true, guild65: true, weiss: false, trollheim: false, harmony: false, varlamore: false });
  const [showKit, setShowKit] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const kit = { compost, secateurs, cape, attas, kandarin, kourendHard };

  const loadPrices = async () => {
    setLoading(true);
    try { const r = await fetch(`${DATA_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" }); if (r.ok) { const d = await r.json(); setPriceMap(d); setSample(false); } } catch (e) {}
    setLoading(false);
  };

  const loadWom = async (name) => {
    const q = (name ?? rsn).trim();
    if (!q) return;
    setWomNote("Loading…");
    try {
      const r = await fetch(`https://api.wiseoldman.net/v2/players/${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const sk = d?.latestSnapshot?.data?.skills || {};
      if (sk.farming?.level) { setFarming(sk.farming.level); setFarmXp(sk.farming.experience ?? XP_TABLE[sk.farming.level]); }
      if (sk.herblore?.level) setHerblore(sk.herblore.level);
      setWomNote(`Loaded ${d.displayName}`);
    } catch (e) { setWomNote("Couldn't find that name — set levels manually below."); }
  };

  // hydrate from localStorage + auto-load last RSN
  useEffect(() => {
    loadPrices();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.rsn) setRsn(s.rsn);
        if (s.farming) { setFarming(s.farming); setFarmXp(s.farmXp ?? XP_TABLE[s.farming]); }
        if (s.herblore) setHerblore(s.herblore);
        if (s.compost) setCompost(s.compost);
        if (typeof s.secateurs === "boolean") setSecateurs(s.secateurs);
        if (typeof s.cape === "boolean") setCape(s.cape);
        if (typeof s.attas === "boolean") setAttas(s.attas);
        if (typeof s.kandarin === "number") setKandarin(s.kandarin);
        if (typeof s.kourendHard === "boolean") setKourendHard(s.kourendHard);
        if (s.unlocks) setUnlocks(s.unlocks);
        if (s.mode) setMode(s.mode);
        if (s.supplyTarget) setSupplyTarget(s.supplyTarget);
        if (s.herbRuns) setHerbRuns(s.herbRuns);
        if (s.treeRuns) setTreeRuns(s.treeRuns);
        if (s.goalFarm) setGoalFarm(s.goalFarm);
        if (s.treeMode) setTreeMode(s.treeMode);
        if (s.fruitMode) setFruitMode(s.fruitMode);
        if (s.rsn) loadWom(s.rsn);
      }
    } catch (e) {}
    setHydrated(true);
  }, []);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ rsn, farming, farmXp, herblore, compost, secateurs, cape, attas, kandarin, kourendHard, unlocks, mode, supplyTarget, herbRuns, treeRuns, goalFarm, treeMode, fruitMode })); } catch (e) {}
  }, [hydrated, rsn, farming, farmXp, herblore, compost, secateurs, cape, attas, kandarin, kourendHard, unlocks, mode, supplyTarget, herbRuns, treeRuns, goalFarm, treeMode, fruitMode]);

  const setFarmLevel = (v) => { const lvl = Math.max(1, Math.min(99, +v || 1)); setFarming(lvl); setFarmXp(XP_TABLE[lvl]); };

  const openHerbPatches = useMemo(() => HERB_PATCHES.filter((p) => {
    if (p.unlock === "open") return true;
    if (p.unlock === "favour") return unlocks.favour;
    if (p.unlock === "guild65") return unlocks.guild65 && farming >= 65;
    if (p.unlock === "quest") return !!unlocks[p.id];
    return true;
  }), [unlocks, farming]);

  const herbTime = useMemo(() => Math.round(openHerbPatches.length * 1.5 + 2), [openHerbPatches]);

  const supplyTargets = useMemo(() => POTIONS.filter((p) => { const h = HERBS.find((x) => x.key === p.herb); return h && h.farm <= farming; }), [farming]);
  useEffect(() => { if (mode === "supply" && !supplyTargets.find((p) => p.key === supplyTarget)) setSupplyTarget(supplyTargets[0]?.key || "prayer"); }, [supplyTargets, mode, supplyTarget]);

  const herbPick = useMemo(() => {
    if (mode === "gp") return bestGpHerb(openHerbPatches, farming, kit, priceMap);
    const pot = POTIONS.find((p) => p.key === supplyTarget) || POTIONS[0];
    const target = HERBS.find((h) => h.key === pot.herb);
    if (!target) return null;
    const r = herbRun(target, openHerbPatches, farming, kit, priceMap);
    return { crop: target, pot, ...r, brewLocked: pot.hReq > herblore };
  }, [mode, supplyTarget, openHerbPatches, farming, herblore, kit, priceMap]);

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
    return { activeGpHr: herbPick.net / (herbTime / 60), gpDay: herbPick.net * herbRuns };
  }, [herbPick, herbTime, herbRuns]);

  const shopping = useMemo(() => {
    if (!herbPick) return [];
    const n = openHerbPatches.length, c = herbPick.crop;
    const items = [{ name: c.seed, qty: n, each: priceOf(priceMap, c.seed) }];
    if (compost !== "none") items.push({ name: "Ultracompost", qty: n, each: priceOf(priceMap, "ultracompost") });
    return items.map((i) => ({ ...i, total: i.each != null ? i.each * i.qty : null }));
  }, [herbPick, openHerbPatches, compost, priceMap]);
  const shopTotal = shopping.reduce((s, i) => s + (i.total || 0), 0);

  const treeRun = useMemo(() => {
    const reg = pickTree(TREES, farming, priceMap, treeMode, false, regSel);
    const hard = pickTree(HARDWOODS, farming, priceMap, treeMode, true, hardSel);
    const red = farming >= REDWOOD.farm ? { ...REDWOOD, cost: (priceOf(priceMap, REDWOOD.sapling) ?? 0) + (priceOf(priceMap, "dragonfruit") ?? 0) * 6 } : null;
    let xp = 0, gp = 0; const lines = []; let stops = 0;
    if (reg) { xp += reg.xp * 6; gp += reg.cost * 6; stops += 6; lines.push({ name: reg.name, n: 6, xp: reg.xp * 6, cost: reg.cost * 6, note: reg.protect ? `${reg.protect.qty}× ${reg.protect.item}` : "" }); }
    if (hard) { xp += hard.xp * 2; gp += hard.cost * 2; stops += 2; lines.push({ name: hard.name, n: 2, xp: hard.xp * 2, cost: hard.cost * 2, note: "ultracompost" }); }
    if (red) { xp += red.xp; gp += red.cost; stops += 1; lines.push({ name: red.name, n: 1, xp: red.xp, cost: red.cost, note: "6× Dragonfruit" }); }
    return { reg, hard, red, xp, gp, lines, stops, timeMin: stops ? Math.round(stops * 0.7 + 2) : 0 };
  }, [farming, priceMap, treeMode, regSel, hardSel]);

  const fruitRun = useMemo(() => {
    const best = pickTree(FRUIT, farming, priceMap, fruitMode, false, fruitSel);
    if (!best) return null;
    return { ...best, n: 6, xp: best.xp * 6, gp: best.cost * 6, stops: 6, timeMin: 6 };
  }, [farming, priceMap, fruitMode, fruitSel]);

  const regOpts = useMemo(() => treeOpts(TREES, farming, priceMap, false), [farming, priceMap]);
  const hardOpts = useMemo(() => treeOpts(HARDWOODS, farming, priceMap, true), [farming, priceMap]);
  const fruitOpts = useMemo(() => treeOpts(FRUIT, farming, priceMap, false), [farming, priceMap]);
  const redOpt = useMemo(() => { if (farming < REDWOOD.farm) return null; const cost = (priceOf(priceMap, REDWOOD.sapling) ?? 0) + (priceOf(priceMap, "dragonfruit") ?? 0) * 6; return { ...REDWOOD, cost, gpxp: cost / REDWOOD.xp }; }, [farming, priceMap]);
  const activeRun = tab === "fruit" ? fruitRun : treeRun;
  const ttl = useMemo(() => {
    if (!activeRun || !activeRun.xp) return null;
    const goalXp = XP_TABLE[Math.min(99, Math.max(2, goalFarm))] ?? 0;
    const need = Math.max(0, goalXp - farmXp);
    if (need <= 0) return { reached: true };
    const perDay = activeRun.xp * treeRuns;
    const totalRuns = need / activeRun.xp;
    return { need, days: need / perDay, activeHrs: (totalRuns * activeRun.timeMin) / 60, perDay };
  }, [activeRun, goalFarm, farmXp, treeRuns]);

  const Route = ({ patches }) => (
    <div className="card">
      <div className="card-h"><Navigation size={13} /> Route &amp; teleports · {patches.length} stops</div>
      {patches.map((p, i) => <div key={p.name + i} className="route"><span className="rt-num">{i + 1}</span><span className="rt-name">{p.name}</span><span className="rt-tele">{p.tele}</span></div>)}
    </div>
  );
  const TimeToLevel = () => ttl && (
    <div className="ttl">
      <div className="ttl-h"><Target size={13} /> Time to level</div>
      <div className="ttl-row">
        <label>Goal lvl</label>
        <input type="number" min="2" max="99" value={goalFarm} onChange={(e) => setGoalFarm(Math.max(2, Math.min(99, +e.target.value || 2)))} />
        <div className="ttl-runs"><span>Runs/day <b>{treeRuns}</b></span><input type="range" min="1" max="4" value={treeRuns} onChange={(e) => setTreeRuns(+e.target.value)} /></div>
      </div>
      {ttl.reached ? <div className="ttl-out">You're already at Farming {goalFarm}+ 🎉</div> :
        <div className="ttl-out"><b className="big">{dur(ttl.days * 24 * 60)}</b><span>to Farming {goalFarm} at {treeRuns}/day · {fmt(ttl.need)} xp to go · ~{ttl.activeHrs.toFixed(1)} hr active total</span></div>}
    </div>
  );
  const Compare = ({ title, mult, list, opts, sel, setSel, chosenKey }) => (
    <div className="card">
      <div className="card-h"><TreePine size={13} /> {title} · ×{mult}<button className={"autop" + (sel ? "" : " on")} onClick={() => setSel(null)}>Auto</button></div>
      {list.map((t) => {
        const o = opts.find((x) => x.key === t.key);
        const isSel = chosenKey === t.key;
        return (
          <button key={t.key} disabled={!o} className={"cmp" + (isSel ? " sel" : "") + (!o ? " lock" : "")} onClick={() => o && setSel(t.key)}>
            <span className="cmp-n">{isSel && <span className="dot" />}{t.name}{!o && <span className="req">Lv {t.farm}</span>}</span>
            {o ? <span className="cmp-s"><b className="xpv">{fmt(o.xp)}</b> xp<span className="sep">·</span><b className="gpxp">{o.gpxp.toFixed(2)}</b> gp/xp<span className="sep">·</span><span className="cost">−{fmt(o.cost)}</span></span>
               : <span className="cmp-s faint">{fmt(t.xp)} xp · locked</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="hv">
      <style>{CSS}</style>
      <header className="hd">
        <div className="hd-l">{onHome && <button className="back" onClick={onHome} title="All tools"><ArrowLeft size={17} /></button>}<Sprout size={18} /><h1>Harvest</h1></div>
        <div className="hd-r">
          <span className={"feed " + (sample ? "warn" : "live")}>{sample ? "Sample" : "Live"}</span>
          <button className="ic" onClick={loadPrices}><RefreshCw size={14} className={loading ? "spin" : ""} /></button>
        </div>
      </header>

      <div className="lvls">
        <div className="lvl-in">
          <input value={rsn} onChange={(e) => setRsn(e.target.value)} placeholder="RuneScape name" onKeyDown={(e) => e.key === "Enter" && loadWom()} />
          <button className="lvl-go" onClick={() => loadWom()}>Load</button>
        </div>
        <div className="lvl-pair">
          <label className="lvl"><span>Farming</span><input type="number" min="1" max="99" value={farming} onChange={(e) => setFarmLevel(e.target.value)} /></label>
          <label className="lvl"><span>Herblore</span><input type="number" min="1" max="99" value={herblore} onChange={(e) => setHerblore(Math.max(1, Math.min(99, +e.target.value || 1)))} /></label>
        </div>
      </div>
      {womNote && <div className="wom">{womNote}</div>}

      <div className="tabs">
        <button className={tab === "herb" ? "on" : ""} onClick={() => setTab("herb")}><Leaf size={14} /> Herb</button>
        <button className={tab === "tree" ? "on" : ""} onClick={() => setTab("tree")}><TreePine size={14} /> Tree</button>
        <button className={tab === "fruit" ? "on" : ""} onClick={() => setTab("fruit")}><Sprout size={14} /> Fruit</button>
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
                <span className="hero-lbl">{mode === "gp" ? "Plant this" : "Growing for " + herbPick.pot.name}</span>
                <div className="hero-main">
                  <span className="hero-name">{herbPick.crop.name}</span>
                  <div className="hero-fig">{herbPick.net != null ? <><span className="hero-net">{fmt(herbPick.net)}</span><span className="hero-figl">net / run</span></> : <span className="hero-figl">price n/a</span>}</div>
                </div>
                <div className="hero-meta"><span><Navigation size={11} /> {openHerbPatches.length} patches</span><span><Clock size={11} /> ~{herbTime} min/run</span><span><Leaf size={11} /> ~{herbPick.perPatch.toFixed(1)} each</span></div>
                {herbPick.brewLocked && <div className="warn-line"><AlertTriangle size={12} /> You can grow it, but {herbPick.pot.name} needs Herblore {herbPick.pot.hReq}.</div>}
                <div className="rate-grid">
                  <div className="rate hl"><span>realistic gp/day</span><b>{fmt(rates ? rates.gpDay : null)}</b></div>
                  <div className="rate"><span>active gp/hr <em title="Value of the minutes you actively spend — not sustainable; crops take ~80 min to regrow.">ⓘ</em></span><b>{fmt(rates ? rates.activeGpHr : null)}</b></div>
                  <div className="rate sm"><span>≈ herbs/run</span><b>{Math.round(herbPick.herbs)}</b></div>
                  <div className="rate sm"><span>seed + compost</span><b className="cost">−{fmt(herbPick.cost)}</b></div>
                </div>
                <div className="rpd"><span>Runs / day <b>{herbRuns}</b></span><input type="range" min="1" max="12" value={herbRuns} onChange={(e) => setHerbRuns(+e.target.value)} /></div>
              </div>

              <div className="nextf">
                <div className="nextf-h"><ArrowUpRight size={13} /> Next focus</div>
                {nextFocus.gpLine && <div className="nextf-row"><b>GP</b> {nextFocus.gpLine}</div>}
                {!nextFocus.next && <div className="nextf-row"><b>GP</b> Every herb unlocked — plant the best-value one above.</div>}
                <div className="nextf-row"><b>XP</b> Highest tier = most Farming/Herblore xp: {nextFocus.highest ? nextFocus.highest.name : "—"} now{nextFocus.next ? `; ${nextFocus.next.name} at Farming ${nextFocus.next.farm}` : ""}.</div>
              </div>

              {mode === "supply" && herbPick.priced && <div className="supply-out"><Leaf size={13} /> One run ≈ <b>{Math.round(herbPick.herbs)}</b> {herbPick.crop.name.toLowerCase()} → ~<b>{Math.round(herbPick.herbs)}</b> {herbPick.pot.name.toLowerCase()}{herbPick.pot.note ? ` (${herbPick.pot.note})` : ""}.</div>}

              <div className="card">
                <div className="card-h"><Coins size={13} /> Buy for one run</div>
                {shopping.map((i) => <div key={i.name} className="shop"><span className="shop-n">{i.name}</span><span className="shop-q">×{i.qty}</span><span className="shop-t">{i.total != null ? fmt(i.total) : "—"}</span></div>)}
                <div className="shop total"><span className="shop-n">Total</span><span /><span className="shop-t">{fmt(shopTotal)}</span></div>
              </div>

              <Route patches={openHerbPatches} />

              <div className="card">
                <div className="card-h"><Leaf size={13} /> Per-patch yield</div>
                {openHerbPatches.map((p) => { const y = herbYield(herbPick.crop, farming, kit, p); return <div key={p.id} className="route"><span className="rt-name">{p.name}{p.diseaseFree && <span className="df">disease-free</span>}</span><span className="rt-tele yld">{y.toFixed(1)}</span></div>; })}
              </div>
            </>
          )}
        </>
      )}

      {(tab === "tree" || tab === "fruit") && (() => {
        const run = tab === "fruit" ? fruitRun : treeRun;
        const m = tab === "fruit" ? fruitMode : treeMode;
        const setM = tab === "fruit" ? setFruitMode : setTreeMode;
        const clearSel = tab === "fruit" ? () => setFruitSel(null) : () => { setRegSel(null); setHardSel(null); };
        const empty = tab === "fruit" ? !fruitRun : treeRun.xp === 0;
        const title = tab === "fruit" ? (fruitRun ? fruitRun.name : "") : [treeRun.reg, treeRun.hard, treeRun.red].filter(Boolean).map((t) => t.name).join(" · ");
        return (
          <>
            <div className="tree-note"><Info size={13} /> {tab === "fruit" ? "Fruit runs are an XP activity — they cost gp and pay Farming xp (~16 h grow, so ~1/day)." : "Tree runs are an XP activity — gp in, Farming xp out. Hardwoods run on ultracompost, no protection."}</div>
            <div className="modes two">
              <button className={m === "xp" ? "on" : ""} onClick={() => { setM("xp"); clearSel(); }}>Most XP</button>
              <button className={m === "value" ? "on" : ""} onClick={() => { setM("value"); clearSel(); }}>Best XP / gp</button>
            </div>

            {empty && <div className="empty">No {tab === "fruit" ? "fruit tree" : "tree"} available at Farming {farming}.</div>}
            {!empty && (
              <>
                <div className="hero">
                  <span className="hero-lbl">{m === "value" ? "Most cost-effective xp" : "Most xp for your level"}</span>
                  <div className="hero-main">
                    <span className="hero-name sm">{title}</span>
                    <div className="hero-fig"><span className="hero-net xp">{fmt(run.xp)}</span><span className="hero-figl">xp / run</span></div>
                  </div>
                  <div className="hero-meta"><span><Navigation size={11} /> {run.stops} stops</span><span><Clock size={11} /> ~{run.timeMin} min/run</span><span><Coins size={11} /> <em className="cost">−{fmt(run.gp)}</em></span></div>
                  <div className="rate-grid">
                    <div className="rate hl"><span>gp / xp</span><b className="cost">−{(run.gp / run.xp).toFixed(2)}</b></div>
                    <div className="rate"><span>xp / run</span><b className="xpv">{fmt(run.xp)}</b></div>
                  </div>
                </div>

                <TimeToLevel />

                <div className="card">
                  <div className="card-h"><TreePine size={13} /> What to plant</div>
                  {(tab === "fruit" ? [{ name: run.name, n: 6, xp: run.xp, cost: run.gp, note: `${run.protect.qty}× ${run.protect.item}` }] : treeRun.lines).map((l) => (
                    <div key={l.name} className="route"><span className="rt-name">{l.name} <span className="req">×{l.n}</span></span><span className="rt-tele"><b className="xpv">{fmt(l.xp)}</b> · <span className="cost">−{fmt(l.cost)}</span> · {l.note}</span></div>
                  ))}
                </div>

                <Route patches={tab === "fruit"
                  ? FRUIT_PATCHES.filter((p) => !p.unlock || (p.unlock === "guild85" ? farming >= 85 : true))
                  : [...TREE_PATCHES.filter((p) => !p.unlock || (p.unlock === "guild65" ? (unlocks.guild65 && farming >= 65) : true)), ...HARDWOOD_PATCHES, ...(treeRun.red ? [{ name: "Farming Guild (redwood)", tele: "Skills necklace / Farm cape" }] : [])]} />

                <div className="cmp-hint">Tap any unlocked tree to plant it yourself — “Auto” re-optimizes for the mode above.</div>
                {tab === "fruit"
                  ? <Compare title="Fruit patches" mult={6} list={FRUIT} opts={fruitOpts} sel={fruitSel} setSel={setFruitSel} chosenKey={fruitRun && fruitRun.key} />
                  : <>
                      <Compare title="Regular tree patches" mult={6} list={TREES} opts={regOpts} sel={regSel} setSel={setRegSel} chosenKey={treeRun.reg && treeRun.reg.key} />
                      <Compare title="Hardwood patches" mult={2} list={HARDWOODS} opts={hardOpts} sel={hardSel} setSel={setHardSel} chosenKey={treeRun.hard && treeRun.hard.key} />
                      {redOpt && <div className="rednote"><span className="dot" />Redwood ×1 auto-included at 90 · <b className="xpv">{fmt(redOpt.xp)}</b> xp · <b className="gpxp">{redOpt.gpxp.toFixed(2)}</b> gp/xp</div>}
                    </>}
              </>
            )}
          </>
        );
      })()}

      <div className="foot"><AlertTriangle size={11} /> Per-herb chance-to-save &amp; tree xp are wiki-pinned; prices are GE mid. Run times &amp; routes are sensible estimates, not strictly optimal.</div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
.hv{--bg:#0a0d0b;--p1:#11160f;--p2:#161d14;--p3:#1c2519;--ln:rgba(255,255,255,.07);--ln2:rgba(255,255,255,.13);--tx:#eaf0e8;--mu:#94a394;--fa:#6a7869;--grn:#5fd07f;--grn2:#86e6a0;--gold:#f5c542;--cost:#f0844e;
  font-family:'Sora',system-ui,sans-serif;color:var(--tx);background:var(--bg);min-height:100dvh;padding:0 calc(13px + env(safe-area-inset-right,0px)) calc(46px + env(safe-area-inset-bottom,0px)) calc(13px + env(safe-area-inset-left,0px));max-width:720px;margin:0 auto}
.hv *{box-sizing:border-box}
.spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.flip{transform:rotate(180deg)}
.hd{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:calc(14px + env(safe-area-inset-top,0px)) 2px 11px;background:linear-gradient(180deg,var(--bg) 88%,transparent);backdrop-filter:blur(6px)}
.hd-l{display:flex;align-items:center;gap:8px;min-width:0}.hd-l>svg{color:var(--grn);flex-shrink:0}
.hd-l h1{font-family:'Cinzel',serif;font-weight:700;font-size:21px;margin:0;color:var(--tx);white-space:nowrap}
.hd-r{display:flex;align-items:center;gap:8px;flex-shrink:0}
.feed{font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:20px;border:1px solid var(--ln);white-space:nowrap}
.feed.live{color:var(--grn);border-color:rgba(95,208,127,.3);background:rgba(95,208,127,.08)}
.feed.warn{color:var(--gold);border-color:rgba(245,197,66,.3);background:rgba(245,197,66,.08)}
.ic,.back{border-radius:9px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.ic{width:31px;height:31px}.back{width:33px;height:33px}.back:hover,.ic:hover{color:var(--grn2);border-color:var(--grn)}
/* levels: RSN full row, then two equal boxes side-by-side */
.lvls{display:flex;flex-direction:column;gap:8px;margin-bottom:8px}
.lvl-in{display:flex;gap:6px}
.lvl-in input{flex:1;min-width:0;padding:9px 12px;border-radius:10px;border:1px solid var(--ln);background:var(--p1);color:var(--tx);font-size:14px;outline:none}
.lvl-in input:focus{border-color:var(--grn)}.lvl-in input::placeholder{color:var(--fa)}
.lvl-go{flex-shrink:0;padding:0 18px;border-radius:10px;border:1px solid var(--ln);background:var(--p2);color:var(--tx);font-family:'Sora';font-weight:600;font-size:13px;cursor:pointer}
.lvl-go:hover{border-color:var(--grn)}
.lvl-pair{display:flex;gap:8px}
.lvl{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.lvl span{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mu);font-weight:700;padding-left:2px}
.lvl input{width:100%;padding:8px 10px;border-radius:9px;border:1px solid var(--ln);background:var(--p1);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:15px;text-align:center;outline:none}
.lvl input:focus{border-color:var(--grn)}
.wom{font-size:12px;color:var(--mu);margin-bottom:8px;padding-left:2px}
.tabs{display:flex;gap:7px;margin:10px 0 12px}
.tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border-radius:10px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:13px;font-weight:600;cursor:pointer;transition:.14s}
.tabs button.on{color:var(--grn2);border-color:var(--grn);background:rgba(95,208,127,.08)}
.modes{display:flex;gap:8px;margin-bottom:11px}.modes.two{margin-bottom:12px}
.modes button{flex:1;padding:11px;border-radius:11px;border:1px solid var(--ln);background:var(--p1);color:var(--mu);font-family:'Sora';font-size:13.5px;font-weight:600;cursor:pointer;transition:.14s}
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
/* hero — the actionable headline */
.hero{background:linear-gradient(165deg,var(--p2),var(--p1));border:1px solid var(--ln2);border-radius:16px;padding:15px 16px;margin-bottom:12px}
.hero-lbl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--grn);font-weight:700;margin-bottom:7px}
.hero-main{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.hero-name{font-family:'Cinzel',serif;font-size:27px;font-weight:700;line-height:1.05}
.hero-name.sm{font-size:18px;line-height:1.2}
.hero-fig{text-align:right;flex-shrink:0;white-space:nowrap}
.hero-net{font-family:'JetBrains Mono',monospace;font-size:27px;font-weight:700;color:var(--gold);line-height:1}
.hero-net.xp{color:var(--grn2)}
.hero-figl{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--fa);margin-top:3px}
.hero-meta{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:11px;font-size:12px;color:var(--mu)}
.hero-meta span{display:inline-flex;align-items:center;gap:5px}.hero-meta svg{color:var(--fa)}.hero-meta em{font-style:normal}
.warn-line{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gold);margin-top:11px;padding:8px 10px;background:rgba(245,197,66,.07);border:1px solid rgba(245,197,66,.2);border-radius:9px}
.rate-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}
.rate{background:var(--p3);border:1px solid var(--ln);border-radius:11px;padding:9px 12px;display:flex;flex-direction:column;gap:3px}
.rate.hl{border-color:rgba(245,197,66,.32);background:rgba(245,197,66,.07)}
.rate.sm{padding:8px 11px}
.rate span{font-size:10px;color:var(--mu);font-weight:500;display:flex;align-items:center;gap:4px}
.rate span em{font-style:normal;color:var(--fa);cursor:help}
.rate b{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700}
.rate.sm b{font-size:15px;font-weight:600}
.rate.hl b{color:var(--gold);font-size:20px}.rate b.cost{color:var(--cost)}.rate b.xpv{color:var(--grn2)}
.rpd{margin-top:13px;display:flex;flex-direction:column;gap:7px}
.rpd span{font-size:12px;color:var(--mu)}.rpd b{color:var(--grn2);font-family:'JetBrains Mono',monospace}
input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:var(--p3);outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--grn);cursor:pointer;box-shadow:0 0 0 4px rgba(95,208,127,.15)}
input[type=range]::-moz-range-thumb{width:18px;height:18px;border:none;border-radius:50%;background:var(--grn);cursor:pointer}
/* time-to-level */
.ttl{background:linear-gradient(165deg,rgba(95,208,127,.08),rgba(95,208,127,.03));border:1px solid rgba(95,208,127,.22);border-radius:14px;padding:13px 14px;margin-bottom:12px}
.ttl-h{display:flex;align-items:center;gap:6px;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--grn);font-weight:700;margin-bottom:11px}
.ttl-row{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
.ttl-row>label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--mu);font-weight:600;display:flex;flex-direction:column;gap:4px}
.ttl-row input[type=number]{width:62px;padding:7px 8px;border-radius:8px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:14px;text-align:center;outline:none;margin-top:4px}
.ttl-row input[type=number]:focus{border-color:var(--grn)}
.ttl-runs{flex:1;min-width:130px;display:flex;flex-direction:column;gap:7px}
.ttl-runs span{font-size:11.5px;color:var(--mu)}.ttl-runs b{color:var(--grn2);font-family:'JetBrains Mono',monospace}
.ttl-out{margin-top:13px;padding-top:12px;border-top:1px solid var(--ln);display:flex;flex-direction:column;gap:4px}
.ttl-out .big{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;color:var(--grn2);line-height:1}
.ttl-out span{font-size:12px;color:var(--mu);line-height:1.45}
.nextf{background:linear-gradient(180deg,rgba(245,197,66,.05),rgba(245,197,66,.02));border:1px solid rgba(245,197,66,.18);border-radius:12px;padding:12px 13px;margin-bottom:12px}
.nextf-h{display:flex;align-items:center;gap:6px;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--gold);font-weight:700;margin-bottom:8px}
.nextf-row{font-size:12.5px;line-height:1.5;color:var(--mu);margin-top:5px}
.nextf-row b{display:inline-block;min-width:24px;color:var(--gold);font-weight:700;font-size:10px}
.supply-out{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--tx);background:rgba(95,208,127,.07);border:1px solid rgba(95,208,127,.2);border-radius:11px;padding:11px 13px;margin-bottom:12px;line-height:1.45}
.supply-out svg{color:var(--grn);flex-shrink:0}.supply-out b{color:var(--grn2)}
.card{background:var(--p1);border:1px solid var(--ln);border-radius:13px;padding:12px 14px;margin-bottom:11px}
.card-h{display:flex;align-items:center;gap:7px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--grn);font-weight:700;margin-bottom:10px}
.shop{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--ln);font-size:13.5px}
.shop:first-of-type{border-top:none}
.shop-n{color:var(--tx)}.shop-q{font-family:'JetBrains Mono',monospace;color:var(--mu);font-size:12.5px}
.shop-t{font-family:'JetBrains Mono',monospace;color:var(--tx);font-weight:600;min-width:54px;text-align:right}
.shop.total{border-top:1px solid var(--ln2);margin-top:2px}.shop.total .shop-n{color:var(--mu);font-size:12px;text-transform:uppercase;letter-spacing:.05em}.shop.total .shop-t{color:var(--gold)}
.route{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--ln);font-size:13px}
.route:first-of-type{border-top:none}
.route.lock{opacity:.45}
.rt-num{width:19px;height:19px;border-radius:6px;background:var(--p3);border:1px solid var(--ln);display:grid;place-items:center;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--grn2);flex-shrink:0}
.rt-name{color:var(--tx);flex:1;display:flex;align-items:center;gap:7px;min-width:0}
.rt-tele{font-size:11.5px;color:var(--mu);text-align:right;flex-shrink:0}
.rt-tele.yld{font-family:'JetBrains Mono',monospace;color:var(--grn2);font-size:13px}
.rt-tele .xpv{color:var(--grn2);font-family:'JetBrains Mono',monospace;font-weight:600}
.req{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--fa)}
.cost{color:var(--cost)}
.df{font-size:9px;font-weight:700;color:var(--grn);border:1px solid rgba(95,208,127,.3);border-radius:4px;padding:1px 4px}
.tree-note,.foot{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.5;color:var(--mu)}
.tree-note{background:rgba(95,208,127,.06);border:1px solid rgba(95,208,127,.18);border-radius:11px;padding:11px 13px;margin-bottom:12px}
.tree-note svg{color:var(--grn);flex-shrink:0;margin-top:1px}
.foot{margin-top:14px;color:var(--fa);font-size:11px}.foot svg{flex-shrink:0;margin-top:1px}
.empty{text-align:center;padding:34px 18px;color:var(--fa);font-size:14px}
.autop{margin-left:auto;font-family:'Sora';font-size:10px;font-weight:600;text-transform:none;letter-spacing:0;padding:3px 10px;border-radius:14px;border:1px solid var(--ln);background:var(--bg);color:var(--fa);cursor:pointer}
.autop.on{color:var(--grn2);border-color:var(--grn);background:rgba(95,208,127,.1)}
.cmp-hint{font-size:11.5px;color:var(--fa);margin:-2px 2px 9px;line-height:1.4}
.cmp{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 2px;border:none;border-top:1px solid var(--ln);background:none;cursor:pointer;text-align:left;font-family:'Sora'}
.cmp:first-of-type{border-top:none}
.cmp.lock{opacity:.42;cursor:default}
.cmp.sel{background:rgba(95,208,127,.07);margin:0 -14px;padding:9px 14px}
.cmp-n{color:var(--tx);font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:7px;flex-shrink:0}
.cmp.sel .cmp-n{color:var(--grn2)}
.dot{width:6px;height:6px;border-radius:50%;background:var(--grn);flex-shrink:0}
.cmp-s{font-size:11.5px;color:var(--mu);white-space:nowrap;font-family:'JetBrains Mono',monospace;text-align:right}
.cmp-s b{font-weight:700}.cmp-s .xpv{color:var(--grn2)}.cmp-s .gpxp{color:var(--gold)}
.cmp-s.faint{color:var(--fa)}
.sep{margin:0 5px;color:var(--fa)}
.rednote{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--mu);padding:10px 14px;background:var(--p1);border:1px solid var(--ln);border-radius:11px;margin-bottom:11px;font-family:'JetBrains Mono',monospace}
.rednote b{font-weight:700}.rednote .xpv{color:var(--grn2)}.rednote .gpxp{color:var(--gold)}
@media(max-width:430px){.hd-l h1{font-size:18px}.hero-name{font-size:23px}.hero-net{font-size:23px}.unlock-grid{grid-template-columns:1fr}}
`;
