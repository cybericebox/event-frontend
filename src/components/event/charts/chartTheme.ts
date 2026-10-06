// The DS chart theme (docs/design-system/components/chart-theme) for ECharts options: text, axes, legend, tooltip,
// palette and line style come from --ib-* tokens, so both themes and the event brand work. Options name colours as
// «var(--token)»; chartTokens.ts turns them into real colours when the chart renders. Values an option already sets win.

export const chartSeries = Array.from({length: 10}, (_, index) => `var(--ib-s${index + 1})`);
export const chartAxisText = "var(--ib-chart-axis)";
export const chartLegendText = "var(--ib-chart-legend)";
export const chartGridLine = "var(--ib-chart-grid)";
export const chartAxisLine = "var(--ib-chart-line)";
export const chartOwn = "var(--ib-s-own)";

const FONT = "Geist, system-ui, sans-serif";

type Plain = Record<string, unknown>;
const isPlain = (value: unknown): value is Plain => !!value && typeof value === "object" && !Array.isArray(value);

// Missing keys are filled from `defaults`, nested objects are merged, anything the option sets itself is kept.
function fill<T>(value: T, defaults: Plain): T {
    if (!isPlain(value)) return (value === undefined ? defaults : value) as T;
    const result: Plain = {...value};
    for (const [key, item] of Object.entries(defaults)) {
        result[key] = isPlain(item) && isPlain(result[key]) ? fill(result[key], item) : result[key] ?? item;
    }
    return result as T;
}

const each = (value: unknown, change: (item: Plain) => Plain) => Array.isArray(value) ? value.map(item => change(isPlain(item) ? item : {})) : isPlain(value) ? change(value) : value;

function pixels(name: string, fallback: number): number {
    if (typeof document === "undefined") return fallback;
    const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isNaN(value) ? fallback : value;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function withChartTheme<T>(option: T): T {
    if (!isPlain(option)) return option;
    const axis = pixels("--ib-chart-fs-axis", 12);
    const legend = pixels("--ib-chart-fs-legend", 13);
    const width = pixels("--ib-chart-lw", 2);
    const axisStyle = (item: Plain) => fill(item, {
        axisLine: {lineStyle: {color: chartAxisLine}},
        axisTick: {lineStyle: {color: chartAxisLine}},
        axisLabel: {color: chartAxisText, fontSize: axis, fontFamily: FONT},
        nameTextStyle: {color: chartAxisText, fontSize: axis, fontFamily: FONT},
        splitLine: {lineStyle: {color: chartGridLine}},
    });
    const result: Plain = fill(option as Plain, {
        color: chartSeries,
        animation: !reducedMotion(),
        textStyle: {fontFamily: FONT, fontSize: axis, color: chartAxisText},
        tooltip: {
            backgroundColor: "var(--ib-tip-bg)", borderColor: "var(--ib-tip-line)", borderWidth: 1,
            textStyle: {color: "var(--ib-tip-fg)", fontSize: 13, fontFamily: FONT}, extraCssText: "box-shadow:none;border-radius:6px",
        },
    });
    if (result.xAxis) result.xAxis = each(result.xAxis, axisStyle);
    if (result.yAxis) result.yAxis = each(result.yAxis, axisStyle);
    if (result.legend) result.legend = each(result.legend, item => fill(item, {textStyle: {color: chartLegendText, fontSize: legend, fontFamily: FONT}}));
    if (result.dataZoom) result.dataZoom = each(result.dataZoom, item => item.type === "inside" ? fill(item, {zoomOnMouseWheel: "ctrl", moveOnMouseMove: true}) : item);
    if (Array.isArray(result.series)) {
        result.series = result.series.map(item => isPlain(item) && item.type === "line"
            ? fill(item, {smooth: true, smoothMonotone: "x", lineStyle: {width}})
            : item);
    }
    return result as T;
}
