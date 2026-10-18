// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {act, cleanup, render} from "@testing-library/react";
vi.mock("@/utils/eventLogoURL", () => ({resolveEventLogoURL: (url: string) => url}));
import {useEventFavicon} from "./useEventFavicon";

function Probe({favicon, metadata}: {favicon: string; metadata: boolean}) {
    useEventFavicon(favicon);
    return metadata ? <><link rel="icon" href="/platform-favicon.ico" /><link rel="icon" href="/other.ico" sizes="32x32" /></> : null;
}
afterEach(() => {cleanup(); document.head.innerHTML = "";});

it("leaves the icon link React owns in the head, so React can remove it on navigation", async () => {
    const view = render(<Probe favicon="/event.png" metadata />);
    const link = document.head.querySelector('link[rel="icon"]');
    expect(link?.getAttribute("href")).toBe("/event.png");
    // Route metadata changes: React removes its hoisted link. It must still be attached.
    await act(async () => {view.rerender(<Probe favicon="/event.png" metadata={false} />);});
    expect(document.head.querySelectorAll('link[rel="icon"]').length).toBe(1);
    expect(document.head.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("/event.png");
});

it("adds an icon link when the page has none", () => {
    render(<Probe favicon="/event.png" metadata={false} />);
    expect(document.head.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("/event.png");
});
