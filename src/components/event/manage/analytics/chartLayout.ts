// A chart about as narrow as a phone screen (a phone, or a small card on a desktop) cannot use the desktop layout:
// the paged legend gets tiny arrows, the zoom slider is too small for a finger and the axis labels run together.
export const COMPACT_CHART_WIDTH = 480;

type Option = Record<string, unknown>;
const LEGEND_ROW = 22;
const LEGEND_CHAR = 7;
const LEGEND_ITEM = 25 + 10;

// Rows the plain (wrapping) legend takes at this width: names of the series laid out like ECharts does.
function legendRows(option: Option, width: number): number {
    const series = Array.isArray(option.series) ? option.series as Array<{name?: unknown}> : [];
    let rows = 1;
    let used = 0;
    for (const item of series) {
        if (typeof item.name !== "string" || !item.name) continue;
        const size = Math.min(width, LEGEND_ITEM + item.name.length * LEGEND_CHAR);
        if (used > 0 && used + size > width) {rows += 1; used = 0;}
        used += size;
    }
    return rows;
}

function withAxisLabels(axis: unknown): unknown {
    if (Array.isArray(axis)) return axis.map(withAxisLabels);
    if (!axis || typeof axis !== "object") return axis;
    const value = axis as Option;
    return {...value, axisLabel: {...(value.axisLabel as Option | undefined), hideOverlap: true}};
}

// The phone layout of an analytics chart: the whole legend wraps over the plot, the zoom works by pinch and drag
// only, and overlapping axis labels are hidden. Wider charts keep their option as it is.
export function compactChartOption(option: Option, width: number): Option {
    if (width <= 0 || width > COMPACT_CHART_WIDTH) return option;
    const next: Option = {...option, xAxis: withAxisLabels(option.xAxis)};
    const grid = {...(option.grid as Option | undefined)};
    if (option.legend && typeof option.legend === "object" && !Array.isArray(option.legend)) {
        // A name longer than the chart is cut with «…» instead of running off both sides.
        const legend = option.legend as Option;
        next.legend = {...legend, type: "plain", top: 0, left: 0, itemGap: 10, textStyle: {...legend.textStyle as Option | undefined, width: Math.max(80, width - LEGEND_ITEM - 8), overflow: "truncate"}};
        // Under the legend: room for the labels of the start / freeze / finish lines.
        grid.top = Math.max(Number(grid.top ?? 0), legendRows(option, width) * LEGEND_ROW + 30);
    }
    if (Array.isArray(option.dataZoom)) {
        const zoom = option.dataZoom as Option[];
        const kept = zoom.filter(item => item.type !== "slider");
        if (kept.length !== zoom.length) {
            next.dataZoom = kept;
            grid.bottom = Math.min(Number(grid.bottom ?? 0), 32);
        }
    }
    if (option.grid) next.grid = grid;
    return next;
}
