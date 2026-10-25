// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import {ScoreChart} from "./ScoreChart";

const chart = vi.hoisted(() => ({dispatchAction: vi.fn(), getDataURL: vi.fn(), onZoom: null as null | ((event: {start: number; end: number}) => void), onLegend: null as null | ((event: {selected: Record<string, boolean>}) => void), option: null as null | {legend: {selected?: Record<string, boolean>}}}));
vi.mock("@/components/event/charts/chartTokens", () => ({useChartTokens: (option: unknown) => option, resolveToken: () => "#ffffff", useResolvedToken: () => "#ffffff"}));
vi.mock("echarts-for-react", async () => {
    const {forwardRef, useImperativeHandle} = await import("react");
    return {default: forwardRef(function MockChart({onEvents, option}: {onEvents: {datazoom: typeof chart.onZoom; legendselectchanged?: typeof chart.onLegend}; option: NonNullable<typeof chart.option>}, ref) {
        chart.onZoom = onEvents.datazoom;
        chart.onLegend = onEvents.legendselectchanged ?? null;
        chart.option = option;
        useImperativeHandle(ref, () => ({getEchartsInstance: () => chart}));
        return <div data-testid="chart-canvas" />;
    })};
});

it("keeps a team hidden through zoom changes and refreshed chart options", () => {
    const view = showChart();
    act(() => chart.onLegend!({selected: {Альфа: false, Бета: true}}));
    fireEvent.click(screen.getByRole("button", {name: "Збільшити масштаб"}));
    expect(chart.option!.legend.selected).toEqual({Альфа: false, Бета: true});
    view.rerender(<ScoreChart snapshot={{...snapshot, Revision: 2}} teamIDs={[]} startTime={new Date("2026-10-20T10:00:00Z")} finishTime={new Date("2026-10-20T12:30:00Z")} />);
    expect(chart.option!.legend.selected).toEqual({Альфа: false, Бета: true});
});

const snapshot = {Scoreboard: [], Timeline: []} as unknown as ManageResultsSnapshot;
function showChart() {
    return render(<ScoreChart snapshot={snapshot} teamIDs={[]} startTime={new Date("2026-10-20T10:00:00Z")} finishTime={new Date("2026-10-20T12:00:00Z")} title="Динаміка балів" />);
}
beforeEach(() => {chart.dispatchAction.mockReset(); chart.getDataURL.mockReset().mockReturnValue("data:image/png;base64,cGlj");});
afterEach(() => {cleanup(); vi.restoreAllMocks();});

it("zooms in and out around the current view, including a range selected on the graph", () => {
    showChart();
    fireEvent.click(screen.getByRole("button", {name: "Збільшити масштаб"}));
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({type: "dataZoom", start: 10, end: 90});
    expect(screen.getByLabelText("Масштаб графіка").textContent).toBe("125%");
    fireEvent.click(screen.getByRole("button", {name: "Зменшити масштаб"}));
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({type: "dataZoom", start: 0, end: 100});
    act(() => chart.onZoom!({start: 10, end: 30}));
    expect(screen.getByLabelText("Масштаб графіка").textContent).toBe("500%");
    fireEvent.click(screen.getByRole("button", {name: "Збільшити масштаб"}));
    expect(screen.getByLabelText("Масштаб графіка").textContent).toBe("525%");
    const range = chart.dispatchAction.mock.lastCall![0];
    expect((range.start + range.end) / 2).toBeCloseTo(20);
    fireEvent.click(screen.getByRole("button", {name: "Скинути масштаб"}));
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({type: "dataZoom", start: 0, end: 100});
    expect(screen.getByRole("button", {name: "Скинути масштаб"}).hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Масштаб графіка").textContent).toBe("100%");
});

it("changes the zoom in 25 percentage point steps", () => {
    showChart();
    for (const percent of [125, 150, 175, 200]) {
        fireEvent.click(screen.getByRole("button", {name: "Збільшити масштаб"}));
        expect(screen.getByLabelText("Масштаб графіка").textContent).toBe(`${percent}%`);
    }
    fireEvent.click(screen.getByRole("button", {name: "Зменшити масштаб"}));
    expect(screen.getByLabelText("Масштаб графіка").textContent).toBe("175%");
});

it("downloads a PNG of the current graph with its theme background", () => {
    const downloaded: {href: string; name: string}[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {downloaded.push({href: this.href, name: this.download});});
    showChart();
    fireEvent.click(screen.getByRole("button", {name: "Зберегти PNG"}));
    expect(chart.getDataURL).toHaveBeenCalledWith({type: "png", pixelRatio: 2, backgroundColor: "#ffffff", excludeComponents: ["dataZoom"]});
    expect(downloaded).toEqual([{href: "data:image/png;base64,cGlj", name: "results.png"}]);
});
