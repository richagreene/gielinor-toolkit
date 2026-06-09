import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Compass, Search, RefreshCw, Shield, Swords, Crown, Users, Target, Lock, Check, X,
  ChevronRight, Award, Star, Sparkles, Backpack, Scroll, AlertTriangle, Flame, Gem,
  Trophy, Activity, TrendingUp, Heart, ListChecks, Zap, ArrowLeft
} from "lucide-react";

/* =============================== helpers =============================== */
const fmtNum = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function usePersistent(key, initial) {
  const [val, setVal] = useState(initial);
  const ready = useRef(false);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.storage) {
          const r = await window.storage.get(key);
          if (!dead && r && r.value != null) setVal(JSON.parse(r.value));
        } else if (typeof window !== "undefined" && window.localStorage) {
          const raw = window.localStorage.getItem(key);
          if (!dead && raw != null) setVal(JSON.parse(raw));
        }
      } catch (e) {}
      finally { ready.current = true; }
    })();
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    if (!ready.current) return;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.storage) await window.storage.set(key, JSON.stringify(val));
        else if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {}
    })();
  }, [val]);
  return [val, setVal];
}

/* skills in in-game panel order: {womKey, label, combat} */
const SKILLS = [
  ["attack", "Attack", 1], ["hitpoints", "Hitpoints", 1], ["mining", "Mining", 0],
  ["strength", "Strength", 1], ["agility", "Agility", 0], ["smithing", "Smithing", 0],
  ["defence", "Defence", 1], ["herblore", "Herblore", 0], ["fishing", "Fishing", 0],
  ["ranged", "Ranged", 1], ["thieving", "Thieving", 0], ["cooking", "Cooking", 0],
  ["prayer", "Prayer", 1], ["crafting", "Crafting", 0], ["firemaking", "Firemaking", 0],
  ["magic", "Magic", 1], ["fletching", "Fletching", 0], ["woodcutting", "Woodcutting", 0],
  ["runecrafting", "Runecraft", 0], ["slayer", "Slayer", 0], ["farming", "Farming", 0],
  ["construction", "Construction", 0], ["hunter", "Hunter", 0],
];
const SKILL_LABEL = Object.fromEntries(SKILLS.map(([k, l]) => [k, l]));

/* =============================== content: bosses =============================== */
const BOSSES = [
  {
    id: "barrows", name: "Barrows", cat: "Early", order: 1, womKey: "barrows_chests",
    skills: { prayer: 43 }, quests: ["Priest in Peril"],
    access: "Morytania access (Priest in Peril). Magic helps clear the tunnels.",
    reward: "Barrows armour & weapons (Dharok's, Ahrim's, Karil's, Verac's…), runes — a backbone of early ironman gear and gp.",
    gear: "Any solid combat setup, plus Magic (bolt spells / Iban's) for the tunnels and a few Prayer levels.",
    supplies: ["Prayer potions", "Food (monkfish / sharks)", "Teleport runes"],
    tips: "Cheap, fast, and repeatable. Build a Barrows teleport habit — it funds a lot of early progression.",
  },
  {
    id: "firecape", name: "Fight Caves (Fire Cape)", cat: "Mid", order: 2, womKey: "tztok_jad",
    skills: { ranged: 70, prayer: 43, defence: 43 }, quests: [],
    access: "TzHaar Fight Cave. Protect from Missiles (43 Prayer) is essential for Jad.",
    reward: "Fire cape — best melee/ranged cape before the Infernal, and a prerequisite for several tasks and the Inferno.",
    gear: "Ranged: the best crossbow you can obtain with suitable bolts (or a blowpipe), defensive armour, Prayer for Jad.",
    supplies: ["Prayer potions", "Ranging potions", "Food (sharks)", "A Saradomin brew or two"],
    tips: "Learn Jad's switches — mage prayer on the magic attack, range prayer on the range attack. 70 ranged + 43 prayer makes this very doable.",
  },
  {
    id: "zulrah", name: "Zulrah", cat: "Mid", order: 3, womKey: "zulrah",
    skills: { ranged: 75, magic: 75, prayer: 43, defence: 70 }, quests: ["Regicide"],
    access: "Zul-Andra (Regicide). Antivenom+ is non-negotiable.",
    reward: "Tanzanite/magic fang (Toxic blowpipe, Trident upgrades), serpentine helm, scales — a huge ironman gp and ranged/mage power spike.",
    gear: "Ideal: Toxic blowpipe + Trident, but build up to it. Starter: Rune crossbow + a magic staff, swapping overhead prayers.",
    supplies: ["Prayer potions", "Antivenom+", "Food", "Ranging & Magic potions"],
    tips: "Memorise the rotations (there are only a few). One of the defining ironman power spikes.",
  },
  {
    id: "vorkath", name: "Vorkath", cat: "Mid", order: 4, womKey: "vorkath",
    skills: { attack: 80, strength: 80, ranged: 80, defence: 80, prayer: 43 }, quests: ["Dragon Slayer II"],
    access: "Requires Dragon Slayer II. Extended antifire is essential.",
    reward: "Superior dragon bones (fast Prayer XP), draconic visage, dragonbone necklace — excellent gp and Prayer training.",
    gear: "Ranged (crossbow + Dragonfire ward, or Dragon hunter crossbow) or melee (Dragon hunter lance). Always bring antifire.",
    supplies: ["Extended antifire", "Prayer potions", "Food", "Divine/super combat or ranging potions", "Antivenom+"],
    tips: "After DS2, the best all-round ironman boss for money, prayer, and a clean kill loop.",
  },
  {
    id: "bandos", name: "God Wars — Bandos", cat: "Late", order: 5, womKey: "general_graardor",
    skills: { strength: 70, attack: 70, defence: 70, prayer: 43 }, quests: [],
    access: "GWD entry shortcuts + 70 Strength for the Bandos stronghold. Build killcount to enter the boss room.",
    reward: "Bandos chestplate & tassets (top-tier melee armour), Godsword shards, pet.",
    gear: "Best melee you have, Prayer for protection, and a plan for the minions.",
    supplies: ["Prayer potions", "Food", "Games necklaces (quick escape)"],
    tips: "Each GWD god has its own 70-skill gate and killcount. Bandos armour is a long-lasting ironman melee staple.",
  },
  {
    id: "gauntlet", name: "The Gauntlet", cat: "Late", order: 6, womKey: "the_gauntlet",
    skills: { attack: 70, strength: 70, ranged: 70, magic: 70, mining: 70, fishing: 70, cooking: 70, smithing: 70, farming: 70, herblore: 70 }, quests: ["Song of the Elves"],
    access: "Requires Song of the Elves. Self-contained: you gather and craft your gear inside each run.",
    reward: "Crystal armour seeds → Crystal armour, and the Enhanced crystal weapon seed → Bow of Faerdhinen / Blade — a defining ironman ranged milestone.",
    gear: "Built inside the prep phase. Strong, even skilling levels make the prep loop much faster.",
    supplies: ["Mostly self-contained — bring food for the boss and learn the prep route"],
    tips: "Corrupted Gauntlet is much harder but drops the best rewards. The bowfa grind is iconic ironman.",
  },
  {
    id: "cerberus", name: "Cerberus", cat: "Late", order: 7, womKey: "cerberus",
    skills: { slayer: 91, attack: 80, strength: 80, defence: 70, prayer: 43 }, quests: [],
    access: "91 Slayer. Watch the summoned souls and the lava pools.",
    reward: "Primordial / Pegasian / Eternal crystals → best-in-slot boots for every style.",
    gear: "Melee or ranged; flick the attack-style prayers. Spec weapons speed up kills.",
    supplies: ["Prayer potions", "Food", "Antidote / antipoison", "Stamina potions"],
    tips: "Locked behind 91 Slayer. The boots are a long-term BIS upgrade across all three styles.",
  },
  {
    id: "hydra", name: "Alchemical Hydra", cat: "Late", order: 8, womKey: "alchemical_hydra",
    skills: { slayer: 95, ranged: 80, defence: 70, prayer: 43 }, quests: [],
    access: "95 Slayer. Reached via the Karuulm Slayer Dungeon (boots of stone or an Agility shortcut).",
    reward: "Hydra's claw, hydra leather (Ferocious gloves — BIS melee gloves), Brimstone ring pieces, strong gp.",
    gear: "Ranged (crossbow + suitable bolts). Learn the phase and style switches and dodge the poison.",
    supplies: ["Prayer potions", "Food", "Antivenom+", "Stamina potions"],
    tips: "Locked behind 95 Slayer. Ferocious gloves are a top melee glove upgrade.",
  },
  {
    id: "toa", name: "Tombs of Amascut", cat: "Endgame", order: 9, womKey: "tombs_of_amascut",
    skills: { attack: 75, strength: 75, ranged: 75, magic: 75, defence: 70, prayer: 55 }, quests: ["Beneath Cursed Sands"],
    access: "Area access via Beneath Cursed Sands. Difficulty scales with invocation level — start low.",
    reward: "Tumeken's shadow, Masori armour, Lightbearer, Osmumten's fang, Elidinis' ward — BIS, and scalable so it's reachable early.",
    gear: "Scales to you — begin at low invocations. Osmumten's fang is a fantastic early reward and a great all-rounder.",
    supplies: ["Prayer potions / restores", "Food", "Stamina potions"],
    tips: "The most ironman-friendly raid thanks to scaling. Great solo, and an excellent group activity with your team.",
  },
  {
    id: "cox", name: "Chambers of Xeric", cat: "Endgame", order: 10, womKey: "chambers_of_xeric",
    skills: { attack: 80, strength: 80, ranged: 80, magic: 80, defence: 80, herblore: 78, farming: 70, prayer: 70 }, quests: [],
    access: "No quest gate, but solo scaling rewards high combat AND skilling levels.",
    reward: "Twisted bow, Kodai insignia, Dragon hunter crossbow, Ancestral, prayer scrolls — the endgame BIS chest.",
    gear: "Best available across all styles. Make overloads and Xeric's aid inside (Herblore).",
    supplies: ["Prayer / restore potions", "Food", "Stamina potions", "Herblore secondaries for in-raid potions"],
    tips: "A long-term solo ironman goal. High skilling levels make solos dramatically smoother.",
  },
  {
    id: "tob", name: "Theatre of Blood", cat: "Endgame", order: 11, womKey: "theatre_of_blood",
    skills: { attack: 85, strength: 85, ranged: 85, magic: 85, defence: 80, prayer: 77 }, quests: [],
    access: "Team raid — a natural fit for Group Ironman. High gear and prayer expected.",
    reward: "Scythe of Vitur, Ghrazi rapier, Sanguinesti staff, Justiciar armour, Avernic defender — BIS melee/mage.",
    gear: "Top-tier gear and prayer across styles. Coordinate roles with your group.",
    supplies: ["Prayer / restore potions", "Food (brews / anglerfish)", "Stamina potions"],
    tips: "Run it with your group — the Avernic defender and the megarares are huge for everyone.",
  },
  {
    id: "inferno", name: "Inferno (Infernal Cape)", cat: "Endgame", order: 12, womKey: "tzkal_zuk",
    skills: { ranged: 85, hitpoints: 85, prayer: 74, defence: 70 }, quests: [],
    access: "Requires a Fire cape (Fight Caves complete). One of the hardest achievements in the game.",
    reward: "Infernal cape — best-in-slot melee/ranged cape and a true endgame trophy.",
    gear: "Best ranged + Prayer + defensive switches, with deep supply and prayer management.",
    supplies: ["Prayer potions", "Saradomin brews / super restores", "Ranging potions"],
    tips: "Practice the waves on a simulator first. A long-term goal — earn it once and wear it forever.",
  },
  {
    id: "scurrius", name: "Scurrius", cat: "Early", order: 13, womKey: "scurrius",
    skills: { attack: 50, strength: 50, defence: 40 }, quests: [],
    access: "The Ratacombs beneath Varrock or Lumbridge. A great first real boss, solo or with the group.",
    reward: "Scurrius' spine (a strong early weapon upgrade), good combat XP, and supplies.",
    gear: "Any decent melee or ranged; pray against the squeak attack and dodge the falling debris.",
    supplies: ["Food", "Prayer potions"],
    tips: "An ideal low-level milestone — accessible, fast, and group-friendly.",
  },
  {
    id: "kbd", name: "King Black Dragon", cat: "Mid", order: 14, womKey: "king_black_dragon",
    skills: { ranged: 70, defence: 60, prayer: 43 }, quests: [],
    access: "KBD Lair, reached through the Wilderness — bring only what you can lose. Antifire is essential.",
    reward: "Dragon drops, KBD heads, fast Prayer XP, and the Prince Black Dragon pet — an accessible solo dragon.",
    gear: "Ranged or melee with an antifire shield; Protect from Magic helps with the dragonfire.",
    supplies: ["Extended antifire", "Prayer potions", "Food"],
    tips: "Light Wilderness — antifire is non-negotiable. A reliable, low-pressure dragon boss.",
  },
  {
    id: "dks", name: "Dagannoth Kings", cat: "Mid", order: 15, womKey: "dagannoth_rex",
    skills: { ranged: 70, magic: 70, attack: 70, strength: 70, defence: 70, prayer: 43 }, quests: [],
    access: "Waterbirth Island dungeon. Three kings of different combat styles share the room.",
    reward: "Berserker, Archer, Seers and Warrior rings — a core ironman ring source — plus the Dragon axe.",
    gear: "Bring all three styles, or world-hop to fight one king at a time. The rings are the prize.",
    supplies: ["Prayer potions", "Food", "Gear for all three styles"],
    tips: "The ring source for ironmen. Solo one king per world, or fight all three at once with practice.",
  },
  {
    id: "sarachnis", name: "Sarachnis", cat: "Mid", order: 16, womKey: "sarachnis",
    skills: { attack: 70, strength: 70, defence: 60, prayer: 43 }, quests: [],
    access: "Forthos Dungeon in Great Kourend. Fast kills with generous supply drops.",
    reward: "Sarachnis cudgel (a strong budget crush weapon), the jar, and bountiful seed and supply drops.",
    gear: "Melee with a crush weapon; she hits hard but dies quickly.",
    supplies: ["Prayer potions", "Food", "Antipoison"],
    tips: "Quietly one of the best mid-game ironman bosses for seeds, herbs, and supplies.",
  },
  {
    id: "kq", name: "Kalphite Queen", cat: "Mid", order: 17, womKey: "kalphite_queen",
    skills: { ranged: 75, attack: 75, strength: 75, defence: 70, prayer: 43 }, quests: [],
    access: "Kalphite Lair in the Desert — a rope and pickaxe get you to the bottom chamber.",
    reward: "Dragon chainbody, Dragon 2h sword, the Kalphite Queen head (Slayer helm upgrade), and the jar.",
    gear: "Two phases of different styles — Range the first, melee or range the second. Protect prayers help.",
    supplies: ["Prayer potions", "Food", "Both ranged and melee gear"],
    tips: "Switch styles between phases; the KQ head is a Slayer helmet upgrade.",
  },
  {
    id: "grotesque", name: "Grotesque Guardians", cat: "Mid", order: 18, womKey: "grotesque_guardians",
    skills: { slayer: 75, attack: 75, defence: 70, prayer: 43 }, quests: [],
    access: "75 Slayer and a granite hammer; fought on the Slayer Tower roof, ideally on a Gargoyle task.",
    reward: "Granite gloves, ring and hammer, the black tourmaline core (for the Brimstone ring), and pets.",
    gear: "Melee; manage Dusk and Dawn's phases and avoid the falling rocks and orbs.",
    supplies: ["Prayer potions", "Food"],
    tips: "Locked behind 75 Slayer and the granite hammer — a tidy mid-game upgrade source.",
  },
  {
    id: "kraken", name: "Kraken", cat: "Mid", order: 19, womKey: "kraken",
    skills: { slayer: 87, magic: 75, defence: 60 }, quests: [],
    access: "87 Slayer; the Kraken Cove. Near-AFK once you've learned it.",
    reward: "Trident of the seas, the Kraken tentacle (→ Abyssal tentacle), and the Kraken pet.",
    gear: "Magic — a Trident or other powered staff. Minimal supplies needed.",
    supplies: ["Food", "A powered staff", "A few prayer potions"],
    tips: "Locked behind 87 Slayer; superb near-AFK Magic XP and a trident source.",
  },
  {
    id: "sire", name: "Abyssal Sire", cat: "Late", order: 20, womKey: "abyssal_sire",
    skills: { slayer: 85, attack: 80, strength: 80, defence: 70, prayer: 43 }, quests: [],
    access: "85 Slayer; the Abyssal Nexus. Learn the four-phase fight and the poison.",
    reward: "Abyssal whip and dagger, plus the Unsired → Abyssal bludgeon, dart, or the Abyssal orphan pet.",
    gear: "Melee with some Magic for the spawns; antivenom and good positioning matter.",
    supplies: ["Prayer potions", "Food", "Antivenom+"],
    tips: "Locked behind 85 Slayer; the ironman source for the whip and the bludgeon.",
  },
  {
    id: "thermy", name: "Thermonuclear Smoke Devil", cat: "Late", order: 21, womKey: "thermonuclear_smoke_devil",
    skills: { slayer: 93, ranged: 75, defence: 60, prayer: 43 }, quests: [],
    access: "93 Slayer; the Smoke Devil Dungeon. A dwarf multicannon helps clear the adds.",
    reward: "Occult necklace (a major Magic damage boost), the Smoke battlestaff, and the pet.",
    gear: "Ranged; bring a cannon if you have one, and Protect from Melee at close range.",
    supplies: ["Prayer potions", "Food", "Cannon + cannonballs (optional)"],
    tips: "Locked behind 93 Slayer; the occult necklace is a defining Magic upgrade.",
  },
  {
    id: "armadyl", name: "God Wars — Armadyl", cat: "Late", order: 22, womKey: "kreearra",
    skills: { ranged: 70, defence: 70, prayer: 43 }, quests: [],
    access: "GWD; 70 Ranged to enter Armadyl's eyrie. Build killcount to face Kree'arra.",
    reward: "Armadyl armour (best-in-slot ranged armour) and Godsword shards.",
    gear: "Ranged only — Kree'arra and the minions are best handled at distance. Protect from Missiles.",
    supplies: ["Prayer potions", "Food", "Ranging potions"],
    tips: "70 Ranged gate; armadyl armour is a long-term ranged BiS set.",
  },
  {
    id: "sara", name: "God Wars — Saradomin", cat: "Late", order: 23, womKey: "commander_zilyana",
    skills: { agility: 70, attack: 75, strength: 75, defence: 70, prayer: 43 }, quests: [],
    access: "GWD; 70 Agility to enter Saradomin's encampment. Build killcount to face Zilyana.",
    reward: "Saradomin sword, the Armadyl crossbow, and Godsword shards.",
    gear: "Melee the boss with ranged backup; protection prayers and brews smooth it out.",
    supplies: ["Prayer potions", "Saradomin brews", "Food"],
    tips: "70 Agility gate; the Saradomin sword and ACB are strong ironman upgrades.",
  },
  {
    id: "zamorak", name: "God Wars — Zamorak", cat: "Late", order: 24, womKey: "kril_tsutsaroth",
    skills: { hitpoints: 70, attack: 75, strength: 75, defence: 70, prayer: 43 }, quests: [],
    access: "GWD; 70 Hitpoints to enter Zamorak's fortress. Build killcount to face K'ril Tsutsaroth.",
    reward: "Staff of the dead, the Zamorakian spear, and Godsword shards.",
    gear: "Melee with Protect from Melee; strong Magic defence helps against K'ril's special.",
    supplies: ["Prayer potions", "Food"],
    tips: "70 Hitpoints gate; the staff of the dead and zamorakian spear are excellent.",
  },
  {
    id: "zalcano", name: "Zalcano", cat: "Late", order: 25, womKey: "zalcano",
    skills: { mining: 70, smithing: 70, attack: 70, defence: 60, prayer: 43, runecrafting: 60 }, quests: ["Song of the Elves"],
    access: "Prifddinas (Song of the Elves). A skilling-and-combat hybrid boss.",
    reward: "Crystal tool seed, crystal shards, Smithing and Mining XP, soft clay packs, and the Smolcano pet.",
    gear: "A pickaxe plus light combat gear — it's part skilling, part fighting.",
    supplies: ["Food", "A pickaxe", "Stamina potions"],
    tips: "Behind Song of the Elves; a steady source of crystal tool seeds and shards.",
  },
  {
    id: "muspah", name: "Phantom Muspah", cat: "Late", order: 26, womKey: "phantom_muspah",
    skills: { ranged: 80, magic: 80, defence: 75, prayer: 74 }, quests: ["Secrets of the North"],
    access: "Requires Secrets of the North. The fight rotates between Ranged, Magic and Melee phases.",
    reward: "Ancient sceptre (Ancient Magicks boost), the Venator shard (→ Venator bow), and charged ice.",
    gear: "Bring Ranged and Magic and swap with its phases; prayer-flick the attacks.",
    supplies: ["Prayer potions", "Food", "Stamina potions"],
    tips: "Behind Secrets of the North; the venator bow and ancient sceptre are strong upgrades.",
  },
  {
    id: "nightmare", name: "The Nightmare", cat: "Endgame", order: 27, womKey: "nightmare",
    skills: { attack: 85, strength: 85, ranged: 85, magic: 85, defence: 80, prayer: 77 }, quests: [],
    access: "Sisterhood Sanctuary in Morytania. Best in a team; Phosani's is the solo-only variant.",
    reward: "Inquisitor's armour, the Nightmare staff, and the Harmonised, Volatile and Eldritch orbs — top melee and magic gear.",
    gear: "Top melee or magic with high Prayer; learn the attack patterns and the totem phase.",
    supplies: ["Prayer / restore potions", "Food (brews)", "Stamina potions"],
    tips: "Great group content for your team; Phosani's solo is a serious endgame challenge.",
  },
  {
    id: "dt2", name: "Desert Treasure II bosses", cat: "Endgame", order: 28, womKey: "vardorvis",
    skills: { attack: 85, strength: 85, ranged: 85, magic: 85, defence: 80, prayer: 74 }, quests: ["Desert Treasure II - The Fallen Empire"],
    access: "The four awakened bosses — Vardorvis, Duke Sucellus, the Leviathan and the Whisperer. Vardorvis is the friendliest start.",
    reward: "Virtus robes, the Ancient rings (Ultor, Bellator, Magus, Venator), Awakener's orbs, and Soulreaper axe pieces — endgame BiS.",
    gear: "Each boss favours different styles; high stats and steady Prayer throughout. Begin with Vardorvis.",
    supplies: ["Prayer / restore potions", "Food", "Stamina potions"],
    tips: "Behind Desert Treasure II; the Ancient rings and Virtus are major endgame upgrades.",
  },
  {
    id: "colosseum", name: "Fortis Colosseum", cat: "Endgame", order: 29, womKey: "sol_heredit",
    skills: { ranged: 85, hitpoints: 90, defence: 80, prayer: 77 }, quests: [],
    access: "Varlamore. Twelve escalating waves ending with Sol Heredit — ranged-heavy and demanding.",
    reward: "Dizana's quiver (ranged ammo storage and a strong cape), Sunfire fanatic armour, and Echo crystals.",
    gear: "Best ranged plus Prayer and defensive switches, with careful supply management across the waves.",
    supplies: ["Prayer potions", "Saradomin brews / restores", "Ranging potions"],
    tips: "An endgame ranged gauntlet; Dizana's quiver is the headline reward.",
  },
  {
    id: "corp", name: "Corporeal Beast", cat: "Endgame", order: 30, womKey: "corporeal_beast",
    skills: { attack: 85, strength: 85, defence: 80, magic: 80, hitpoints: 85, prayer: 70 }, quests: [],
    access: "Found in its lair beneath the Wilderness — notoriously tanky, and far faster with a team.",
    reward: "Elysian, Spectral and Arcane sigils (best-in-slot shields; Spectral for Prayer), Holy elixir, pet.",
    gear: "Crush/stab spec weapons that bypass its high defence (crystal halberd, BGS); Protect from Magic.",
    supplies: ["Prayer / restore potions", "Saradomin brews / food", "Super combat for specs"],
    tips: "A perfect Group Ironman target — split kills with your team to make the sigils realistic.",
  },
  {
    id: "moons", name: "Moons of Peril", cat: "Mid", order: 31, womKey: "lunar_chests",
    skills: { attack: 70, strength: 70, ranged: 70, magic: 70, defence: 70, prayer: 43 }, quests: ["Perilous Moons"],
    access: "Neypotzli, Varlamore (Perilous Moons quest). Rotate through the Blue, Blood and Eclipse moon bosses.",
    reward: "Blue/Blood/Eclipse moon armour and weapons (Dual macuahuitl, Blood moon spear, Eclipse atlatl) — superb mid-game ironman gear.",
    gear: "All three styles across the fights; the armour you earn here upgrades you as you go.",
    supplies: ["Prayer potions", "Food", "Stamina potions"],
    tips: "One of the best mid-game ironman armour and weapon sources, and it scales gently.",
  },
  {
    id: "wildy", name: "Wilderness Bosses", cat: "Late", order: 32, womKey: "callisto",
    skills: { attack: 80, strength: 80, ranged: 80, defence: 70, prayer: 43 }, quests: [],
    access: "Callisto, Vet'ion and Venenatis (plus the easier Artio, Calvar'ion and Spindel) — in the Wilderness, so expect PKers.",
    reward: "Voidwaker pieces (a top-tier special-attack weapon), Ring of the gods, Treasonous/Tyrannical rings, fangs and claws, pets.",
    gear: "Anti-PK setup — bring only what you can lose, a teleport, and gear for the boss's style.",
    supplies: ["Prayer potions", "Food", "Teleport to escape", "Anti-PK switch (optional)"],
    tips: "The Voidwaker is the headline — one piece drops from each of the three bosses. Watch for PKers.",
  },
  {
    id: "araxxor", name: "Araxxor", cat: "Endgame", order: 33, womKey: "araxxor",
    skills: { attack: 85, strength: 85, defence: 80, hitpoints: 85, prayer: 74 }, quests: [],
    access: "The spider's lair beneath Morytania. Manage the web and acid-phase mechanics.",
    reward: "Noxious halberd (from three point pieces), Amulet of rancour, Araxyte slayer helmet, pet.",
    gear: "Melee with strong Prayer; learn the phases and the venom pools.",
    supplies: ["Prayer / restore potions", "Food", "Antipoison / antivenom"],
    tips: "The Amulet of rancour is a best-in-slot melee neck — a major endgame upgrade.",
  },
];

/* =============================== content: unlocks =============================== */
const UNLOCKS = [
  { id: "runepouch", name: "Rune pouch", tier: "S", stage: "early", effect: "Stores 3–4 rune types so magic barely costs you inventory space — used everywhere.", source: "Last Man Standing rewards, Slayer, or Wintertodt supply crates." },
  { id: "graceful", name: "Graceful outfit", tier: "S", stage: "early", effect: "Boosts run-energy recovery and cuts weight. Quality of life on literally every trip.", source: "Buy with Marks of Grace from Rooftop Agility courses." },
  { id: "barrowsgloves", name: "Barrows gloves", tier: "S", stage: "mid", effect: "Best all-round gloves for a long time across every combat style.", source: "Recipe for Disaster — complete all subquests." },
  { id: "ardycloak", name: "Ardougne cloak", tier: "S", stage: "mid", effect: "Free teleports plus Runecrafting/ZMI benefits; the tiers stack more QoL as you go.", source: "Ardougne achievement diaries (Easy → Elite)." },
  { id: "slayerhelm", name: "Slayer helmet (i)", tier: "S", stage: "mid", effect: "On-task accuracy and damage across all styles — imbue it for a large bonus.", source: "55 Slayer + Slayer points; imbue via Nightmare Zone or Soul Wars." },
  { id: "firecape", name: "Fire cape", tier: "A", stage: "mid", effect: "Strong all-round cape and a prerequisite for the Infernal and several tasks.", source: "TzHaar Fight Caves." },
  { id: "herbsack", name: "Herb sack", tier: "A", stage: "mid", effect: "Holds your herbs — a massive convenience for Slayer and farm runs.", source: "Slayer reward shop." },
  { id: "void", name: "Void / Elite Void", tier: "A", stage: "mid", effect: "Solid all-style set, especially for ranged and magic, and cheap to maintain.", source: "Pest Control points." },
  { id: "ddef", name: "Dragon defender", tier: "A", stage: "mid", effect: "Best non-degradable melee defender until the Avernic.", source: "Warriors' Guild — defender drops." },
  { id: "avas", name: "Ava's (Accumulator → Assembler)", tier: "A", stage: "mid", effect: "Recovers most of your ranged ammo automatically.", source: "Accumulator: Animal Magnetism. Assembler: Dragon Slayer II + mounting." },
  { id: "occult", name: "Occult necklace", tier: "A", stage: "mid", effect: "A big flat Magic damage boost for all spell setups.", source: "Thermonuclear Smoke Devil." },
  { id: "salve", name: "Salve amulet (ei)", tier: "A", stage: "mid", effect: "Huge damage and accuracy vs undead — Vorkath, Barrows, and more.", source: "Haunted Mine / Tarn's Lair, then enchant." },
  { id: "diaries", name: "Achievement diaries", tier: "A", stage: "any", effect: "Each area's diary unlocks teleports, better drop rates, and skilling perks — compounding QoL.", source: "Complete each area's tasks (Karamja, Ardougne, Kandarin, Western, Morytania…)." },
  { id: "skilloutfits", name: "Skilling outfits", tier: "B", stage: "any", effect: "Lumberjack, Angler, Prospector, Farmer's, Pyromancer — each grants bonus XP in its skill.", source: "Minigames & events (Tempoross, Wintertodt, random events)." },
  { id: "crystaltools", name: "Crystal tools", tier: "B", stage: "late", effect: "Faster, convenient gathering (axe / harpoon / pickaxe).", source: "Crystal tool seed (Gauntlet) combined with a dragon tool." },
  { id: "compostbucket", name: "Bottomless compost bucket", tier: "B", stage: "mid", effect: "Holds 10,000 compost and applies it in one click — farm-run gold.", source: "Hespori, in the Farming Guild." },
  { id: "bisboots", name: "Eternal / Pegasian / Primordial boots", tier: "B", stage: "late", effect: "Best-in-slot boots per style.", source: "Cerberus crystals + the base boots." },
  { id: "quiver", name: "Dizana's quiver", tier: "B", stage: "late", effect: "Ranged ammo storage plus a strong ranged cape in one slot.", source: "Fortis Colosseum." },
  { id: "imbuedheart", name: "Imbued heart", tier: "B", stage: "late", effect: "Periodic Magic level boost for spell damage and accuracy.", source: "Rare drop from superior Slayer monsters." },
  { id: "fairyrings", name: "Fairy ring access", tier: "B", stage: "early", effect: "A fast-travel network spanning the whole game.", source: "Fairytale II (partial completion enables full use)." },
  { id: "fightertorso", name: "Fighter torso", tier: "A", stage: "mid", effect: "One of the best Strength-bonus body slots for a long time, and free to keep.", source: "Barbarian Assault honour points." },
  { id: "fury", name: "Amulet of fury", tier: "A", stage: "mid", effect: "A strong all-round amulet balancing offence and defence across styles.", source: "Enchant an onyx amulet (onyx from Zalcano, demonic gorillas, or TzHaar shops)." },
  { id: "torture", name: "Amulet of torture", tier: "A", stage: "late", effect: "Best-in-slot melee amulet.", source: "Enchant a zenyte (from demonic gorillas, the Gauntlet, or zenyte shards)." },
  { id: "anguish", name: "Amulet of anguish", tier: "A", stage: "late", effect: "Best-in-slot ranged amulet.", source: "Enchant a zenyte." },
  { id: "torm", name: "Tormented bracelet", tier: "A", stage: "late", effect: "Best-in-slot Magic damage bracelet.", source: "Enchant a zenyte." },
  { id: "dkrings", name: "Imbued rings (Berserker / Archer / Seers)", tier: "A", stage: "late", effect: "Imbued Dagannoth Kings rings — top-tier stat rings for each style.", source: "Imbue the base rings at Nightmare Zone, Soul Wars, or PvP." },
  { id: "brimstone", name: "Brimstone ring", tier: "A", stage: "late", effect: "A strong hybrid ring whose passive ignores some Magic defence.", source: "Combine Hydra's eye, fang and heart (Alchemical Hydra)." },
  { id: "tomefire", name: "Tome of fire", tier: "B", stage: "mid", effect: "Boosts all fire spells by 50% — a big Magic damage spike on a budget.", source: "Wintertodt (burnt then searing pages)." },
  { id: "neitiznot", name: "Helm of neitiznot", tier: "B", stage: "early", effect: "A cheap, well-rounded helmet that stays useful for a long time.", source: "The Fremennik Isles quest." },
  { id: "devout", name: "Devout boots", tier: "B", stage: "late", effect: "Best Prayer-bonus boots.", source: "Combine holy sandals (a hard clue reward) with a Drake's claw (Karuulm)." },
  { id: "zealot", name: "Zealot's robes", tier: "B", stage: "mid", effect: "Bonus Prayer XP when offering bones at a gilded altar.", source: "Shade chests in Mort'ton (Shades of Mort'ton)." },
  { id: "gildedaltar", name: "Gilded altar (POH)", tier: "B", stage: "mid", effect: "A huge Prayer XP boost when training Prayer at your house.", source: "Construction (level 75) plus marble blocks." },
  { id: "jewellerybox", name: "Ornate jewellery box (POH)", tier: "B", stage: "mid", effect: "One-click teleports to dozens of destinations straight from your house.", source: "Construction plus jewellery and components." },
  { id: "eternalglory", name: "Eternal glory", tier: "B", stage: "late", effect: "Unlimited glory teleports and permanent glory stats — no recharging.", source: "Karamja Elite achievement diary." },
  { id: "avernic", name: "Avernic defender", tier: "A", stage: "late", effect: "Best-in-slot melee defender, a clear step up from the dragon defender.", source: "Theatre of Blood (Avernic defender hilt) + a dragon defender." },
  { id: "godcape", name: "Imbued god cape", tier: "A", stage: "late", effect: "Best magic cape until Dizana's quiver — strong Magic damage and accuracy.", source: "Mage Arena I & II miniquests." },
  { id: "secateurs", name: "Magic secateurs", tier: "B", stage: "early", effect: "Boosts herb yield from farming patches — feeds your whole potion supply.", source: "Fairytale I - Growing Pains." },
  { id: "coalbag", name: "Coal bag", tier: "B", stage: "early", effect: "Carries 27 coal — speeds up Smithing, Blast Furnace and bar runs.", source: "Prospector / Motherlode Mine reward shop." },
];
const TIER_COLOR = { S: "var(--gold-bright)", A: "var(--azure-bright)", B: "var(--muted)" };

/* =============================== content: account context =============================== */
const STAGE_RANK = { early: 0, mid: 1, late: 2 };

/* full quest catalogue (alphabetical, per OSRS hiscores/wiki) for Browse-all */
const QUESTS = [
  "A Kingdom Divided", "A Night at the Theatre", "A Porcine of Interest", "A Soul's Bane", "A Tail of Two Cats",
  "A Taste of Hope", "Animal Magnetism", "Another Slice of H.A.M.", "At First Light", "Below Ice Mountain",
  "Beneath Cursed Sands", "Between a Rock...", "Big Chompy Bird Hunting", "Biohazard", "Black Knights' Fortress",
  "Bone Voyage", "Cabin Fever", "Children of the Sun", "Client of Kourend", "Clock Tower", "Cold War", "Contact!",
  "Cook's Assistant", "Creature of Fenkenstrain", "Current Affairs", "Darkness of Hallowvale", "Death on the Isle",
  "Death Plateau", "Death to the Dorgeshuun", "Defender of Varrock", "Demon Slayer", "Desert Treasure I",
  "Desert Treasure II - The Fallen Empire", "Devious Minds", "Doric's Quest", "Dragon Slayer I", "Dragon Slayer II",
  "Dream Mentor", "Druidic Ritual", "Dwarf Cannon", "Eadgar's Ruse", "Eagles' Peak", "Elemental Workshop I",
  "Elemental Workshop II", "Enakhra's Lament", "Enlightened Journey", "Ernest the Chicken", "Ethically Acquired Antiquities",
  "Fairytale I - Growing Pains", "Fairytale II - Cure a Queen", "Family Crest", "Fight Arena", "Fishing Contest",
  "Forgettable Tale...", "Garden of Tranquillity", "Gertrude's Cat", "Getting Ahead", "Ghosts Ahoy", "Goblin Diplomacy",
  "Grim Tales", "Haunted Mine", "Hazeel Cult", "The Heart of Darkness", "Heroes' Quest", "Holy Grail",
  "Horror from the Deep", "Icthlarin's Little Helper", "Imp Catcher", "In Aid of the Myreque", "In Search of the Myreque",
  "Jungle Potion", "King's Ransom", "Land of the Goblins", "Legends' Quest", "Lost City", "Lunar Diplomacy",
  "Making Friends with My Arm", "Making History", "Meat and Greet", "Merlin's Crystal", "Misthalin Mystery",
  "Monk's Friend", "Monkey Madness I", "Monkey Madness II", "Mountain Daughter", "Mourning's End Part I",
  "Mourning's End Part II", "Murder Mystery", "My Arm's Big Adventure", "Nature Spirit", "Observatory Quest",
  "Olaf's Quest", "One Small Favour", "Pandemonium", "Perilous Moons", "Pirate's Treasure", "Plague City",
  "Priest in Peril", "Prince Ali Rescue", "Prying Times", "Rag and Bone Man I", "Rag and Bone Man II", "Ratcatchers",
  "Recipe for Disaster", "Recruitment Drive", "Regicide", "The Ribbiting Tale of a Lily Pad Labour Dispute",
  "Romeo & Juliet", "Roving Elves", "Royal Trouble", "Rum Deal", "Rune Mysteries", "Scorpion Catcher", "Scrambled!",
  "Sea Slug", "Secrets of the North", "Shades of Mort'ton", "Shadow of the Storm", "Shadows of Custodia",
  "Sheep Herder", "Sheep Shearer", "Shield of Arrav", "Shilo Village", "Sins of the Father", "Sleeping Giants",
  "Song of the Elves", "Spirits of the Elid", "Swan Song", "Tai Bwo Wannai Trio", "Tale of the Righteous",
  "Tears of Guthix", "Temple of Ikov", "Temple of the Eye", "The Ascent of Arceuus", "The Corsair Curse",
  "The Curse of Arrav", "The Depths of Despair", "The Dig Site", "The Eyes of Glouphrie", "The Feud",
  "The Forsaken Tower", "The Fremennik Isles", "The Fremennik Trials", "The Garden of Death", "The Giant Dwarf",
  "The Golem", "The Grand Tree", "The Great Brain Robbery", "The Hand in the Sand", "The Knight's Sword",
  "The Lost Tribe", "The Path of Glouphrie", "The Queen of Thieves", "The Restless Ghost", "The Slug Menace",
  "The Tourist Trap", "Throne of Miscellania", "Tower of Life", "Tree Gnome Village", "Tribal Totem", "Troll Romance",
  "Troll Stronghold", "Twilight's Promise", "Underground Pass", "Vampyre Slayer", "Wanted!", "Watchtower",
  "Waterfall Quest", "What Lies Below", "Witch's House", "X Marks the Spot", "Zogre Flesh Eaters",
];

/* curated subset that drives the "Suggested" view: stage + what it gates + why */
const KEY_QUESTS = {
  "Druidic Ritual": { stage: "early", note: "Unlocks the Herblore skill." },
  "Dragon Slayer I": { stage: "early", note: "Rune platebody and dragon equipment." },
  "Lost City": { stage: "early", note: "Dragon dagger and Zanaris access." },
  "Waterfall Quest": { stage: "early", note: "Huge early Attack/Strength XP, no requirements." },
  "Animal Magnetism": { stage: "early", note: "Ava's device — ranged ammo recovery." },
  "Priest in Peril": { stage: "early", gates: ["barrows"], note: "Morytania access — a gateway to a lot." },
  "The Fremennik Trials": { stage: "early", note: "Fremennik access and the helm." },
  "Client of Kourend": { stage: "early", note: "Great Kourend access." },
  "Monkey Madness I": { stage: "mid", note: "Prerequisite for Monkey Madness II." },
  "Recipe for Disaster": { stage: "mid", note: "Barrows gloves — best all-round gloves for ages." },
  "Regicide": { stage: "mid", gates: ["zulrah"], note: "Tirannwn access — required for Zulrah." },
  "Desert Treasure I": { stage: "mid", note: "Unlocks Ancient Magicks (ice spells)." },
  "Lunar Diplomacy": { stage: "mid", note: "Unlocks the Lunar spellbook." },
  "Dream Mentor": { stage: "mid", note: "+5 Hitpoints; follows Lunar Diplomacy." },
  "Fairytale II - Cure a Queen": { stage: "mid", note: "Full fairy ring travel network." },
  "Heroes' Quest": { stage: "mid", note: "Prerequisite for many mid-game quests." },
  "Sins of the Father": { stage: "mid", note: "Salve amulet (ei) — huge vs undead." },
  "Bone Voyage": { stage: "mid", note: "Fossil Island access." },
  "Underground Pass": { stage: "mid", note: "Elf quest line — leads toward the Gauntlet." },
  "Monkey Madness II": { stage: "mid", note: "Prerequisite for Dragon Slayer II." },
  "Dragon Slayer II": { stage: "mid", gates: ["vorkath"], note: "Unlocks Vorkath, Ava's assembler, Myths' Guild." },
  "Mourning's End Part I": { stage: "late", note: "Elf line — leads toward Song of the Elves." },
  "Mourning's End Part II": { stage: "late", note: "Elf line — leads toward Song of the Elves." },
  "Song of the Elves": { stage: "late", gates: ["gauntlet"], note: "Prifddinas, the Gauntlet, crystal gear." },
  "Beneath Cursed Sands": { stage: "late", gates: ["toa"], note: "Access to the Tombs of Amascut area." },
  "Desert Treasure II - The Fallen Empire": { stage: "late", note: "Ancient rings and major upgrades." },
  "Making Friends with My Arm": { stage: "late", note: "Useful Firemaking / late-game unlocks." },
};

const DIARY_AREAS = ["Ardougne", "Desert", "Falador", "Fremennik", "Kandarin", "Karamja", "Kourend & Kebos", "Lumbridge & Draynor", "Morytania", "Varrock", "Western Provinces", "Wilderness"];
const DIARY_TIERS = ["Easy", "Medium", "Hard", "Elite"];

const MINIGAMES = [
  "Fight Caves (Fire cape)", "Inferno (Infernal cape)", "Pest Control (Void)", "Barbarian Assault", "Castle Wars",
  "Last Man Standing", "Soul Wars", "Tithe Farm", "Guardians of the Rift", "Tempoross", "Wintertodt",
  "Volcanic Mine", "Mahogany Homes", "Pyramid Plunder", "Fishing Trawler", "Nightmare Zone", "Trouble Brewing", "Gnome Restaurant",
];

/* =============================== sample account =============================== */
const SAMPLE = {
  name: "Sample GIM",
  type: "group",
  combatLevel: 105,
  sample: true,
  skills: {
    attack: 82, strength: 84, defence: 78, hitpoints: 85, ranged: 88, prayer: 70, magic: 85,
    slayer: 84, agility: 72, herblore: 74, farming: 76, mining: 68, fishing: 70, cooking: 82,
    smithing: 66, crafting: 71, firemaking: 75, fletching: 80, woodcutting: 78, runecrafting: 64,
    thieving: 70, construction: 62, hunter: 67, overall: 1701,
  },
  _xp: 28430000,
  bosses: { barrows_chests: 312, tztok_jad: 1, zulrah: 186, vorkath: 95, general_graardor: 22, cerberus: 0, the_gauntlet: 0, alchemical_hydra: 0, tombs_of_amascut: 11, chambers_of_xeric: 0, theatre_of_blood: 0, tzkal_zuk: 0 },
  quests: ["Priest in Peril", "Dragon Slayer I", "Druidic Ritual", "Lost City", "Waterfall Quest", "Animal Magnetism", "The Fremennik Trials", "Client of Kourend", "Monkey Madness I", "Recipe for Disaster", "Regicide", "Desert Treasure I", "Lunar Diplomacy", "Dream Mentor", "Fairytale II - Cure a Queen", "Heroes' Quest", "Sins of the Father", "Bone Voyage", "Monkey Madness II", "Dragon Slayer II", "Beneath Cursed Sands"],
  totalLevel: 1701,
};

function stageOf(acct) {
  const t = acct?.totalLevel || 0;
  if (t >= 1700) return "late";
  if (t >= 1000) return "mid";
  return "early";
}
const STAGE_LABEL = { early: "Early game", mid: "Mid game", late: "Late game" };

/* readiness assessment */
function assess(boss, acct, doneQuests) {
  const rows = Object.entries(boss.skills).map(([k, need]) => {
    const have = acct?.skills?.[k] ?? 0;
    return { key: k, label: SKILL_LABEL[k] || k, need, have, ok: have >= need };
  }).sort((a, b) => (a.ok - b.ok) || (b.need - a.need));
  const statsMet = rows.every((r) => r.ok);
  const gaps = rows.filter((r) => !r.ok);
  const maxGap = gaps.reduce((m, r) => Math.max(m, r.need - r.have), 0);
  const questsMet = (boss.quests || []).every((q) => doneQuests.includes(q));
  let verdict, tone, label;
  if (statsMet && questsMet) { verdict = "ready"; tone = "ready"; label = "Ready"; }
  else if (statsMet && !questsMet) { verdict = "quests"; tone = "warn"; label = "Quests first"; }
  else if (maxGap <= 5) { verdict = "almost"; tone = "warn"; label = "Almost"; }
  else { verdict = "no"; tone = "no"; label = "Not yet"; }
  return { rows, statsMet, questsMet, gaps, maxGap, verdict, tone, label };
}

/* =============================== small UI =============================== */
function Glyph({ icon, accent }) {
  return <div className="glyph" style={{ color: accent || "var(--azure-bright)" }}>{icon}</div>;
}
function StatusPill({ tone, label }) {
  return <span className={"pill pill-" + tone}>{label}</span>;
}

/* =============================== snapshot tab =============================== */
function SnapshotTab({ acct, loading, error, rsn, setRsn, onLoad }) {
  const stage = stageOf(acct);
  const combatSkills = SKILLS.filter((s) => s[2]);
  const kcList = BOSSES.map((b) => ({ name: b.name, kc: acct?.bosses?.[b.womKey] ?? 0 })).filter((x) => x.kc > 0).sort((a, b) => b.kc - a.kc);

  return (
    <div className="tabwrap">
      <div className="tab-h"><Users size={18} /><h2 className="display">Account</h2></div>

      <div className="load-card">
        <div className="load-row">
          <div className="search">
            <Search size={16} className="search-ic" />
            <input value={rsn} onChange={(e) => setRsn(e.target.value)} placeholder="Your RuneScape name…" onKeyDown={(e) => { if (e.key === "Enter") onLoad(); }} />
          </div>
          <button className="btn-azure" onClick={onLoad} disabled={loading}>{loading ? "Loading…" : "Load"}</button>
        </div>
        {error && <div className="load-err"><AlertTriangle size={13} /> {error}</div>}
      </div>

      {acct && (
        <>
          <div className="acct-head">
            <div>
              <div className="acct-name display">{acct.name}</div>
              <div className="row gap-sm" style={{ marginTop: 6, alignItems: "center" }}>
                <span className="tag tag-type">{acct.type === "group" ? "Group Ironman" : acct.type === "hardcore" ? "Hardcore Ironman" : acct.type === "ultimate" ? "Ultimate Ironman" : acct.type === "ironman" ? "Ironman" : "Account"}</span>
                <span className="tag">{STAGE_LABEL[stage]}</span>
                {acct.sample && <span className="tag tag-sample">sample</span>}
              </div>
            </div>
            <div className="acct-cb">
              <div className="cb-val mono">{acct.combatLevel || "—"}</div>
              <div className="cb-lbl">Combat</div>
            </div>
          </div>

          <div className="acct-kpis">
            <div className="akpi"><span>Total level</span><b className="mono">{fmtNum(acct.totalLevel)}</b></div>
            <div className="akpi"><span>Total XP</span><b className="mono">{acctXp(acct) ? fmtNum(acctXp(acct)) : "—"}</b></div>
            <div className="akpi"><span>Bosses tracked</span><b className="mono">{kcList.length}</b></div>
          </div>

          <div className="sec-h">Combat</div>
          <div className="skill-grid combat">
            {combatSkills.map(([k, l]) => (
              <div key={k} className="skill combat-s"><span className="sk-l">{l}</span><b className="mono sk-v">{acct.skills?.[k] ?? "—"}</b></div>
            ))}
          </div>

          <div className="sec-h">All skills</div>
          <div className="skill-grid">
            {SKILLS.map(([k, l]) => (
              <div key={k} className="skill"><span className="sk-l">{l}</span><b className="mono sk-v">{acct.skills?.[k] ?? "—"}</b></div>
            ))}
          </div>

          {kcList.length > 0 && (
            <>
              <div className="sec-h">Notable kill counts</div>
              <div className="kc-list">
                {kcList.map((x) => (<div key={x.name} className="kc-row"><span>{x.name}</span><b className="mono">{fmtNum(x.kc)}</b></div>))}
              </div>
            </>
          )}

          <div className="note"><AlertTriangle size={13} /><span>Stats and kill counts are pulled live from Wise Old Man. Quest, diary, and collection-log progress aren't available via API, so those are confirmed by hand in the Readiness tab. {acct.sample ? "This preview shows a sample account — your real data loads once hosted." : ""}</span></div>
        </>
      )}
    </div>
  );
}
function acctXp(acct) { return acct?._xp || 0; }

/* =============================== readiness tab =============================== */
function ReadinessTab({ acct, doneQuests, toggleQuest, onOpen }) {
  const [filter, setFilter] = useState("all");
  const assessed = useMemo(() => BOSSES.map((b) => ({ b, a: assess(b, acct, doneQuests) })).sort((x, y) => x.b.order - y.b.order), [acct, doneQuests]);
  const shown = assessed.filter(({ a }) => filter === "all" || (filter === "ready" && a.verdict === "ready") || (filter === "close" && (a.verdict === "almost" || a.verdict === "quests")) || (filter === "no" && a.verdict === "no"));
  const counts = {
    ready: assessed.filter((x) => x.a.verdict === "ready").length,
    close: assessed.filter((x) => x.a.verdict === "almost" || x.a.verdict === "quests").length,
  };

  return (
    <div className="tabwrap">
      <div className="tab-h"><Target size={18} /><h2 className="display">Readiness</h2></div>
      <div className="ready-summary">
        <div className="rs"><b className="mono" style={{ color: "var(--ready)" }}>{counts.ready}</b><span>ready</span></div>
        <div className="rs"><b className="mono" style={{ color: "var(--warn)" }}>{counts.close}</b><span>in reach</span></div>
        <div className="rs"><b className="mono">{BOSSES.length}</b><span>tracked</span></div>
      </div>

      <div className="chips">
        {[["all", "All"], ["ready", "Ready"], ["close", "In reach"], ["no", "Not yet"]].map(([k, l]) => (
          <button key={k} className={"chip" + (filter === k ? " chip-on" : "")} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="rcards">
        {shown.map(({ b, a }) => {
          const kc = acct?.bosses?.[b.womKey] ?? 0;
          return (
            <button key={b.id} className="rcard" onClick={() => onOpen(b)}>
              <div className="rcard-main">
                <div className="row gap-sm" style={{ alignItems: "center" }}>
                  <span className="rcard-name">{b.name}</span>
                  <span className="tag tag-cat">{b.cat}</span>
                </div>
                <div className="rcard-sub">
                  {a.verdict === "ready" ? "Meets recommended levels" :
                    a.verdict === "quests" ? `Stats met — complete: ${b.quests.join(", ")}` :
                    a.gaps.length ? "Train: " + a.gaps.slice(0, 3).map((g) => `${g.label} ${g.need}`).join(", ") : "—"}
                  {kc > 0 && <span className="rcard-kc"> · {fmtNum(kc)} KC</span>}
                </div>
              </div>
              <StatusPill tone={a.tone} label={a.label} />
            </button>
          );
        })}
      </div>
      <div className="note"><AlertTriangle size={13} /><span>Levels shown are recommended guidelines, not always strict minimums — verify exact requirements on the OSRS Wiki. Readiness grades your stats automatically; tick off quests inside each card.</span></div>
    </div>
  );
}

function BossModal({ boss, acct, doneQuests, toggleQuest, onClose }) {
  const a = assess(boss, acct, doneQuests);
  const kc = acct?.bosses?.[boss.womKey] ?? 0;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-name display">{boss.name}</div>
            <div className="row gap-sm" style={{ marginTop: 5, alignItems: "center" }}>
              <span className="tag tag-cat">{boss.cat}</span>
              {kc > 0 && <span className="tag">{fmtNum(kc)} KC</span>}
              <StatusPill tone={a.tone} label={a.label} />
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="sec-h2">Requirements</div>
        <div className="req-grid">
          {a.rows.map((r) => (
            <div key={r.key} className={"req" + (r.ok ? " ok" : "")}>
              {r.ok ? <Check size={13} /> : <X size={13} />}
              <span className="req-l">{r.label}</span>
              <b className="mono req-v">{r.have}<span className="req-need">/{r.need}</span></b>
            </div>
          ))}
        </div>

        {boss.quests.length > 0 && (
          <>
            <div className="sec-h2">Quests <span className="sub-note">(tap to confirm)</span></div>
            <div className="quest-list">
              {boss.quests.map((q) => {
                const done = doneQuests.includes(q);
                return (
                  <button key={q} className={"quest" + (done ? " done" : "")} onClick={() => toggleQuest(q)}>
                    <span className={"qbox" + (done ? " on" : "")}>{done && <Check size={12} />}</span>
                    <Scroll size={13} /><span>{q}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="info-sec"><div className="info-h"><Trophy size={13} style={{ color: "var(--gold-bright)" }} /> Why it matters</div><p>{boss.reward}</p></div>
        <div className="info-sec"><div className="info-h"><Swords size={13} style={{ color: "var(--azure-bright)" }} /> Ironman gear</div><p>{boss.gear}</p></div>
        <div className="info-sec"><div className="info-h"><Backpack size={13} style={{ color: "var(--ready)" }} /> Supplies</div><div className="chip-wrap">{boss.supplies.map((s, i) => <span key={i} className="sup-chip">{s}</span>)}</div></div>
        <div className="info-sec"><div className="info-h"><Activity size={13} style={{ color: "var(--muted)" }} /> Access & tips</div><p>{boss.access}</p><p style={{ marginTop: 7 }}>{boss.tips}</p></div>
      </div>
    </div>
  );
}

/* =============================== unlocks tab =============================== */
function UnlocksTab({ acct, onOpen, owned, toggleOwned }) {
  const stage = stageOf(acct);
  const [filter, setFilter] = useState("stage");
  const order = { S: 0, A: 1, B: 2 };
  const stageRank = { early: 0, mid: 1, late: 2, any: 1 };
  const list = useMemo(() => {
    let l = [...UNLOCKS];
    if (filter === "S") l = l.filter((u) => u.tier === "S");
    else if (filter === "stage") l = l.filter((u) => u.stage === "any" || stageRank[u.stage] <= stageRank[stage]);
    else if (filter === "missing") l = l.filter((u) => !owned.includes(u.id));
    return l.sort((x, y) => order[x.tier] - order[y.tier]);
  }, [filter, stage, owned]);

  return (
    <div className="tabwrap">
      <div className="tab-h"><Award size={18} /><h2 className="display">Unlocks</h2></div>
      <div className="note thin"><Sparkles size={13} style={{ color: "var(--gold-bright)" }} /><span>The quality-of-life unlocks that multiply everything else. Tap the box to mark what you own — What's Next then stops suggesting it and points you at what you're still missing.</span></div>

      <div className="chips">
        {[["stage", "For my stage"], ["missing", "Missing"], ["S", "S-tier"], ["all", "Everything"]].map(([k, l]) => (
          <button key={k} className={"chip" + (filter === k ? " chip-on" : "")} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="browse-meta"><span className="mono">{owned.length} / {UNLOCKS.length} owned</span></div>

      <div className="ucards">
        {list.map((u) => {
          const has = owned.includes(u.id);
          return (
            <div key={u.id} className={"ucard" + (has ? " owned" : "")}>
              <button className={"uown" + (has ? " on" : "")} onClick={() => toggleOwned(u.id)} title={has ? "Owned" : "Mark as owned"}>{has && <Check size={13} />}</button>
              <button className="ucard-body" onClick={() => onOpen(u)}>
                <span className="utier" style={{ color: TIER_COLOR[u.tier], borderColor: TIER_COLOR[u.tier] }}>{u.tier}</span>
                <div className="umain">
                  <div className="uname">{u.name}</div>
                  <div className="ueffect">{u.effect}</div>
                </div>
                <ChevronRight size={15} className="uchev" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function UnlockModal({ unlock, onClose, owned, toggleOwned }) {
  const has = owned.includes(unlock.id);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="row gap" style={{ alignItems: "center" }}>
            <span className="utier big" style={{ color: TIER_COLOR[unlock.tier], borderColor: TIER_COLOR[unlock.tier] }}>{unlock.tier}</span>
            <div>
              <div className="sheet-name display">{unlock.name}</div>
              <div className="tag" style={{ marginTop: 5, display: "inline-block" }}>{STAGE_LABEL[unlock.stage] || "Any stage"}</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="info-sec"><div className="info-h"><Star size={13} style={{ color: "var(--gold-bright)" }} /> What it does</div><p>{unlock.effect}</p></div>
        <div className="info-sec"><div className="info-h"><Compass size={13} style={{ color: "var(--azure-bright)" }} /> How to get it</div><p>{unlock.source}</p></div>
        <button className={"own-btn" + (has ? " on" : "")} onClick={() => toggleOwned(unlock.id)}>{has ? <><Check size={14} /> Owned — tap to undo</> : "Mark as owned"}</button>
      </div>
    </div>
  );
}

/* =============================== nav =============================== */
/* =============================== context tab =============================== */
function ToggleRow({ label, sub, on, onToggle }) {
  return (
    <button className={"trow" + (on ? " on" : "")} onClick={onToggle}>
      <span className={"tbox" + (on ? " on" : "")}>{on && <Check size={13} />}</span>
      <span className="trow-main"><span className="trow-l">{label}</span>{sub && <span className="trow-sub">{sub}</span>}</span>
    </button>
  );
}

function ContextTab({ acct, doneQuests, setDoneQuests, doneDiaries, setDoneDiaries, doneMinigames, setDoneMinigames, gp, setGp }) {
  const [mode, setMode] = useState("suggested");
  const [cat, setCat] = useState("quests");
  const [q, setQ] = useState("");
  const stage = stageOf(acct);

  const toggleQuest = (n) => setDoneQuests((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const toggleMini = (n) => setDoneMinigames((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const dkey = (a, t) => a + "|" + t;
  const toggleDiary = (a, t) => {
    setDoneDiaries((p) => {
      const idx = DIARY_TIERS.indexOf(t);
      const has = p.includes(dkey(a, t));
      if (has) {
        return p.filter((k) => !k.startsWith(a + "|") || DIARY_TIERS.indexOf(k.split("|")[1]) < idx);
      }
      const add = [];
      for (let i = 0; i <= idx; i++) { const kk = dkey(a, DIARY_TIERS[i]); if (!p.includes(kk)) add.push(kk); }
      return [...p, ...add];
    });
  };

  const suggested = useMemo(() => {
    const gatingNames = new Set();
    BOSSES.forEach((b) => {
      const a = assess(b, acct, doneQuests);
      if (a.verdict === "almost" || a.verdict === "quests") {
        (b.quests || []).forEach((qn) => { if (!doneQuests.includes(qn)) gatingNames.add(qn); });
      }
    });
    const gating = [...gatingNames].map((name) => ({ name, why: "Unlocks content you're nearly ready for" }));
    const curated = Object.entries(KEY_QUESTS)
      .filter(([name, m]) => !doneQuests.includes(name) && !gatingNames.has(name) && STAGE_RANK[m.stage] <= STAGE_RANK[stage])
      .map(([name, m]) => ({ name, why: m.note }))
      .slice(0, 8);
    return { gating, curated };
  }, [acct, doneQuests, stage]);

  const fQuests = useMemo(() => { const s = q.trim().toLowerCase(); return QUESTS.filter((n) => !s || n.toLowerCase().includes(s)); }, [q]);
  const fMinis = useMemo(() => { const s = q.trim().toLowerCase(); return MINIGAMES.filter((n) => !s || n.toLowerCase().includes(s)); }, [q]);
  const diaryTotal = DIARY_AREAS.length * DIARY_TIERS.length;

  return (
    <div className="tabwrap">
      <div className="tab-h"><ListChecks size={18} /><h2 className="display">Context</h2></div>
      <div className="note thin"><Sparkles size={13} style={{ color: "var(--gold-bright)" }} /><span>Stats, KC and minigame scores already auto-pull from the hiscores. Add the rest here so Readiness grades you accurately. It only asks for what matters at your stage — tap Browse all anytime to set everything upfront.</span></div>

      <div className="seg">
        <button className={"seg-b" + (mode === "suggested" ? " seg-on" : "")} onClick={() => setMode("suggested")}>Suggested now</button>
        <button className={"seg-b" + (mode === "browse" ? " seg-on" : "")} onClick={() => setMode("browse")}>Browse all</button>
      </div>

      {mode === "suggested" && (
        <>
          {suggested.gating.length > 0 && (
            <div className="ctx-sec">
              <div className="ctx-h"><Target size={13} style={{ color: "var(--warn)" }} /> Confirm to unlock what you're near</div>
              <div className="trows">
                {suggested.gating.map((it) => <ToggleRow key={it.name} label={it.name} sub={it.why} on={doneQuests.includes(it.name)} onToggle={() => toggleQuest(it.name)} />)}
              </div>
            </div>
          )}
          <div className="ctx-sec">
            <div className="ctx-h"><Star size={13} style={{ color: "var(--gold-bright)" }} /> Worth doing at your stage</div>
            {suggested.curated.length > 0 ? (
              <div className="trows">
                {suggested.curated.map((it) => <ToggleRow key={it.name} label={it.name} sub={it.why} on={doneQuests.includes(it.name)} onToggle={() => toggleQuest(it.name)} />)}
              </div>
            ) : <div className="ctx-empty">You've confirmed the key quests for your stage. New ones surface here as you level up.</div>}
          </div>
          <div className="ctx-grow"><TrendingUp size={13} /><span>This list grows with your account — more surfaces as you level up and get closer to new content. Want to set everything now? <button className="link-btn" onClick={() => setMode("browse")}>Browse all →</button></span></div>
        </>
      )}

      {mode === "browse" && (
        <>
          <div className="seg sub">
            {[["quests", "Quests"], ["diaries", "Diaries"], ["minigames", "Minigames"], ["bank", "Bank"]].map(([k, l]) => (
              <button key={k} className={"seg-b" + (cat === k ? " seg-on" : "")} onClick={() => { setCat(k); setQ(""); }}>{l}</button>
            ))}
          </div>

          {cat === "quests" && (
            <>
              <div className="search sm"><Search size={14} className="search-ic" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quests…" /></div>
              <div className="browse-meta"><span className="mono">{doneQuests.length} / {QUESTS.length} done</span><div className="bulk"><button onClick={() => setDoneQuests([...QUESTS])}>Mark all</button><button onClick={() => setDoneQuests([])}>Clear</button></div></div>
              <div className="trows">{fQuests.map((n) => <ToggleRow key={n} label={n} on={doneQuests.includes(n)} onToggle={() => toggleQuest(n)} />)}</div>
            </>
          )}

          {cat === "diaries" && (
            <>
              <div className="browse-meta"><span className="mono">{doneDiaries.length} / {diaryTotal} tiers</span></div>
              <div className="diaries">
                {DIARY_AREAS.map((a) => {
                  const dc = DIARY_TIERS.filter((t) => doneDiaries.includes(dkey(a, t))).length;
                  return (
                    <div key={a} className="diary">
                      <div className="diary-head"><span className="diary-name">{a}</span><span className="diary-count mono">{dc}/4</span></div>
                      <div className="diary-tiers">
                        {DIARY_TIERS.map((t) => <button key={t} className={"tier" + (doneDiaries.includes(dkey(a, t)) ? " on" : "")} onClick={() => toggleDiary(a, t)} title={t}>{({ Easy: "E", Medium: "M", Hard: "H", Elite: "El" })[t]}</button>)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ctx-hint">Tap a tier — completing a higher tier fills in the ones below it automatically.</div>
            </>
          )}

          {cat === "minigames" && (
            <>
              <div className="search sm"><Search size={14} className="search-ic" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search minigames…" /></div>
              <div className="browse-meta"><span className="mono">{doneMinigames.length} / {MINIGAMES.length} done</span><div className="bulk"><button onClick={() => setDoneMinigames([...MINIGAMES])}>Mark all</button><button onClick={() => setDoneMinigames([])}>Clear</button></div></div>
              <div className="trows">{fMinis.map((n) => <ToggleRow key={n} label={n} on={doneMinigames.includes(n)} onToggle={() => toggleMini(n)} />)}</div>
            </>
          )}

          {cat === "bank" && (
            <div className="bank-card">
              <div className="ctx-h"><Gem size={13} style={{ color: "var(--gold-bright)" }} /> Bank value / GP</div>
              <p className="bank-sub">No public API exposes bank or GP — it's private account data — so this is the one thing worth entering by hand. Used as context for what's within reach.</p>
              <div className="gp-in"><input inputMode="numeric" value={gp} onChange={(e) => setGp(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /><span className="gp-suffix">gp</span></div>
              {gp && <div className="gp-echo mono">= {Number(gp).toLocaleString()} gp</div>}
              <div className="gp-chips">{[["1m", 1000000], ["10m", 10000000], ["100m", 100000000], ["1b", 1000000000]].map(([l, v]) => <button key={l} onClick={() => setGp(String(v))}>{l}</button>)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* =============================== what's next engine =============================== */
const BOSS_VALUE = { Early: 10, Mid: 20, Late: 30, Endgame: 40 };
const ESTABLISHED_KC = 25;       // above this you've clearly "started" a boss
const ONE_OFF = ["tztok_jad", "tzkal_zuk"]; // capes you earn once, not farmed

function computeNextSteps(acct, doneQuests, doneDiaries, doneMinigames, ownedUnlocks) {
  const stage = stageOf(acct);
  const moves = [];
  const skillTally = {}; // skillKey -> { weight, label }

  BOSSES.forEach((b) => {
    const a = assess(b, acct, doneQuests);
    const kc = acct?.bosses?.[b.womKey] ?? 0;
    const val = BOSS_VALUE[b.cat] || 10;

    if (a.verdict === "ready") {
      if (kc >= ESTABLISHED_KC) return;                       // already grinding it
      if (ONE_OFF.includes(b.womKey) && kc > 0) return;       // cape already earned
      moves.push({
        id: "boss-" + b.id, tag: "Ready", tone: "ready", boss: b,
        title: kc > 0 ? `Keep farming ${b.name}` : `Start ${b.name}`,
        why: b.reward, score: 82 + val,
      });
    } else if (a.verdict === "quests") {
      const missing = (b.quests || []).filter((qn) => !doneQuests.includes(qn));
      moves.push({
        id: "boss-" + b.id, tag: "1 step away", tone: "warn", boss: b,
        title: missing.length === 1 ? `Do ${missing[0]}` : `Finish ${missing.length} quests for ${b.name}`,
        why: `Your stats already clear ${b.name} — ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} all that's left. ${b.reward}`,
        score: 88 + val * 0.8,
      });
    } else if (a.verdict === "almost") {
      a.gaps.forEach((g) => {
        skillTally[g.key] = skillTally[g.key] || { weight: 0, label: g.label };
        skillTally[g.key].weight += val;
      });
      moves.push({
        id: "boss-" + b.id, tag: "Almost", tone: "warn", boss: b,
        title: `Train for ${b.name}`,
        why: `Within reach — you need ${a.gaps.map((g) => `${g.label} ${g.need}`).join(", ")}. ${b.reward}`,
        score: 62 + val * 0.6 - a.maxGap * 2,
      });
    } else if (a.verdict === "no") {
      a.gaps.forEach((g) => {
        skillTally[g.key] = skillTally[g.key] || { weight: 0, label: g.label };
        skillTally[g.key].weight += val * 0.5;
      });
    }
  });

  // foundational quests not done and not already implied by a boss recommendation
  const surfaced = new Set(moves.flatMap((m) => (m.boss ? m.boss.quests || [] : [])));
  Object.entries(KEY_QUESTS).forEach(([name, m]) => {
    if (doneQuests.includes(name) || surfaced.has(name)) return;
    if (STAGE_RANK[m.stage] > STAGE_RANK[stage]) return;
    moves.push({
      id: "quest-" + name, tag: "Quest", tone: "azure", goContext: true,
      title: name, why: m.note, score: 66 + (m.gates ? m.gates.length * 12 : 0),
    });
  });

  // a few high-value diaries not yet done
  const keyDiaries = [
    { area: "Ardougne", tier: "Medium", why: "Unlimited Ardougne cloak teleports plus Monastery and Runecrafting perks." },
    { area: "Karamja", tier: "Medium", why: "Karamja gloves and smoother access around the volcano dungeon." },
    { area: "Morytania", tier: "Hard", why: "Strong Slayer and Barrows perks — a real mid-game spike." },
  ];
  keyDiaries.forEach((d) => {
    if (doneDiaries.includes(d.area + "|" + d.tier)) return;
    moves.push({ id: "diary-" + d.area, tag: "Diary", tone: "azure", goContext: true, title: `${d.area} ${d.tier} diary`, why: d.why, score: 52 });
  });

  // high-value QoL unlocks you don't own yet (capped so they don't crowd the list)
  const uOrder = { S: 0, A: 1, B: 2 };
  const uStageRank = { early: 0, mid: 1, late: 2, any: 1 };
  UNLOCKS
    .filter((u) => u.tier !== "B" && !(ownedUnlocks || []).includes(u.id) && uStageRank[u.stage] <= STAGE_RANK[stage])
    .sort((a, b) => uOrder[a.tier] - uOrder[b.tier])
    .slice(0, 3)
    .forEach((u) => {
      moves.push({
        id: "unlock-" + u.id, tag: "Unlock", tone: "azure", goUnlocks: true,
        title: `Get ${u.name}`, why: `${u.effect} ${u.source}`,
        score: u.tier === "S" ? 68 : 58,
      });
    });

  moves.sort((x, y) => y.score - x.score);

  // bottleneck: the skill gating the most (value-weighted) content
  let bottleneck = null;
  const ranked = Object.entries(skillTally).sort((a, b) => b[1].weight - a[1].weight);
  if (ranked.length) {
    const [key, info] = ranked[0];
    const have = acct?.skills?.[key] ?? 0;
    const gated = BOSSES.filter((b) => b.skills[key] && have < b.skills[key]);
    const needs = gated.map((b) => b.skills[key]).filter((n) => n > have).sort((a, b) => a - b);
    const target = needs[0];
    const nextBoss = gated.find((b) => b.skills[key] === target);
    bottleneck = { label: info.label, have, target, count: gated.length, unlocksNext: nextBoss ? nextBoss.name : null };
  }

  return { moves: moves.slice(0, 6), bottleneck, stage };
}

function NextTab({ acct, doneQuests, doneDiaries, doneMinigames, ownedUnlocks, onOpenBoss, onGoContext, onGoUnlocks }) {
  const { moves, bottleneck } = useMemo(
    () => computeNextSteps(acct, doneQuests, doneDiaries, doneMinigames, ownedUnlocks),
    [acct, doneQuests, doneDiaries, doneMinigames, ownedUnlocks]
  );
  return (
    <div className="tabwrap">
      <div className="tab-h"><Zap size={18} /><h2 className="display">What's Next</h2></div>
      <div className="note thin"><Sparkles size={13} style={{ color: "var(--gold-bright)" }} /><span>Computed from your live stats and kill counts plus the quests and diaries you've confirmed. The more context you add, the sharper it gets.</span></div>
      {acct?.sample && <div className="ctx-hint" style={{ marginTop: 0, marginBottom: 14 }}>Showing a sample account — load yours in the Account tab for real recommendations.</div>}

      {bottleneck && bottleneck.target && (
        <div className="bottleneck">
          <div className="bn-label"><AlertTriangle size={13} /> Biggest bottleneck</div>
          <div className="bn-skill">{bottleneck.label} <span className="bn-cur mono">{bottleneck.have}</span></div>
          <div className="bn-text">It's gating <b>{bottleneck.count}</b> piece{bottleneck.count !== 1 ? "s" : ""} of content. Getting it to <b className="mono">{bottleneck.target}</b>{bottleneck.unlocksNext ? <> brings <b>{bottleneck.unlocksNext}</b> into reach</> : ""}.</div>
        </div>
      )}

      <div className="sec-h">Your next moves</div>
      {moves.length ? (
        <div className="moves">
          {moves.map((m, i) => (
            <button key={m.id} className="move" onClick={() => (m.boss ? onOpenBoss(m.boss) : m.goUnlocks ? onGoUnlocks() : onGoContext())}>
              <span className="move-rank mono">{i + 1}</span>
              <div className="move-main">
                <div className="move-top"><span className="move-title">{m.title}</span><span className={"mtag mtag-" + m.tone}>{m.tag}</span></div>
                <div className="move-why">{m.why}</div>
              </div>
              <ChevronRight size={15} className="move-chev" />
            </button>
          ))}
        </div>
      ) : (
        <div className="ctx-empty">Nothing is gating you right now — you've cleared the readiness checks I track. Keep farming your endgame targets, and add any recent progress in Context to refresh this.</div>
      )}

      <div className="ctx-hint">Tap a move to open its details. The list re-ranks automatically as your stats and context change.</div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { k: "next", label: "Next", icon: <Zap size={20} /> },
    { k: "snapshot", label: "Account", icon: <Users size={20} /> },
    { k: "context", label: "Context", icon: <ListChecks size={20} /> },
    { k: "readiness", label: "Readiness", icon: <Target size={20} /> },
    { k: "unlocks", label: "Unlocks", icon: <Award size={20} /> },
  ];
  return (
    <nav className="nav"><div className="nav-inner">
      {items.map((i) => (
        <button key={i.k} className={"nav-btn" + (tab === i.k ? " nav-on" : "")} onClick={() => setTab(i.k)}>{i.icon}<span>{i.label}</span></button>
      ))}
    </div></nav>
  );
}

/* =============================== main =============================== */
export default function Lodestar({ onHome }) {
  const [tab, setTab] = useState("next");
  const [acct, setAcct] = useState(SAMPLE);
  const [rsn, setRsn] = usePersistent("lodestar.rsn", "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [doneQuests, setDoneQuests] = usePersistent("lodestar.quests", []);
  const [doneDiaries, setDoneDiaries] = usePersistent("lodestar.diaries", []);
  const [doneMinigames, setDoneMinigames] = usePersistent("lodestar.minigames", []);
  const [gp, setGp] = usePersistent("lodestar.gp", "");
  const [ownedUnlocks, setOwnedUnlocks] = usePersistent("lodestar.unlocks", []);
  const [boss, setBoss] = useState(null);
  const [unlock, setUnlock] = useState(null);

  const toggleQuest = (q) => setDoneQuests((p) => (p.includes(q) ? p.filter((x) => x !== q) : [...p, q]));
  const toggleOwned = (id) => setOwnedUnlocks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  // For the sample account, treat its implied quests as done so readiness/next read coherently.
  // Real accounts use only the user's confirmed quests; this never writes to the saved store.
  const dq = acct?.sample && acct.quests ? Array.from(new Set([...doneQuests, ...acct.quests])) : doneQuests;

  async function loadAccount(name) {
    const n = (name || "").trim();
    if (!n) return;
    setLoading(true); setError("");
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    try {
      const url = "https://api.wiseoldman.net/v2/players/" + encodeURIComponent(n);
      let res = await fetch(url, { method: "POST", signal: ctrl.signal });
      if (!res.ok) res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(res.status === 404 ? "Player not found on the hiscores. Check the spelling." : "Couldn't reach the tracker — try again.");
      const data = await res.json();
      const snap = data.latestSnapshot?.data || {};
      const skills = {}; let xp = 0;
      for (const [k, v] of Object.entries(snap.skills || {})) { skills[k] = v.level; if (k !== "overall") xp += v.experience || 0; }
      const bosses = {};
      for (const [k, v] of Object.entries(snap.bosses || {})) bosses[k] = v.kills > 0 ? v.kills : 0;
      setAcct({
        name: data.displayName || n, type: data.type || "ironman", combatLevel: Math.round(data.combatLevel || 0),
        skills, bosses, totalLevel: skills.overall || 0, _xp: xp, sample: false,
      });
      setRsn(n);
    } catch (e) {
      setError(e.name === "AbortError" ? "Timed out reaching the tracker." : (e.message || "Something went wrong."));
    } finally { clearTimeout(to); setLoading(false); }
  }

  useEffect(() => { if (rsn && rsn.trim()) loadAccount(rsn); /* auto-load saved name; falls back to sample in sandbox */ }, []);

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="bg-glow" /><div className="bg-noise" />
      <div className="wrap">
        <header className="hdr">
          <div className="brand">
            {onHome && <button className="icon-btn" onClick={onHome} title="All tools"><ArrowLeft size={18} /></button>}
            <div className="brand-mark"><Compass size={20} /></div>
            <div><div className="brand-name display">LODESTAR</div><div className="brand-sub">Ironman Progression</div></div>
          </div>
          {acct && !acct.sample && (
            <button className="icon-btn" onClick={() => loadAccount(rsn)} title="Refresh"><RefreshCw size={16} className={loading ? "spin" : ""} /></button>
          )}
        </header>

        {tab === "next" && <NextTab acct={acct} doneQuests={doneQuests} doneDiaries={doneDiaries} doneMinigames={doneMinigames} ownedUnlocks={ownedUnlocks} onOpenBoss={setBoss} onGoContext={() => setTab("context")} onGoUnlocks={() => setTab("unlocks")} />}
        {tab === "snapshot" && <SnapshotTab acct={acct} loading={loading} error={error} rsn={rsn} setRsn={setRsn} onLoad={() => loadAccount(rsn)} />}
        {tab === "context" && <ContextTab acct={acct} doneQuests={doneQuests} setDoneQuests={setDoneQuests} doneDiaries={doneDiaries} setDoneDiaries={setDoneDiaries} doneMinigames={doneMinigames} setDoneMinigames={setDoneMinigames} gp={gp} setGp={setGp} />}
        {tab === "readiness" && <ReadinessTab acct={acct} doneQuests={doneQuests} toggleQuest={toggleQuest} onOpen={setBoss} />}
        {tab === "unlocks" && <UnlocksTab acct={acct} onOpen={setUnlock} owned={ownedUnlocks} toggleOwned={toggleOwned} />}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
      {boss && <BossModal boss={boss} acct={acct} doneQuests={doneQuests} toggleQuest={toggleQuest} onClose={() => setBoss(null)} />}
      {unlock && <UnlockModal unlock={unlock} onClose={() => setUnlock(null)} owned={ownedUnlocks} toggleOwned={toggleOwned} />}
    </div>
  );
}

/* =============================== styles =============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
:root{
  --bg:#0a0c10; --card:#13171e; --card2:#171c25;
  --azure:#5cc8ff; --azure-bright:#8fd9ff; --azure-dim:#3a7da0;
  --gold:#e7b94a; --gold-bright:#f6cf6b;
  --ready:#48dd96; --warn:#f6cf6b; --no:#ff6b78;
  --text:#f3efe6; --muted:#9aa1ad; --muted2:#6b7280;
  --line:rgba(92,200,255,0.14); --line2:rgba(255,255,255,0.06);
}
*{box-sizing:border-box}
.display{font-family:'Cinzel',serif;letter-spacing:.02em}
.mono{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.app{position:relative;min-height:100vh;width:100%;background:var(--bg);color:var(--text);font-family:'Sora',sans-serif;overflow-x:hidden}
.bg-glow{position:fixed;inset:0;pointer-events:none;background:radial-gradient(900px 480px at 80% -10%,rgba(92,200,255,.10),transparent 60%),radial-gradient(700px 520px at 6% 4%,rgba(72,221,150,.045),transparent 55%)}
.bg-noise{position:fixed;inset:0;pointer-events:none;opacity:.025;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{position:relative;max-width:860px;margin:0 auto;padding:20px 16px 92px}
.row{display:flex}.gap{gap:12px}.gap-sm{gap:7px}

.hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:13px}
.brand-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#06151d;background:linear-gradient(135deg,var(--azure-bright),var(--azure-dim));box-shadow:0 6px 22px rgba(92,200,255,.28),inset 0 1px 0 rgba(255,255,255,.4)}
.brand-name{font-size:22px;font-weight:700;line-height:1;background:linear-gradient(180deg,#fff,var(--azure-bright));-webkit-background-clip:text;background-clip:text;color:transparent}
.brand-sub{font-size:11px;color:var(--muted);letter-spacing:.16em;text-transform:uppercase;margin-top:3px}
.icon-btn{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);transition:.16s}
.icon-btn:hover{color:var(--text);border-color:var(--line)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

.tabwrap{animation:fade .3s ease both}@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.tab-h{display:flex;align-items:center;gap:10px;margin-bottom:16px;color:var(--azure-bright)}
.tab-h h2{font-size:20px;font-weight:700;margin:0;color:var(--text)}
.sec-h{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600;margin:22px 0 11px}
.sec-h2{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600;margin:18px 0 10px}
.sub-note{text-transform:none;letter-spacing:normal;color:var(--muted2);font-weight:400;font-size:11px}
.btn-azure{display:inline-flex;align-items:center;gap:6px;justify-content:center;padding:11px 16px;border-radius:11px;border:1px solid var(--azure-dim);background:linear-gradient(135deg,rgba(92,200,255,.22),rgba(92,200,255,.08));color:var(--azure-bright);font-family:'Sora';font-size:13.5px;font-weight:600;cursor:pointer;transition:.16s;white-space:nowrap}
.btn-azure:hover{background:linear-gradient(135deg,rgba(92,200,255,.32),rgba(92,200,255,.14))}
.btn-azure:disabled{opacity:.5;cursor:default}

.load-card{background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:15px;padding:14px}
.load-row{display:flex;gap:9px}
.search{position:relative;display:flex;align-items:center;flex:1}
.search-ic{position:absolute;left:12px;color:var(--muted2)}
.search input{width:100%;padding:11px 12px 11px 36px;border-radius:11px;background:#0d1016;border:1px solid var(--line2);color:var(--text);font-family:'Sora';font-size:14px;outline:none;transition:.16s}
.search input:focus{border-color:var(--line);box-shadow:0 0 0 3px rgba(92,200,255,.08)}
.search input::placeholder{color:var(--muted2)}
.load-err{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--no);margin-top:10px}

.acct-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-top:18px}
.acct-name{font-size:21px;font-weight:700}
.acct-cb{text-align:center;background:linear-gradient(160deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:14px;padding:9px 16px}
.cb-val{font-size:24px;font-weight:700;color:var(--azure-bright);line-height:1}
.cb-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted2);margin-top:3px}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;padding:4px 9px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid var(--line2);color:var(--muted)}
.tag-type{color:var(--azure-bright);background:rgba(92,200,255,.08);border-color:rgba(92,200,255,.22)}
.tag-sample{color:var(--gold-bright);background:rgba(231,185,74,.08);border-color:rgba(231,185,74,.22)}
.tag-cat{color:var(--muted);background:rgba(255,255,255,.04)}

.acct-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
.akpi{background:linear-gradient(160deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:13px;padding:12px}
.akpi span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted2);font-weight:600}
.akpi b{display:block;font-size:18px;margin-top:6px;color:var(--text)}

.skill-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.skill-grid.combat{grid-template-columns:repeat(4,1fr)}
.skill{display:flex;flex-direction:column;align-items:center;gap:3px;background:var(--card);border:1px solid var(--line2);border-radius:10px;padding:9px 6px}
.combat-s{border-color:rgba(92,200,255,.18);background:linear-gradient(160deg,rgba(92,200,255,.06),var(--card))}
.sk-l{font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted2);font-weight:600}
.sk-v{font-size:16px;font-weight:700;color:var(--text)}

.kc-list{display:flex;flex-direction:column;gap:7px}
.kc-row{display:flex;justify-content:space-between;align-items:center;background:var(--card);border:1px solid var(--line2);border-radius:10px;padding:10px 13px;font-size:13px;color:var(--muted)}
.kc-row b{color:var(--text);font-size:13.5px}

.note{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;line-height:1.5;color:var(--muted2);background:rgba(255,255,255,.025);border:1px solid var(--line2);border-radius:11px;padding:11px 12px;margin-top:18px}
.note svg{color:var(--azure-bright);flex-shrink:0;margin-top:1px}
.note.thin{margin-top:0;margin-bottom:14px}
.note.thin svg{color:var(--gold-bright)}

.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;margin-bottom:14px}.chips::-webkit-scrollbar{display:none}
.chip{white-space:nowrap;padding:8px 14px;border-radius:20px;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);font-family:'Sora';font-size:12.5px;font-weight:500;transition:.16s}
.chip:hover{color:var(--text)}
.chip-on{background:linear-gradient(135deg,rgba(92,200,255,.18),rgba(92,200,255,.06));border-color:var(--azure-dim);color:var(--azure-bright)}

.ready-summary{display:flex;gap:10px;margin-bottom:16px}
.rs{flex:1;background:linear-gradient(160deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:13px;padding:13px;text-align:center}
.rs b{display:block;font-size:22px;font-weight:700;color:var(--text)}
.rs span{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted2);font-weight:600;margin-top:3px;display:block}

.pill{font-size:11px;font-weight:700;padding:5px 11px;border-radius:8px;white-space:nowrap}
.pill-ready{color:#06231a;background:linear-gradient(135deg,#5fe6a6,#36b97a)}
.pill-warn{color:#241f06;background:linear-gradient(135deg,#f7d978,#d8a82e)}
.pill-no{color:var(--no);background:rgba(255,107,120,.12);border:1px solid rgba(255,107,120,.3)}

.rcards{display:flex;flex-direction:column;gap:10px}
.rcard{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;cursor:pointer;background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:15px;padding:14px 15px;color:var(--text);font-family:'Sora';transition:.16s}
.rcard:hover{border-color:var(--line);transform:translateY(-2px)}
.rcard-main{min-width:0;flex:1}
.rcard-name{font-weight:600;font-size:15px}
.rcard-sub{font-size:11.5px;color:var(--muted2);margin-top:5px;line-height:1.4}
.rcard-kc{color:var(--azure-dim)}

.req-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.req{display:flex;align-items:center;gap:7px;background:rgba(255,107,120,.06);border:1px solid rgba(255,107,120,.18);border-radius:10px;padding:9px 11px;color:var(--no)}
.req.ok{background:rgba(72,221,150,.07);border-color:rgba(72,221,150,.2);color:var(--ready)}
.req-l{flex:1;font-size:12.5px;color:var(--text);font-weight:500}
.req-v{font-size:13px}.req-need{color:var(--muted2)}

.quest-list{display:flex;flex-direction:column;gap:7px}
.quest{display:flex;align-items:center;gap:9px;width:100%;text-align:left;cursor:pointer;background:var(--card);border:1px solid var(--line2);border-radius:10px;padding:10px 12px;color:var(--text);font-family:'Sora';font-size:13px;transition:.16s}
.quest.done{border-color:rgba(72,221,150,.3);color:var(--muted)}
.quest svg:nth-of-type(1){color:var(--azure-dim);flex-shrink:0}
.qbox{width:18px;height:18px;border-radius:6px;border:1.5px solid var(--muted2);display:grid;place-items:center;flex-shrink:0;color:#06231a}
.qbox.on{background:var(--ready);border-color:var(--ready)}

.info-sec{margin-top:16px}
.info-h{display:flex;align-items:center;gap:7px;font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:700;margin-bottom:8px}
.info-sec p{font-size:13.5px;line-height:1.6;color:var(--text);margin:0}
.chip-wrap{display:flex;flex-wrap:wrap;gap:6px}
.sup-chip{font-size:11.5px;font-weight:500;padding:5px 10px;border-radius:8px;background:rgba(72,221,150,.08);border:1px solid rgba(72,221,150,.18);color:var(--ready)}

.ucards{display:flex;flex-direction:column;gap:9px}
.ucard{display:flex;align-items:center;gap:0;width:100%;background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:14px;transition:.16s}
.ucard:hover{border-color:var(--line)}
.ucard.owned{opacity:.5}
.uown{flex-shrink:0;align-self:center;width:24px;height:24px;margin-left:14px;border-radius:7px;border:1.5px solid var(--muted2);background:transparent;display:grid;place-items:center;cursor:pointer;color:#06231a;transition:.13s}
.uown:hover{border-color:var(--ready)}
.uown.on{background:var(--ready);border-color:var(--ready)}
.ucard-body{flex:1;display:flex;align-items:center;gap:13px;min-width:0;padding:13px 15px;background:none;border:none;cursor:pointer;text-align:left;color:var(--text);font-family:'Sora'}
.utier{flex-shrink:0;width:30px;height:30px;border-radius:8px;border:1.5px solid;display:grid;place-items:center;font-family:'Cinzel';font-weight:700;font-size:15px}
.utier.big{width:44px;height:44px;font-size:22px;border-radius:11px}
.umain{flex:1;min-width:0}
.uname{font-weight:600;font-size:14.5px}
.ueffect{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45}
.uchev{color:var(--muted2);flex-shrink:0}
.own-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:18px;padding:12px;border-radius:11px;border:1px solid var(--line2);background:var(--card);color:var(--muted);font-family:'Sora';font-size:13.5px;font-weight:600;cursor:pointer;transition:.16s}
.own-btn:hover{color:var(--text);border-color:var(--line)}
.own-btn.on{background:rgba(72,221,150,.1);border-color:rgba(72,221,150,.3);color:var(--ready)}

.overlay{position:fixed;inset:0;z-index:50;background:rgba(5,7,10,.72);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:fadeo .2s ease}
@keyframes fadeo{from{opacity:0}to{opacity:1}}
.sheet{width:100%;max-width:560px;max-height:92vh;overflow-y:auto;background:linear-gradient(180deg,var(--card2),var(--bg));border:1px solid var(--line);border-bottom:none;border-radius:24px 24px 0 0;padding:20px;animation:slideup .28s cubic-bezier(.2,.8,.2,1)}
@keyframes slideup{from{transform:translateY(40px);opacity:.5}to{transform:none;opacity:1}}
.sheet::-webkit-scrollbar{width:8px}.sheet::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px}
.sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px}
.sheet-name{font-size:19px;font-weight:600}

.nav{position:fixed;bottom:0;left:0;right:0;z-index:40;background:rgba(10,12,16,.85);backdrop-filter:blur(16px);border-top:1px solid var(--line2)}
.nav-inner{max-width:860px;margin:0 auto;display:grid;grid-template-columns:repeat(5,1fr);padding:8px 8px calc(8px + env(safe-area-inset-bottom))}
.nav-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 0;background:none;border:none;cursor:pointer;color:var(--muted2);font-family:'Sora';font-size:10.5px;font-weight:600;transition:.16s}
.nav-btn:hover{color:var(--muted)}
.nav-on{color:var(--azure-bright)}
.nav-on svg{filter:drop-shadow(0 0 8px rgba(92,200,255,.4))}

.seg{display:flex;gap:5px;background:var(--card);border:1px solid var(--line2);border-radius:13px;padding:5px;margin-bottom:16px}
.seg.sub{margin-bottom:14px}
.seg-b{flex:1;padding:9px 6px;border-radius:9px;border:none;cursor:pointer;background:transparent;color:var(--muted);font-family:'Sora';font-size:12.5px;font-weight:600;transition:.16s}
.seg-b:hover{color:var(--text)}
.seg-on{background:linear-gradient(135deg,rgba(92,200,255,.2),rgba(92,200,255,.08));color:var(--azure-bright);box-shadow:0 1px 8px rgba(92,200,255,.12)}

.ctx-sec{margin-bottom:20px}
.ctx-h{display:flex;align-items:center;gap:7px;font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:700;margin-bottom:10px}
.trows{display:flex;flex-direction:column;gap:7px}
.trow{display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;background:var(--card);border:1px solid var(--line2);border-radius:11px;padding:12px 13px;color:var(--text);font-family:'Sora';transition:.13s}
.trow:hover{border-color:var(--line)}
.trow.on{background:linear-gradient(150deg,rgba(72,221,150,.07),var(--card));border-color:rgba(72,221,150,.22)}
.tbox{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--muted2);display:grid;place-items:center;flex-shrink:0;color:#06231a;transition:.13s}
.tbox.on{background:var(--ready);border-color:var(--ready)}
.trow-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.trow-l{font-size:13.5px;font-weight:500}
.trow-sub{font-size:11px;color:var(--muted2);line-height:1.35}
.trow.on .trow-l{color:var(--muted)}

.ctx-empty{font-size:12.5px;color:var(--muted2);line-height:1.5;background:rgba(255,255,255,.025);border:1px dashed var(--line2);border-radius:11px;padding:14px}
.ctx-grow{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;line-height:1.5;color:var(--muted);background:rgba(92,200,255,.05);border:1px solid rgba(92,200,255,.14);border-radius:11px;padding:12px;margin-top:4px}
.ctx-grow svg{color:var(--azure-bright);flex-shrink:0;margin-top:1px}
.link-btn{background:none;border:none;color:var(--azure-bright);font-family:'Sora';font-size:11.5px;font-weight:700;cursor:pointer;padding:0;text-decoration:underline}

.search.sm{margin-bottom:11px}
.search.sm input{padding:10px 12px 10px 34px;font-size:13px}
.browse-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px}
.browse-meta span{font-size:12px;color:var(--muted);font-weight:600}
.bulk{display:flex;gap:7px}
.bulk button{padding:6px 12px;border-radius:8px;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);font-family:'Sora';font-size:11.5px;font-weight:600;transition:.16s}
.bulk button:hover{color:var(--azure-bright);border-color:var(--azure-dim)}

.diaries{display:flex;flex-direction:column;gap:8px}
.diary{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--card);border:1px solid var(--line2);border-radius:12px;padding:11px 13px}
.diary-head{display:flex;align-items:center;gap:9px;min-width:0}
.diary-name{font-size:13.5px;font-weight:500}
.diary-count{font-size:12px;color:var(--muted2)}
.diary-tiers{display:flex;gap:6px;flex-shrink:0}
.tier{width:30px;height:30px;border-radius:8px;border:1.5px solid var(--line2);background:transparent;color:var(--muted2);font-family:'JetBrains Mono';font-size:12px;font-weight:700;cursor:pointer;transition:.13s}
.tier:hover{border-color:var(--azure-dim);color:var(--text)}
.tier.on{background:linear-gradient(135deg,var(--ready),#36b97a);border-color:var(--ready);color:#06231a}
.ctx-hint{font-size:11px;color:var(--muted2);margin-top:11px;text-align:center;line-height:1.5}

.bank-card{background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:15px;padding:16px}
.bank-sub{font-size:12px;color:var(--muted);line-height:1.55;margin:0 0 14px}
.gp-in{display:flex;align-items:center;gap:8px;background:#0d1016;border:1px solid var(--line2);border-radius:11px;padding:12px 14px}
.gp-in input{flex:1;background:none;border:none;outline:none;color:var(--text);font-family:'JetBrains Mono';font-size:19px;font-weight:700;width:100%}
.gp-in input::placeholder{color:var(--muted2)}
.gp-suffix{font-family:'JetBrains Mono';font-size:14px;color:var(--muted2);font-weight:600}
.gp-echo{font-size:13px;color:var(--gold-bright);margin-top:9px;text-align:right}
.gp-chips{display:flex;gap:7px;margin-top:13px}
.gp-chips button{flex:1;padding:9px;border-radius:9px;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--muted);font-family:'JetBrains Mono';font-size:12.5px;font-weight:700;transition:.16s}
.gp-chips button:hover{color:var(--gold-bright);border-color:rgba(231,185,74,.3)}

.bottleneck{background:linear-gradient(150deg,rgba(246,207,107,.1),rgba(246,207,107,.03));border:1px solid rgba(246,207,107,.28);border-radius:15px;padding:15px;margin-bottom:20px}
.bn-label{display:flex;align-items:center;gap:6px;font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--warn);font-weight:700}
.bn-label svg{color:var(--warn)}
.bn-skill{font-family:'Cinzel',serif;font-size:19px;font-weight:600;color:var(--text);margin-top:8px;display:flex;align-items:baseline;gap:8px}
.bn-cur{font-size:15px;color:var(--warn)}
.bn-text{font-size:13px;color:var(--muted);line-height:1.55;margin-top:6px}
.bn-text b{color:var(--text)}

.moves{display:flex;flex-direction:column;gap:9px}
.move{display:flex;align-items:flex-start;gap:12px;width:100%;text-align:left;cursor:pointer;background:linear-gradient(150deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:14px;padding:14px;color:var(--text);font-family:'Sora';transition:.16s}
.move:hover{border-color:var(--line);transform:translateY(-2px)}
.move-rank{flex-shrink:0;width:24px;height:24px;border-radius:7px;background:rgba(92,200,255,.1);border:1px solid var(--azure-dim);color:var(--azure-bright);display:grid;place-items:center;font-size:12px;font-weight:700;margin-top:1px}
.move-main{flex:1;min-width:0}
.move-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.move-title{font-size:14.5px;font-weight:600}
.move-why{font-size:12px;color:var(--muted);line-height:1.5;margin-top:5px}
.move-chev{color:var(--muted2);flex-shrink:0;margin-top:3px}
.mtag{font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
.mtag-ready{color:#06231a;background:linear-gradient(135deg,#5fe6a6,#36b97a)}
.mtag-warn{color:#241f06;background:linear-gradient(135deg,#f7d978,#d8a82e)}
.mtag-azure{color:var(--azure-bright);background:rgba(92,200,255,.12);border:1px solid rgba(92,200,255,.25)}
.mtag-gold{color:var(--gold-bright);background:rgba(231,185,74,.12);border:1px solid rgba(231,185,74,.28)}

@media(max-width:640px){
  .skill-grid{grid-template-columns:repeat(3,1fr)}
  .acct-kpis{grid-template-columns:1fr 1fr 1fr}
  .brand-name{font-size:19px}
  .req-grid{grid-template-columns:1fr 1fr}
}
`;
