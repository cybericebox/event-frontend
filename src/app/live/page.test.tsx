// @vitest-environment jsdom
import {describe, expect, it, vi} from "vitest";
import {renderToString} from "react-dom/server";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {defaultLiveLayout} from "@/api/manageLive";

const start = vi.hoisted(() => vi.fn());
vi.mock("@/api/liveScreenServer", () => ({getLiveScreenStart: start}));
vi.mock("@/components/event/live/LiveQR", () => ({LiveQR: () => null}));

const page = await import("./page");
const loading = await import("./loading");

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "krctf", Name: "Kharkiv Regional CTF", StartTime: new Date(Date.now() - 3600_000).toISOString(), FinishTime: null, Status: 2,
    Participation: 1, Registration: 1, CanViewResults: true, CanViewParticipants: true, PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    Theme: {Brand: "#7A1F3D", Accent: "", AccentLight: "#7A1F3D", AccentDark: "#E6E6EE", AccentLive: "#FFD166", Version: 1},
};

async function html(token?: string) {
    const element = await page.default({searchParams: Promise.resolve(token ? {token} : {})});
    const client = new QueryClient();
    return renderToString(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

describe("the /live page on the server", () => {
    it("renders the screen in the event's style in the first HTML", async () => {
        start.mockResolvedValue({kind: "ok", screen: {Event: event, Layout: defaultLiveLayout, Stages: []}, serverNow: Date.now()});
        const out = await html("tok");
        expect(out).toContain("--ev-brand:#7A1F3D");
        expect(out).toContain("--ev-accent-live:#FFD166");
        expect(out).toContain("live-canvas");
        expect(out).toContain("live-widget--table");
        expect(out).toContain("Kharkiv Regional CTF");
        // No full-screen loader first; until the results arrive the data blocks show the logo, never «no results yet».
        expect(out).not.toContain("live-fullscreen--state");
        expect(out).toContain("event-block-state");
        expect(out).not.toContain("Результатів поки немає");
    });

    it("renders the neutral «not found» page on the server for a missing or unpublished event", async () => {
        start.mockResolvedValue({kind: "notFound"});
        const out = await html("tok");
        expect(out).toContain("Захід не знайдено");
        expect(out).toContain("live-neutral");
        expect(out).not.toContain("--ev-brand");
    });

    it("is dynamic, uncached, and asks for no referrer", async () => {
        expect(page.dynamic).toBe("force-dynamic");
        expect(page.fetchCache).toBe("force-no-store");
        start.mockResolvedValue({kind: "ok", screen: {Event: event, Layout: defaultLiveLayout, Stages: []}, serverNow: Date.now()});
        const metadata = await page.generateMetadata({searchParams: Promise.resolve({token: "tok"})});
        expect(metadata.referrer).toBe("no-referrer");
        expect(metadata.title).toBe("Результати наживо · Kharkiv Regional CTF");
    });

    it("waits for the link on the dark live surface with the crest, not in the light site shell", () => {
        const out = renderToString(<loading.default />);
        expect(out).toContain("live-fullscreen--state");
        expect(out).toContain("event-loading-logo");
        expect(out).not.toContain("event-shell-state");
    });
});
