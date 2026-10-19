import {describe, expect, it} from "vitest";
import {funnelOption} from "./reportCharts";

describe("report funnel", () => {
    it("names a step the frontend does not know neutrally, never by its i18n key", () => {
        const option = funnelOption([{Key: "registered", Count: 10}, {Key: "checked_in", Count: 4}], "participants");
        expect(option.yAxis.data).toEqual(["Зареєструвалися", "Інший етап"]);
    });
});
