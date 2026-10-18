// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, render} from "@testing-library/react";
import {EventBrandLogo, EventBrandProvider} from "./EventBrandLogo";
import {EventLoading} from "./EventLoading";

const LOGO = "https://api.example.test/api/events/e1/logo/f1";
const KEY = `cib:event-logo:${window.location.host}`;

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const crestOf = (c: HTMLElement) => c.querySelector('img[src*="crest"]');

it("shows no crest and no image while the branding is unknown", () => {
    const {container} = render(<EventBrandProvider logoURL={null}><EventLoading full /></EventBrandProvider>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".event-loading-logo")).not.toBeNull();
});

it("keeps the box size while unknown", () => {
    const {container} = render(<EventBrandProvider logoURL={null}><EventBrandLogo size={32} className="x" /></EventBrandProvider>);
    const box = container.querySelector<HTMLElement>(".x")!;
    expect(box.style.width).toBe("32px");
    expect(box.style.height).toBe("32px");
});

it("uses the remembered logo at once while the branding is unknown", () => {
    window.localStorage.setItem(KEY, LOGO);
    const {container} = render(<EventBrandProvider logoURL={null}><EventBrandLogo /></EventBrandProvider>);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(LOGO);
});

it("shows the crest at once when the remembered branding has no logo", () => {
    window.localStorage.setItem(KEY, "");
    const {container} = render(<EventBrandProvider logoURL={null}><EventBrandLogo /></EventBrandProvider>);
    expect(crestOf(container)).not.toBeNull();
});

it("shows the crest only when the known branding has no logo", () => {
    const {container} = render(<EventBrandProvider logoURL=""><EventBrandLogo /></EventBrandProvider>);
    expect(crestOf(container)).not.toBeNull();
});

it("shows the event logo from the first render when it is known", () => {
    const {container} = render(<EventBrandProvider logoURL={LOGO}><EventBrandLogo /></EventBrandProvider>);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(LOGO);
    expect(crestOf(container)).toBeNull();
});

it("remembers the known logo for the next load and forgets a removed one", () => {
    render(<EventBrandProvider logoURL={LOGO}><span /></EventBrandProvider>);
    expect(window.localStorage.getItem(KEY)).toBe(LOGO);
    cleanup();
    render(<EventBrandProvider logoURL=""><span /></EventBrandProvider>);
    expect(window.localStorage.getItem(KEY)).toBe("");
});

it("does not remember when persisting is off", () => {
    render(<EventBrandProvider logoURL="" persist={false}><span /></EventBrandProvider>);
    expect(window.localStorage.getItem(KEY)).toBeNull();
});

it("clears the remembered branding when the access is denied", async () => {
    const {clearCachedBrand} = await import("@/utils/eventBrandCache");
    window.localStorage.setItem(KEY, LOGO);
    window.localStorage.setItem(`cib:event-favicon:${window.location.host}`, LOGO);
    clearCachedBrand();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(`cib:event-favicon:${window.location.host}`)).toBeNull();
});

it("clears the remembered branding on sign-out", async () => {
    const {signOut} = await import("@/api/authAPI");
    window.localStorage.setItem(KEY, LOGO);
    const fetchMock = vi.fn(async () => new Response("{}", {status: 200}));
    vi.stubGlobal("fetch", fetchMock);
    await signOut();
    vi.unstubAllGlobals();
    expect(window.localStorage.getItem(KEY)).toBeNull();
});

it("clears the remembered branding on the not-found screen", async () => {
    window.localStorage.setItem(KEY, LOGO);
    const {render: r} = await import("@testing-library/react");
    const {QueryClient, QueryClientProvider} = await import("@tanstack/react-query");
    const {EventUnavailableScreen} = await import("./EventUnavailableScreen");
    r(<QueryClientProvider client={new QueryClient()}><EventUnavailableScreen /></QueryClientProvider>);
    expect(window.localStorage.getItem(KEY)).toBeNull();
});
