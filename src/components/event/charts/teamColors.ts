import type {ManageResultsSnapshot} from "@/api/manageResults";

// Team line colours of every score chart: the results page, the live screen and its editor previews.
//
// Palette: 15 colours picked for the background the lines are drawn on, at the largest smallest distance between any
// two. Distance is OKLab with the blue–yellow axis (and a little of red–green) weakened: a thin line seen from far,
// the live screen at 15–20 m, loses those first. Every colour keeps 3:1 to the background, is not a grey (grey is
// «others») and stays in one lightness band, so no line is pale or dark next to the rest (owner, 2026-10-25).
//
// Slots: a team keeps its colour while it is in the top 15. A team that drops out frees its slot and the team that
// comes in takes it. The slots are replayed from the solve history, so every screen, a reload and the participant
// page give each team the same colour.

export const teamChartSlots = 15;

type Rgb = [number, number, number];
type Lab = [number, number, number];

const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function oklab([r, g, b]: Rgb): Lab {
    const [lr, lg, lb] = [channel(r), channel(g), channel(b)];
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function contrast(a: Rgb, b: Rgb): number {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
}

// The distance of two colours as thin lines seen from far.
export function lineDistance(a: Lab, b: Lab): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + 0.8 * (a[1] - b[1]) ** 2 + 0.45 * (a[2] - b[2]) ** 2);
}

// #RGB, #RRGGBB or rgb()/rgba(); null for anything else.
export function parseColor(value: string): Rgb | null {
    const text = value.trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex) {
        const digits = hex[1].length === 3 ? [...hex[1]].map(char => char + char).join("") : hex[1];
        return [0, 2, 4].map(index => parseInt(digits.slice(index, index + 2), 16)) as Rgb;
    }
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map(item => Math.round(Math.min(255, Math.max(0, item)))) as Rgb : null;
}

const toHex = (rgb: Rgb) => `#${rgb.map(item => item.toString(16).padStart(2, "0")).join("")}`;

type Candidate = {hex: string; lab: Lab};

// Colours on a 12-step sRGB grid that pass the background rules. The band widens (and the contrast floor drops a
// little) only when a mid-tone brand leaves too few colours for a good pick.
function candidates(background: Rgb, count: number): Candidate[] {
    const dark = oklab(background)[0] < 0.6;
    const [low, high] = dark ? [0.68, 0.84] : [0.48, 0.62];
    let found: Candidate[] = [];
    for (let widen = 0; widen <= 0.2 && found.length < count * 40; widen += 0.04) {
        const floor = widen > 0.1 ? 2.5 : 3;
        found = [];
        for (let r = 0; r <= 255; r += 12) for (let g = 0; g <= 255; g += 12) for (let b = 0; b <= 255; b += 12) {
            const rgb: Rgb = [r, g, b];
            const lab = oklab(rgb);
            if (lab[0] < low - widen || lab[0] > high + widen || Math.hypot(lab[1], lab[2]) < 0.08 || contrast(rgb, background) < floor) continue;
            found.push({hex: toHex(rgb), lab});
        }
    }
    return found;
}

const palettes = new Map<string, string[]>();

// The 15 line colours for `background` (any CSS colour parseColor reads; others fall back to the dark default).
export function teamPalette(background: string, count = teamChartSlots): string[] {
    const rgb = parseColor(background) ?? [12, 21, 18];
    const key = `${toHex(rgb)}/${count}`;
    const cached = palettes.get(key);
    if (cached) return cached;
    const pool = candidates(rgb, count);
    const ground = oklab(rgb);
    const nearest = (item: Candidate, others: Candidate[]) => others.reduce((min, other) => Math.min(min, lineDistance(item.lab, other.lab)), lineDistance(item.lab, ground));
    const closest = (set: Candidate[]) => Math.min(...set.map((item, index) => nearest(item, set.filter((_, other) => other !== index))));
    // Greedy farthest-point pick from a few spread starting colours, then each colour in turn moves to the spot farthest
    // from the others until none moves; the start that ends with the most distant closest pair wins.
    let picked: Candidate[] = [];
    for (let start = 0; start < 4; start++) {
        const set: Candidate[] = [pool[Math.floor(pool.length * (start + 0.5) / 4)]].filter(Boolean);
        while (set.length < count && pool.length) set.push(pool.reduce((best, item) => nearest(item, set) > nearest(best, set) ? item : best));
        for (let pass = 0, moved = true; moved && pass < 40; pass++) {
            moved = false;
            for (let index = 0; index < set.length; index++) {
                const others = set.filter((_, other) => other !== index);
                const best = pool.reduce((top, item) => nearest(item, others) > nearest(top, others) ? item : top);
                if (nearest(best, others) > nearest(set[index], others) + 1e-9) {
                    set[index] = best;
                    moved = true;
                }
            }
        }
        if (!picked.length || closest(set) > closest(picked)) picked = set;
    }
    const result = picked.map(item => item.hex);
    while (result.length < count) result.push(result[result.length % Math.max(1, picked.length)] ?? "#3987e5");
    palettes.set(key, result);
    return result;
}

type Results = Pick<ManageResultsSnapshot, "Scoreboard" | "Timeline">;

// The slot (0–14) of every team in the top 15, replayed from the solve history.
export function teamSlots(results: Results | undefined, size = teamChartSlots): Map<string, number> {
    const slots = new Map<string, number>();
    if (!results) return slots;
    const rank = new Map(results.Scoreboard.map((team, index) => [team.TeamID, index]));
    const settle = (top: string[]) => {
        const keep = new Set(top);
        for (const id of [...slots.keys()]) if (!keep.has(id)) slots.delete(id);
        for (const id of top) {
            if (slots.has(id)) continue;
            const used = new Set(slots.values());
            let slot = 0;
            while (used.has(slot)) slot++;
            slots.set(id, slot);
        }
    };
    const points = new Map<string, number>();
    const reached = new Map<string, string>();
    const solves = results.Timeline.filter(item => rank.has(item.EventTeamID))
        .sort((a, b) => a.SolvedAt.localeCompare(b.SolvedAt) || rank.get(a.EventTeamID)! - rank.get(b.EventTeamID)!);
    for (const solve of solves) {
        points.set(solve.EventTeamID, (points.get(solve.EventTeamID) ?? 0) + solve.Points);
        reached.set(solve.EventTeamID, solve.SolvedAt);
        settle([...points.keys()].filter(id => points.get(id)! > 0)
            .sort((a, b) => points.get(b)! - points.get(a)! || reached.get(a)!.localeCompare(reached.get(b)!) || rank.get(a)! - rank.get(b)!)
            .slice(0, size));
    }
    // The shown ranking has the last word (a freeze, a manual correction, teams with no points yet).
    settle(results.Scoreboard.slice(0, size).map(team => team.TeamID));
    return slots;
}

// Team → line colour for the teams in the top 15.
export function teamColors(results: Results | undefined, background: string): Map<string, string> {
    const palette = teamPalette(background);
    return new Map([...teamSlots(results)].map(([id, slot]) => [id, palette[slot]]));
}
