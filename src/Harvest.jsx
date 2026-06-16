import React, { useState, useMemo, useEffect } from "react";
import { ArrowLeft, RefreshCw, Coins, Sprout, TreePine, Info, Check, ChevronDown, Leaf, AlertTriangle } from "lucide-react";

/* ============================================================
   Harvest — tree & herb run planner.
   Prices: shared prices.json from the pipeline (item-name → {high,low}).
   Levels: Wise Old Man (manual fallback).
   Yield: verified OSRS "harvest lives" model (see herbYield()).
   NOTE: crop constants (Farming reqs, tree XP, protection items) are
   seeded from the wiki and marked // VERIFY — refine at leisure; the
   engine and live pricing are correct regardless.
   ============================================================ */
const OWNER_REPO = "richagreene/gielinor-toolkit";
const DATA_URL = `https://raw.githubusercontent.com/${OWNER_REPO}/data/prices.json`;

/* ---------- yield model constants (verified) ---------- */
const LIVES = { none: 3, compost: 4, super: 5, ultra: 6 };   // harvest lives by compost tier
// chance-to-save scales linearly L1→L99. Representative herb curve (irit, wiki-verified).
// Per-herb low/high can override via crop.cts = [low, high]; otherwise this default is used.
const CTS_DEFAULT = [0.184, 0.316];

/* ---------- herb patches (unlock = how you get access) ---------- */
const HERB_PATCHES = [
  { id: "catherby",   name: "Catherby",        unlock: "open",   diary: "kandarin", save: 0 },
  { id: "ardougne",   name: "Ardougne",        unlock: "open",   diary: null,       save: 0 },
  { id: "falador",    name: "Falador",         unlock: "open",   diary: null,       save: 0 },
  { id: "morytania",  name: "Morytania",       unlock: "open",   diary: null,       save: 0 },
  { id: "hosidius",   name: "Hosidius",        unlock: "favour", diary: "kourend",  save: 0.05, diseaseFree: true },
  { id: "guild",      name: "Farming Guild",   unlock: "guild65",diary: "kourend",  save: 0.05 },
  { id: "weiss",      name: "Weiss",           unlock: "quest",  diary: null,       save: 0, diseaseFree: true },
  { id: "trollheim",  name: "Trollheim",       unlock: "quest",  diary: null,       save: 0, diseaseFree: true },
  { id: "harmony",    name: "Harmony Island",  unlock: "quest",  diary: null,       save: 0 },
  { id: "varlamore",  name: "Civitas illa Fortis", unlock: "quest", diary: null,    save: 0 },   // VERIFY
];

/* ---------- herbs (seed/grimy names must match GE; potion = self-supply target) ---------- */
const HERBS = [
  { key: "guam",       name: "Guam",        farm: 9,  seed: "Guam seed",        herb: "Grimy guam leaf",       potion: { key: "attack",  name: "Attack potion",  herb: 1 } },
  { key: "marrentill", name: "Marrentill",  farm: 14, seed: "Marrentill seed",  herb: "Grimy marrentill",      potion: { key: "antipoison", name: "Antipoison",  herb: 5 } },
  { key: "tarromin",   name: "Tarromin",    farm: 19, seed: "Tarromin seed",    herb: "Grimy tarromin",        potion: { key: "strength", name: "Strength potion", herb: 12 } },
  { key: "harralander",name: "Harralander", farm: 26, seed: "Harralander seed", herb: "Grimy harralander",     potion: { key: "energy", name: "Energy potion", herb: 26 } },
  { key: "ranarr",     name: "Ranarr",      farm: 32, seed: "Ranarr seed",      herb: "Grimy ranarr weed",     potion: { key: "prayer", name: "Prayer potion", herb: 38 } },
  { key: "toadflax",   name: "Toadflax",    farm: 38, seed: "Toadflax seed",    herb: "Grimy toadflax",        potion: { key: "brew",   name: "Saradomin brew", herb: 81 } },
  { key: "irit",       name: "Irit",        farm: 44, seed: "Irit seed",        herb: "Grimy irit leaf",       potion: { key: "superatt", name: "Super attack", herb: 45 }, cts: [0.184, 0.316] },
  { key: "avantoe",    name: "Avantoe",     farm: 50, seed: "Avantoe seed",     herb: "Grimy avantoe",         potion: { key: "energy2", name: "Super energy", herb: 52 } },
  { key: "kwuarm",     name: "Kwuarm",      farm: 56, seed: "Kwuarm seed",      herb: "Grimy kwuarm",          potion: { key: "superstr", name: "Super strength", herb: 55 } },
  { key: "snapdragon", name: "Snapdragon",  farm: 62, seed: "Snapdragon seed",  herb: "Grimy snapdragon",      potion: { key: "restore", name: "Super restore", herb: 63 } },
  { key: "cadantine",  name: "Cadantine",   farm: 67, seed: "Cadantine seed",   herb: "Grimy cadantine",       potion: { key: "superdef", name: "Super defence", herb: 66 } },
  { key: "lantadyme",  name: "Lantadyme",   farm: 73, seed: "Lantadyme seed",   herb: "Grimy lantadyme",       potion: { key: "antifire", name: "Antifire potion", herb: 69 } },
  { key: "dwarf",      name: "Dwarf weed",  farm: 79, seed: "Dwarf weed seed",  herb: "Grimy dwarf weed",      potion: { key: "ranging", name: "Ranging potion", herb: 72 } },
  { key: "torstol",    name: "Torstol",     farm: 85, seed: "Torstol seed",     herb: "Grimy torstol",         potion: { key: "supercb", name: "Super combat", herb: 90 } },
];

/* ---------- trees & fruit trees (XP-positive, gp-negative). XP/protection // VERIFY ---------- */
const TREES = [
  { key: "oak",   name: "Oak",   farm: 15, sapling: "Oak sapling",   xp: 481.3,   protect: { item: "Tomatoes(5)",    qty: 1 } },
  { key: "willow",name: "Willow",farm: 30, sapling: "Willow sapling",xp: 1481.5,  protect: { item: "Apples(5)",      qty: 1 } },
  { key: "maple", name: "Maple", farm: 45, sapling: "Maple sapling", xp: 3448.4,  protect: { item: "Oranges(5)",     qty: 1 } },
  { key: "yew",   name: "Yew",   farm: 60, sapling: "Yew sapling",   xp: 7150.9,  protect: { item: "Cactus spine",   qty: 10 } },
  { key: "magic", name: "Magic", farm: 75, sapling: "Magic sapling", xp: 13913.8, protect: { item: "Coconut",        qty: 25 } },
];
const FRUIT = [
  { key: "apple",     name: "Apple",      farm: 27, sapling: "Apple sapling",      xp: 1272.5,  protect: { item: "Sweetcorn",        qty: 9 } },
  { key: "banana",    name: "Banana",     farm: 33, sapling: "Banana sapling",     xp: 1841.5,  protect: { item: "Apples(5)",        qty: 4 } },
  { key: "orange",    name: "Orange",     farm: 39, sapling: "Orange sapling",     xp: 2586.7,  protect: { item: "Strawberries(5)",  qty: 3 } },
  { key: "curry",     name: "Curry",      farm: 42, sapling: "Curry sapling",      xp: 2946.9,  protect: { item: "Bananas(5)",       qty: 5 } },
  { key: "pineapple", name: "Pineapple",  farm: 51, sapling: "Pineapple sapling",  xp: 4791.7,  protect: { item: "Watermelon",       qty: 10 } },
  { key: "papaya",    name: "Papaya",     farm: 57, sapling: "Papaya sapling",     xp: 6380.4,  protect: { item: "Pineapple",        qty: 10 } },
  { key: "palm",      name: "Palm",       farm: 68, sapling: "Palm sapling",       xp: 10509.6, protect: { item: "Papaya fruit",     qty: 15 } },
  { key: "dragon",    name: "Dragonfruit",farm: 81, sapling: "Dragonfruit sapling",xp: 17895,   protect: { item: "Dragonfruit",      qty: 15 } },
];
const N_TREE_PATCHES = 6;   // Lumby, Varrock, Falador, Taverley, Gnome Stronghold, Farming Guild
const N_FRUIT_PATCHES = 6;  // Catherby, Brimhaven, Gnome Village, Gnome Stronghold, Lletya, Farming Guild

/* ---------- sample prices for offline preview (live overrides) ---------- */
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
  "tomatoes(5)": { high: 400, low: 350 }, "apples(5)": { high: 500, low: 420 }, "oranges(5)": { high: 700, low: 600 }, "cactus spine": { high: 350, low: 320 }, "coconut": { high: 600, low: 560 },
};

/* ---------- helpers ---------- */
const fmt = (n) => { if (n == null || isNaN(n)) return "—"; const neg = n < 0, a = Math.abs(n); let s; if (a >= 1e9) s = (a / 1e9).toFixed(2).replace(/\.?0+$/, "") + "b"; else if (a >= 1e6) s = (a / 1e6).toFixed(2).replace(/\.?0+$/, "") + "m"; else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k"; else s = String(Math.round(a)); return (neg ? "−" : "") + s; };
const geTax = (p) => (p < 50 ? 0 : Math.min(Math.floor(p * 0.02), 5_000_000));

function priceOf(map, name) {
  const e = map[String(name).toLowerCase()];
  if (!e) return null;
  if (e.high != null && e.low != null) return (e.high + e.low) / 2;
  return e.high ?? e.low ?? null;
}

/* expected grimy herbs from one patch — the verified harvest-lives model */
function herbYield(crop, level, kit, patch) {
  const lives = LIVES[kit.compost] ?? 3;
  const [lo, hi] = crop.cts || CTS_DEFAULT;
  let cts = lo + (hi - lo) * (Math.min(99, Math.max(1, level)) - 1) / 98;
  if (kit.secateurs) cts += 0.10;
  if (kit.cape) cts += 0.05;
  if (kit.attas) cts += 0.05;
  if (patch?.save) cts += patch.save;                       // Hosidius / Guild inherent +5%
  if (patch?.diary === "kandarin" && kit.kandarin) cts += kit.kandarin;   // 0.05/0.10/0.15
  if (patch?.diary === "kourend" && kit.kourendHard) cts += 0.05;
  cts = Math.min(0.95, Math.max(0, cts));
  return lives / (1 - cts);
}

/* net gp for planting `crop` across the given open patches */
function herbRun(crop, patches, level, kit, map) {
  const seedP = priceOf(map, crop.seed) ?? 0;
  const compP = kit.compost === "none" ? 0 : (priceOf(map, "ultracompost") ?? 0);
  const herbP = priceOf(map, crop.herb);
  let herbs = 0, cost = 0, revenue = 0, priced = herbP != null;
  for (const p of patches) {
    const y = herbYield(crop, level, kit, p);
    herbs += y;
    cost += seedP + compP;
    if (priced) revenue += y * (herbP - geTax(herbP));
  }
  return { herbs, cost, revenue: priced ? revenue : null, net: priced ? revenue - cost : null, priced, perPatch: patches.length ? herbs / patches.length : 0 };
}

function bestGpHerb(patches, level, kit, map) {
  const elig = HERBS.filter((h) => h.farm <= level);
  let best = null;
  for (const h of elig) {
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

  const [mode, setMode] = useState("gp");           // gp | supply
  const [supplyTarget, setSupplyTarget] = useState("prayer");
  const [runsPerDay, setRunsPerDay] = useState(4);

  const [compost, setCompost] = useState("ultra");
  const [secateurs, setSecateurs] = useState(true);
  const [cape, setCape] = useState(false);
  const [attas, setAttas] = useState(false);
  const [kandarin, setKandarin] = useState(0.10);
  const [kourendHard, setKourendHard] = useState(false);
  const [unlocks, setUnlocks] = useState({ hosidius: true, guild65: true, weiss: false, trollheim: false, harmony: false, varlamore: false, favour: true, quest: false });
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

  // open herb patches for this account
  const openHerbPatches = useMemo(() => HERB_PATCHES.filter((p) => {
    if (p.unlock === "open") return true;
    if (p.unlock === "favour") return unlocks.favour;
    if (p.unlock === "guild65") return unlocks.guild65 && farming >= 65;
    if (p.unlock === "quest") return !!unlocks[p.id];
    return true;
  }), [unlocks, farming]);

  // herb selection per mode
  const herbPick = useMemo(() => {
    if (mode === "gp") return bestGpHerb(openHerbPatches, farming, kit, priceMap);
    const target = HERBS.find((h) => h.potion.key === supplyTarget);
    if (!target) return null;
    const r = herbRun(target, openHerbPatches, farming, kit, priceMap);
    return { crop: target, ...r, locked: target.farm > farming, brewLocked: target.potion.herb > herblore };
  }, [mode, supplyTarget, openHerbPatches, farming, herblore, kit, priceMap]);

  // run-level rate figures
  const rates = useMemo(() => {
    if (!herbPick || herbPick.net == null) return null;
    const patches = openHerbPatches.length;
    const activeMin = Math.round(patches * 2.5 + 5);             // travel + plant + harvest estimate
    const activeGpHr = herbPick.net / (activeMin / 60);
    return { activeMin, activeGpHr, gpDay: herbPick.net * runsPerDay };
  }, [herbPick, openHerbPatches, runsPerDay]);

  // shopping list
  const shopping = useMemo(() => {
    if (!herbPick) return [];
    const n = openHerbPatches.length, c = herbPick.crop;
    const items = [{ name: c.seed, qty: n, each: priceOf(priceMap, c.seed) }];
    if (compost !== "none") items.push({ name: "Ultracompost", qty: n, each: priceOf(priceMap, "ultracompost") });
    return items.map((i) => ({ ...i, total: i.each != null ? i.each * i.qty : null }));
  }, [herbPick, openHerbPatches, compost, priceMap]);
  const shopTotal = shopping.reduce((s, i) => s + (i.total || 0), 0);

  // tree recommendation
  const treeRec = useMemo(() => {
    const list = (tab === "fruit" ? FRUIT : TREES).filter((t) => t.farm <= farming);
    const best = list.length ? list[list.length - 1] : null;   // highest-XP affordable by level
    if (!best) return null;
    const n = tab === "fruit" ? N_FRUIT_PATCHES : N_TREE_PATCHES;
    const sap = priceOf(priceMap, best.sapling) ?? 0;
    const prot = (priceOf(priceMap, best.protect.item) ?? 0) * best.protect.qty;
    return { ...best, n, costRun: (sap + prot) * n, xpRun: best.xp * n };
  }, [tab, farming, priceMap]);

  const supplyTargets = HERBS.filter((h) => h.farm <= farming).map((h) => h.potion);

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
        <button className={tab === "fruit" ? "on" : ""} onClick={() => setTab("fruit")}><Sprout size={14} /> Fruit trees</button>
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
              <div className="sp-row">
                {supplyTargets.map((p) => <button key={p.key} className={"sp" + (supplyTarget === p.key ? " on" : "")} onClick={() => setSupplyTarget(p.key)}>{p.name}</button>)}
              </div>
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

          {!herbPick && <div className="empty">No herb is available at Farming {farming}. Level up or check your unlocks.</div>}

          {herbPick && (
            <>
              <div className="hero">
                <div className="hero-top">
                  <div className="hero-herb">
                    <span className="hero-lbl">{mode === "gp" ? "Best herb to plant" : "Growing for " + (HERBS.find(h => h.potion.key === supplyTarget)?.potion.name)}</span>
                    <span className="hero-name">{herbPick.crop.name}</span>
                    <span className="hero-sub">{openHerbPatches.length} open patch{openHerbPatches.length !== 1 ? "es" : ""} · ~{herbPick.perPatch.toFixed(1)} herbs each</span>
                  </div>
                  <div className="hero-fig">
                    {herbPick.net != null ? <><span className="hero-net">{fmt(herbPick.net)}</span><span className="hero-figl">net / run</span></> : <span className="hero-figl">price unavailable</span>}
                  </div>
                </div>
                {(herbPick.locked || herbPick.brewLocked) && <div className="warn-line"><AlertTriangle size={12} /> {herbPick.locked ? `Needs Farming ${herbPick.crop.farm}.` : ""} {herbPick.brewLocked ? `You can grow it, but ${herbPick.crop.potion.name} needs Herblore ${herbPick.crop.potion.herb}.` : ""}</div>}

                <div className="rate-grid">
                  <div className="rate"><span>≈ herbs / run</span><b>{Math.round(herbPick.herbs)}</b></div>
                  <div className="rate"><span>seed + compost</span><b>{fmt(herbPick.cost)}</b></div>
                  {rates && <div className="rate hl"><span>active gp/hr <em title="Efficiency of the minutes you spend — NOT sustainable income, since crops take ~80 min to regrow.">ⓘ</em></span><b>{fmt(rates.activeGpHr)}</b></div>}
                  {rates && <div className="rate"><span>realistic gp/day</span><b>{fmt(rates.gpDay)}</b></div>}
                </div>
                {rates && <div className="rate-note">Active gp/hr is the value of the ~{rates.activeMin} min you actively spend — you can't chain runs, so the honest number is <b>{fmt(rates.gpDay)}/day</b> at {runsPerDay} runs/day.</div>}
                <div className="rpd"><span>Runs / day: <b>{runsPerDay}</b></span><input type="range" min="1" max="12" value={runsPerDay} onChange={(e) => setRunsPerDay(+e.target.value)} /></div>
              </div>

              {mode === "supply" && herbPick.priced && (
                <div className="supply-out"><Leaf size={13} /> One run yields ~<b>{Math.round(herbPick.herbs)}</b> {herbPick.crop.name.toLowerCase()} → ~<b>{Math.round(herbPick.herbs)}</b> {herbPick.crop.potion.name.toLowerCase()}{herbPick.crop.potion.name.endsWith("n") ? "s" : "s"} (1 herb ≈ 1 potion).</div>
              )}

              <div className="card">
                <div className="card-h"><Coins size={14} /> Shopping list — {openHerbPatches.length} patches</div>
                {shopping.map((i) => <div key={i.name} className="shop"><span className="shop-n">{i.name}</span><span className="shop-q">×{i.qty}</span><span className="shop-t">{i.total != null ? fmt(i.total) : "—"}</span></div>)}
                <div className="shop total"><span className="shop-n">Total to buy</span><span /><span className="shop-t">{fmt(shopTotal)}</span></div>
                <div className="bring">Bring: seed dibber, spade, {secateurs ? "magic secateurs, " : ""}{compost !== "none" ? "ultracompost, " : ""}teleports for your route.</div>
              </div>

              <div className="card">
                <div className="card-h"><Leaf size={14} /> Per-patch yield</div>
                {openHerbPatches.map((p) => {
                  const y = herbYield(herbPick.crop, farming, kit, p);
                  return <div key={p.id} className="patch"><span className="patch-n">{p.name}{p.diseaseFree && <span className="df">disease-free</span>}{p.diary && (p.diary === "kandarin" ? kandarin > 0 : kourendHard) && <span className="bonus">+yield</span>}</span><span className="patch-y">{y.toFixed(1)} herbs</span></div>;
                })}
              </div>
            </>
          )}
        </>
      )}

      {(tab === "tree" || tab === "fruit") && (
        <>
          <div className="tree-note"><Info size={13} /> {tab === "fruit" ? "Fruit" : "Tree"} runs are an <b>XP</b> activity — they cost gp and pay Farming experience toward max, not profit.</div>
          {!treeRec && <div className="empty">No {tab === "fruit" ? "fruit tree" : "tree"} available at Farming {farming}.</div>}
          {treeRec && (
            <>
              <div className="hero">
                <div className="hero-top">
                  <div className="hero-herb">
                    <span className="hero-lbl">Best {tab === "fruit" ? "fruit tree" : "tree"} for XP at your level</span>
                    <span className="hero-name">{treeRec.name}</span>
                    <span className="hero-sub">{treeRec.n} patches</span>
                  </div>
                  <div className="hero-fig"><span className="hero-net xp">{fmt(treeRec.xpRun)}</span><span className="hero-figl">XP / run</span></div>
                </div>
                <div className="rate-grid">
                  <div className="rate"><span>XP each (check-health)</span><b>{fmt(treeRec.xp)}</b></div>
                  <div className="rate"><span>gp cost / run</span><b className="cost">−{fmt(treeRec.costRun)}</b></div>
                </div>
                <div className="rate-note">Trees take hours to grow, so this is ~once-a-day XP. Cost is saplings + protection payments at live prices.</div>
              </div>
              <div className="card">
                <div className="card-h"><Coins size={14} /> Per-patch cost</div>
                <div className="shop"><span className="shop-n">{treeRec.sapling}</span><span className="shop-q">×{treeRec.n}</span><span className="shop-t">{fmt((priceOf(priceMap, treeRec.sapling) ?? 0) * treeRec.n)}</span></div>
                <div className="shop"><span className="shop-n">{treeRec.protect.item} (protection)</span><span className="shop-q">×{treeRec.protect.qty * treeRec.n}</span><span className="shop-t">{fmt((priceOf(priceMap, treeRec.protect.item) ?? 0) * treeRec.protect.qty * treeRec.n)}</span></div>
                <div className="shop total"><span className="shop-n">Total cost</span><span /><span className="shop-t cost">−{fmt(treeRec.costRun)}</span></div>
              </div>
              <div className="card">
                <div className="card-h"><TreePine size={14} /> {tab === "fruit" ? "Fruit tree" : "Tree"} ladder</div>
                {(tab === "fruit" ? FRUIT : TREES).map((t) => <div key={t.key} className={"patch" + (t.farm > farming ? " lock" : "")}><span className="patch-n">{t.name} <span className="req">Lv {t.farm}</span></span><span className="patch-y">{fmt(t.xp)} xp</span></div>)}
              </div>
            </>
          )}
        </>
      )}

      <div className="foot"><AlertTriangle size={11} /> Yields use the harvest-lives model; prices are GE mid. Crop reqs and tree XP are seeded from the wiki — treat as close estimates.</div>
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
.tabs button svg{opacity:.8}
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
.hero-name{display:block;font-family:'Cinzel',serif;font-size:25px;font-weight:700;line-height:1}
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
.rate.hl b{color:var(--gold)}
.rate b.cost{color:var(--cost)}
.rate-note{font-size:12px;line-height:1.5;color:var(--mu);margin-top:11px}.rate-note b{color:var(--tx)}
.rpd{margin-top:13px;display:flex;flex-direction:column;gap:8px}
.rpd span{font-size:12px;color:var(--mu)}.rpd b{color:var(--grn2);font-family:'JetBrains Mono',monospace}
input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:var(--p3);outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--grn);cursor:pointer;box-shadow:0 0 0 4px rgba(95,208,127,.15)}
input[type=range]::-moz-range-thumb{width:18px;height:18px;border:none;border-radius:50%;background:var(--grn);cursor:pointer}

.supply-out{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--tx);background:rgba(95,208,127,.07);border:1px solid rgba(95,208,127,.2);border-radius:11px;padding:11px 13px;margin-bottom:12px;line-height:1.45}
.supply-out svg{color:var(--grn);flex-shrink:0}.supply-out b{color:var(--grn2)}

.card{background:var(--p1);border:1px solid var(--ln);border-radius:13px;padding:13px 14px;margin-bottom:11px}
.card-h{display:flex;align-items:center;gap:7px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--grn);font-weight:700;margin-bottom:11px}
.shop,.patch{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--ln);font-size:13.5px}
.shop:first-of-type,.patch:first-of-type{border-top:none}
.shop-n{color:var(--tx)}.shop-q{font-family:'JetBrains Mono',monospace;color:var(--mu);font-size:12.5px}
.shop-t{font-family:'JetBrains Mono',monospace;color:var(--tx);font-weight:600;min-width:60px;text-align:right}
.shop-t.cost{color:var(--cost)}
.shop.total{border-top:1px solid var(--ln2);margin-top:3px;font-weight:600}.shop.total .shop-n{color:var(--mu);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.shop.total .shop-t{color:var(--gold)}
.bring{font-size:12px;color:var(--mu);margin-top:10px;padding-top:10px;border-top:1px solid var(--ln);line-height:1.45}
.patch-n{color:var(--tx);display:flex;align-items:center;gap:7px}
.patch.lock .patch-n{color:var(--fa)}
.patch-y{font-family:'JetBrains Mono',monospace;color:var(--grn2);font-size:13px}
.patch.lock .patch-y{color:var(--fa)}
.req{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--fa)}
.df{font-size:9px;font-weight:700;color:var(--grn);border:1px solid rgba(95,208,127,.3);border-radius:4px;padding:1px 4px}
.bonus{font-size:9px;font-weight:700;color:var(--gold);border:1px solid rgba(245,197,66,.3);border-radius:4px;padding:1px 4px}

.tree-note,.foot{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.5;color:var(--mu)}
.tree-note{background:rgba(95,208,127,.06);border:1px solid rgba(95,208,127,.18);border-radius:11px;padding:11px 13px;margin-bottom:12px}
.tree-note svg{color:var(--grn);flex-shrink:0;margin-top:1px}.tree-note b{color:var(--tx)}
.foot{margin-top:14px;color:var(--fa);font-size:11px}.foot svg{flex-shrink:0;margin-top:1px}
.empty{text-align:center;padding:34px 18px;color:var(--fa);font-size:14px}

@media(max-width:480px){.rate-grid{grid-template-columns:1fr 1fr}.hero-name{font-size:22px}.hero-net{font-size:22px}.unlock-grid{grid-template-columns:1fr}}
`;
