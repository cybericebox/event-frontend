import {describe, expect, it} from "vitest";
import {compactChartOption, COMPACT_CHART_WIDTH} from "./chartLayout";

const option = {
    grid: {left: 44, right: 16, top: 36, bottom: 64},
    legend: {type: "scroll", top: 0, textStyle: {color: "x"}},
    xAxis: {type: "time", axisLabel: {color: "x"}},
    yAxis: {type: "value"},
    dataZoom: [{type: "inside", filterMode: "none"}, {type: "slider", height: 18, bottom: 8, filterMode: "none"}],
    series: [{name: "Розвʼязання"}, {name: "Неправильні відповіді"}, {name: "Спроби"}, {name: "Правильні відповіді"}, {name: "Відкриття завдань"}],
};

describe("compactChartOption (a chart narrower than a phone screen)", () => {
    it("keeps a wide chart as it is", () => {
        expect(compactChartOption(option, COMPACT_CHART_WIDTH + 1)).toBe(option);
        expect(compactChartOption(option, 0)).toBe(option);
    });

    it("wraps the whole legend over the plot instead of paging it, and makes room for it", () => {
        const compact = compactChartOption(option, 320) as typeof option;
        expect(compact.legend.type).toBe("plain");
        expect(compact.grid.top).toBeGreaterThan(36 + 22);
    });

    it("drops the zoom slider (pinch and drag still zoom) and gives its room back", () => {
        const compact = compactChartOption(option, 320) as typeof option;
        expect(compact.dataZoom).toEqual([{type: "inside", filterMode: "none"}]);
        expect(compact.grid.bottom).toBeLessThan(64);
    });

    it("hides axis labels that would overlap", () => {
        const compact = compactChartOption(option, 320) as {xAxis: {axisLabel: {hideOverlap: boolean; color: string}}};
        expect(compact.xAxis.axisLabel).toEqual({color: "x", hideOverlap: true});
    });

    it("leaves a chart without a legend or a zoom alone apart from the labels", () => {
        const plain = {grid: {top: 8, bottom: 8}, xAxis: [{type: "category"}], yAxis: {type: "value"}, series: [{name: "a"}]};
        expect(compactChartOption(plain, 320)).toEqual({...plain, xAxis: [{type: "category", axisLabel: {hideOverlap: true}}]});
    });
});
