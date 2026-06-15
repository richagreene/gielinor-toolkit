/* Frontend data access for the Coffer feed.
   The heavy math already ran in the pipeline; here we just fetch the ranked
   universe and slice/sort it instantly using the engine's own SORTS/PRESETS. */
import { SORTS, PRESETS } from "./coffer-engine.js";

/* >>> EDIT THIS <<<  your GitHub "owner/repo" (the repo must be PUBLIC so the
   raw feed URL is fetchable from the browser without a token). */
const OWNER_REPO = "richagreene/gielinor-toolkit";
const DATA_URL = `https://raw.githubusercontent.com/${OWNER_REPO}/data/flips.json`;

export async function fetchFeed() {
  // bust the ~5-min CDN cache once a minute so the feed stays fresh
  const r = await fetch(`${DATA_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Flip feed unavailable — has the Action published the data branch yet?");
  return r.json(); // { generatedAt, count, universe, items:[...] }
}

export function view(items, opts = {}) {
  const { preset, sort, filters = {}, bankroll } = opts;
  const p = preset && PRESETS[preset] ? PRESETS[preset] : {};
  const f = { ...(p.filters || {}), ...filters };
  let rows = items.filter((r) =>
    (f.membersOk === false ? !r.members : true) &&
    (f.minFill == null || r.pFill >= f.minFill) &&
    (f.minMargin == null || r.netMargin >= f.minMargin) &&
    (f.maxBuy == null || r.buy <= f.maxBuy) &&
    (f.minBuy == null || r.buy >= f.minBuy) &&
    (f.minLiq == null || r.liqPerHr >= f.minLiq) &&
    (f.excludeManip ? !r.manip : true) &&
    (f.maxCapital == null || r.capital <= f.maxCapital)
  );
  rows = rows.slice().sort(SORTS[sort || p.sort || "ev"]);
  if (bankroll) rows = rows.map((r) => ({ ...r, kellyGp: Math.round((r.kelly || 0) * bankroll) }));
  return rows;
}

export const PRESET_NAMES = Object.keys(PRESETS);
export const SORT_KEYS = Object.keys(SORTS);
export const ago = (generatedAt) => {
  const s = Math.floor(Date.now() / 1000) - generatedAt;
  return s < 90 ? "just now" : s < 3600 ? Math.round(s / 60) + "m ago" : Math.round(s / 3600) + "h ago";
};
