import {describe, expect, it} from "vitest";
import {defaultLiveLayout, type LiveLayout} from "@/api/manageLive";
import {liveEstimateWidth, liveListGeometry, livePageSecondsHint, liveTableFit, liveTimerFit, liveTitleFit} from "./liveFit";
import {liveCanvasSize, liveListFit, liveSafeInsets, liveTextSize, liveWidgetBox} from "./liveText";

describe("live fit", () => {
    it("grows the timer digits and label with the widget", () => {
        const small = liveTimerFit({width: 300, height: 100, digits: 8, label: "До завершення", labelSize: "m"});
        const big = liveTimerFit({width: 900, height: 300, digits: 8, label: "До завершення", labelSize: "m"});
        expect(big.digits).toBeCloseTo(small.digits * 3);
        expect(big.label).toBeGreaterThan(small.label);
        expect(big.digits * 8 * 0.62).toBeLessThanOrEqual(900 + 1e-6);
    });

    it("scales the label with its size setting but keeps it inside the width", () => {
        const base = {width: 800, height: 400, digits: 8, label: "Старт", labelSize: "m" as const};
        expect(liveTimerFit({...base, labelSize: "l"}).label).toBeGreaterThan(liveTimerFit(base).label);
        expect(liveTimerFit({...base, labelSize: "s"}).label).toBeLessThan(liveTimerFit(base).label);
        const long = liveTimerFit({...base, label: "Дуже довгий підпис над таймером для перевірки ширини"});
        expect(long.label * 52 * 0.56).toBeLessThanOrEqual(800 + 1e-6);
    });

    it("splits the list height exactly across N rows", () => {
        const geometry = liveListGeometry({height: 600, caption: 20, body: 24, rows: 16, header: true});
        expect(geometry.rowHeight * 16).toBeCloseTo(600 - 20 * 1.8 - 20 * 1.7);
        expect(geometry.maxRows).toBe(Math.floor((600 - 70) / (24 * 1.75)));
        expect(geometry.readable).toBe(16 <= geometry.maxRows);
    });

    it("suggests a page time from the rows", () => {
        expect(livePageSecondsHint(10)).toBe(9);
        expect(livePageSecondsHint(1)).toBe(3);
    });

    it("fits the event name into the widget width", () => {
        const fit = liveTitleFit({width: 600, height: 100, name: "Дуже довга назва заходу для перевірки", subtitle: true, logo: true});
        expect(fit.name * 37 * 0.56).toBeLessThanOrEqual(600 - 78 - 30 + 1e-6);
        expect(fit.subtitle).toBeCloseTo(fit.name * 0.5);
    });

    it("keeps the timer label at the caption floor on a 720p projector; the freeze badge takes its place when low", () => {
        // The 3×1 timer of the default layout at 1280×720.
        const box = {width: 3 * 1280 / 12 - 16, height: 720 / 8 - 16};
        const plain = liveTimerFit({...box, digits: 8, label: "До кінця: Етап 1", labelSize: "m", labelMin: 18, digitsMin: 40});
        expect(plain.label).toBeGreaterThanOrEqual(18);
        expect(plain.digits).toBeGreaterThanOrEqual(40);
        const frozen = liveTimerFit({...box, digits: 8, label: "До кінця: Етап 1", labelSize: "m", badge: "Заморожено о 10:59", labelMin: 18, digitsMin: 40});
        expect(frozen.labelShown).toBe(false);
        expect(frozen.badge).toBeGreaterThanOrEqual(18);
        expect(frozen.digits).toBeGreaterThanOrEqual(40);
        // A tall timer keeps all three lines.
        const tall = liveTimerFit({width: 600, height: 300, digits: 8, label: "До кінця: Етап 1", labelSize: "m", badge: "Заморожено о 10:59", labelMin: 18, digitsMin: 40});
        expect(tall.labelShown).toBe(true);
        expect(tall.badge).toBeGreaterThanOrEqual(18);
    });

    it("keeps the subtitle at the caption floor under a long event name", () => {
        const fit = liveTitleFit({width: 600, height: 100, name: "Дуже довга назва заходу для перевірки підзаголовка на екрані", subtitle: true, logo: true, subtitleMin: 18});
        expect(fit.subtitle).toBe(18);
    });
});

// The default layout's table on a real screen edge to edge (no safe area), with 15 teams.
function tableAt(width: number, height: number) {
    const layout: LiveLayout = {...defaultLiveLayout, screen: {...defaultLiveLayout.screen, width, height, safeArea: 0}};
    const table = layout.widgets.find(item => item.type === "table")!;
    const box = liveWidgetBox(layout, table);
    const geometry = liveListFit(layout, table);
    const body = liveTextSize("body", height, 1, width).effective;
    return {box, geometry, body};
}

const names = ["Команда 12", "IceBreakers", "Кібер-Кіборги Харківщини", "Frontend NullPointers United"];

describe("live table fit", () => {
    for (const [width, height] of [[1280, 720], [1280, 800]]) {
        it(`keeps every team name readable at ${width}×${height}`, () => {
            const {box, geometry, body} = tableAt(width, height);
            const fit = liveTableFit({width: box.width, rowHeight: geometry.rowHeight, body, rankChars: 2, pointsChars: 5, names});
            // The rank and points columns follow their digits and leave the name 55% of the row.
            expect(fit.rankWidth + fit.pointsWidth).toBeLessThanOrEqual(box.width * 0.45 + 1e-6);
            expect(fit.font).toBeGreaterThanOrEqual(body);
            // «Команда 12» keeps the full row size on one line.
            expect(fit.names[0]).toEqual({font: fit.font, lines: 1});
            fit.names.forEach((name, index) => {
                expect(name.font).toBeGreaterThanOrEqual(body);
                // The whole name fits its lines: no «…».
                const room = (fit.nameWidth - 0.9 * fit.font) * name.lines * (name.lines === 2 ? 0.9 : 1);
                expect(liveEstimateWidth(names[index], name.font)).toBeLessThanOrEqual(room + 1e-6);
            });
        });
    }

    it("does not let the rank and points columns grow with tall rows", () => {
        const {box, body} = tableAt(1280, 720);
        const tall = liveTableFit({width: box.width, rowHeight: 200, body, rankChars: 2, pointsChars: 5, names});
        expect(tall.rankWidth + tall.pointsWidth).toBeLessThanOrEqual(box.width * 0.45 + 1e-6);
        expect(tall.nameWidth).toBeGreaterThanOrEqual(box.width * 0.55 - 1e-6);
    });

    it("ends a name with «…» only below the body size", () => {
        const fit = liveTableFit({width: 300, rowHeight: 36, body: 20, rankChars: 2, pointsChars: 5, names: ["Харківський національний університет радіоелектроніки, команда 1"]});
        expect(fit.names[0]).toEqual({font: 20, lines: 1});
    });
});

describe("live safe area", () => {
    it("insets the canvas by 0, 2.5 or 5% of each side", () => {
        expect(liveSafeInsets(1280, 720, 0)).toEqual({x: 0, y: 0});
        expect(liveSafeInsets(1280, 720, 2.5)).toEqual({x: 32, y: 18});
        expect(liveSafeInsets(1920, 1080, 5)).toEqual({x: 96, y: 54});
        const layout: LiveLayout = {...defaultLiveLayout, screen: {...defaultLiveLayout.screen, safeArea: 5}};
        expect(liveCanvasSize(layout)).toEqual({width: 1728, height: 972});
        // Unknown values count as no margin.
        expect(liveCanvasSize({...layout, screen: {...layout.screen, safeArea: 7}})).toEqual({width: 1920, height: 1080});
    });
});
