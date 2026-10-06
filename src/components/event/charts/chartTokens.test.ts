// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {resolveChartTokens} from "./chartTokens";
import {scoreChartOption} from "@/components/event/scoreboard/ScoreChart";
import {pointsChartOption} from "@/components/event/participation/participationCharts";

afterEach(() => {document.documentElement.removeAttribute("style");});

describe("chart colours come from DS tokens", () => {
    it("options name tokens, never hard-coded greys", () => {
        const option = JSON.stringify([
            scoreChartOption({snapshot: {Scoreboard: [], Timeline: []} as never, teamIDs: [], startTime: new Date(0), finishTime: new Date(1)}),
            pointsChartOption([{name: "A", color: "#000", points: []}], {from: 0, to: 1}),
        ]);
        expect(option).toContain("var(--ib-dim)");
        expect(option).not.toMatch(/#64748b|#cbd5e1|#e2e8f0/i);
    });

    it("resolves var(--token) strings in a deep copy using the current value of the token", () => {
        document.documentElement.style.setProperty("--ib-dim", "rgb(1, 2, 3)");
        const source = {legend: {textStyle: {color: "var(--ib-dim)"}}, series: [{color: "#123456", name: "x"}]};
        const resolved = resolveChartTokens(source);
        expect(resolved.legend.textStyle.color).toBe("rgb(1, 2, 3)");
        expect(resolved.series[0]).toEqual({color: "#123456", name: "x"});
        expect(source.legend.textStyle.color).toBe("var(--ib-dim)");
        document.documentElement.style.setProperty("--ib-dim", "rgb(9, 9, 9)");
        expect(resolveChartTokens(source).legend.textStyle.color).toBe("rgb(9, 9, 9)");
    });
});
