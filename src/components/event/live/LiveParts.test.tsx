// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render} from "@testing-library/react";
import {PageProgress} from "./LiveParts";

afterEach(cleanup);

describe("page progress bar", () => {
    it("keeps its start offset while the clock ticks, so it fills at the page's own pace", () => {
        const {container, rerender} = render(<PageProgress key={3} seconds={10} elapsed={2} />);
        const bar = () => container.querySelector(".live-list__progress") as HTMLElement;
        expect(bar().style.animationDelay).toBe("-2s");
        rerender(<PageProgress key={3} seconds={10} elapsed={3} />);
        rerender(<PageProgress key={3} seconds={10} elapsed={4} />);
        expect(bar().style.animationDelay).toBe("-2s");
        // The next page starts a new bar from its own offset.
        rerender(<PageProgress key={4} seconds={10} elapsed={0} />);
        expect(bar().style.animationDelay).toMatch(/^-?0s$/);
    });
});
