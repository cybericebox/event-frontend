import {describe, expect, it} from "vitest";
import {liveListGeometry, livePageSecondsHint, liveTimerFit, liveTitleFit} from "./liveFit";

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
});
