import {describe, expect, it} from "vitest";
import {lineDistance, parseColor, teamPalette, teamSlots} from "./teamColors";

const lab = (hex: string) => {
    const [r, g, b] = parseColor(hex)!.map(value => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s] as [number, number, number];
};
const closest = (palette: string[]) => Math.min(...palette.flatMap((a, i) => palette.slice(i + 1).map(b => lineDistance(lab(a), lab(b)))));

describe("teamPalette", () => {
    it.each([["#0C1512"], ["#211A52"], ["#1E40AF"], ["#F7F7F9"], ["#FFFFFF"], ["#E8A33D"]])("gives 15 distinct colours on %s", background => {
        const palette = teamPalette(background);
        expect(palette).toHaveLength(15);
        expect(new Set(palette).size).toBe(15);
        expect(closest(palette)).toBeGreaterThan(0.07);
    });

    it("beats the old palette by far on a dark brand", () => {
        expect(closest(teamPalette("#0C1512"))).toBeGreaterThan(0.11);
    });

    it("is the same for the same background in any notation", () => {
        expect(teamPalette("rgb(12, 21, 18)")).toEqual(teamPalette("#0c1512"));
    });
});

const team = (id: string, points: number) => ({TeamID: id, TeamName: id, Points: points}) as never;
const solve = (id: string, minute: number, points: number) => ({EventTeamID: id, SolvedAt: `2026-10-25T10:${String(minute).padStart(2, "0")}:00Z`, Points: points}) as never;

describe("teamSlots", () => {
    it("keeps a team's slot when places change", () => {
        const slots = teamSlots({Scoreboard: [team("b", 300), team("a", 100)], Timeline: [solve("a", 1, 100), solve("b", 2, 300)]}, 2);
        expect(slots.get("a")).toBe(0);
        expect(slots.get("b")).toBe(1);
    });

    it("gives the freed slot to the team that comes in", () => {
        const slots = teamSlots({
            Scoreboard: [team("c", 500), team("a", 200), team("b", 100)],
            Timeline: [solve("a", 1, 200), solve("b", 2, 100), solve("c", 3, 500)],
        }, 2);
        expect(slots.get("a")).toBe(0);
        expect(slots.get("c")).toBe(1);
        expect(slots.has("b")).toBe(false);
    });

    it("follows the shown ranking for teams with no points", () => {
        const slots = teamSlots({Scoreboard: [team("x", 0), team("y", 0), team("z", 0)], Timeline: []}, 2);
        expect([...slots]).toEqual([["x", 0], ["y", 1]]);
    });
});
