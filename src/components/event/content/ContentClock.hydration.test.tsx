// @vitest-environment jsdom
import {act} from "react";
import {renderToString} from "react-dom/server";
import {hydrateRoot, type Root} from "react-dom/client";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {afterEach, expect, it, vi} from "vitest";
import {LiveContentBlocks} from "./LiveContentBlocks";
import type {ContentDocument} from "@/types/eventContent";

const initialNow = Date.parse("2026-10-16T10:00:00Z");
let root: Root | undefined;
afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    root = undefined;
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function page(content: ContentDocument, variables: Record<string, string>, displayTime = initialNow) {
    const client = new QueryClient();
    return <QueryClientProvider client={client}><LiveContentBlocks eventID="event" revision="r1" document={content} initialVariables={variables} initialNow={displayTime} /></QueryClientProvider>;
}

it.each(["segments", "compact"] as const)("renders %s digits in server HTML and hydrates without replacing the banner", async display => {
    vi.useFakeTimers();
    vi.setSystemTime(initialNow + 5000);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const content: ContentDocument = {blocks: [
        {id: "banner", type: "banner", imageSource: "custom", imageURL: "/banner.png"},
        {id: "timer", type: "countdown", targetVariable: "event.startAt", timerDisplay: display},
    ]};
    const view = page(content, {"event.startAt": new Date(initialNow + 3_723_000).toISOString()});
    const container = document.createElement("div");
    container.innerHTML = renderToString(view);
    document.body.append(container);
    const image = container.querySelector("img");
    const timer = container.querySelector('[role="timer"]');
    expect(timer?.textContent).not.toContain("—");
    expect(timer?.textContent).toContain(display === "compact" ? "01:02:03" : "03");
    const initialHTML = container.innerHTML;
    const recovery = vi.fn();
    await act(async () => { root = hydrateRoot(container, view, {onRecoverableError: recovery}); });
    expect(recovery).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe(initialHTML);
    await act(async () => { frames.splice(0).forEach(callback => callback(0)); });
    expect(timer?.textContent).toContain(display === "compact" ? "01:01:58" : "58");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(timer?.textContent).toContain(display === "compact" ? "01:01:57" : "57");
    expect(container.querySelector("img")).toBe(image);
    expect(container.querySelector('[role="timer"]')).toBe(timer);
});

it("keeps lifecycle visibility on the server clock through hydration before applying a crossed boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(initialNow + 5000);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const start = new Date(initialNow + 1000).toISOString();
    const content: ContentDocument = {blocks: [
        {id: "phase", type: "text", richText: {root: {type: "root", children: [{type: "paragraph", children: [{type: "variable", varName: "event.phase"}]}]}}},
        {id: "timer", type: "countdown", targetDate: new Date(initialNow + 60_000).toISOString(), dateSource: "custom", showFromSource: "custom", showFromDate: start},
    ]};
    const view = page(content, {"event.startAt": start, "event.phase": "published"});
    const container = document.createElement("div");
    container.innerHTML = renderToString(view);
    document.body.append(container);
    expect(container.textContent).toBe("published");
    expect(container.querySelector('[role="timer"]')).toBeNull();
    const recovery = vi.fn();
    await act(async () => { root = hydrateRoot(container, view, {onRecoverableError: recovery}); });
    expect(container.textContent).toBe("published");
    expect(recovery).not.toHaveBeenCalled();
    await act(async () => { frames.splice(0).forEach(callback => callback(0)); });
    expect(container.textContent).toContain("started");
    expect(container.querySelector('[role="timer"]')).not.toBeNull();
});
