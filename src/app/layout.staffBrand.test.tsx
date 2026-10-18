import {isValidElement, type ReactNode} from "react";
import {afterEach, expect, it, vi} from "vitest";
const server = vi.hoisted(() => ({
    path: "/manage",
    claims: null as null | {preview: boolean; exp: number},
    manifest: vi.fn(),
    preload: vi.fn(),
    cookie: undefined as string | undefined,
}));
vi.mock("next/headers", () => ({cookies: async () => ({get: (name: string) => name === "cib_participant_preview" && server.cookie ? {value: server.cookie} : undefined}), headers: async () => new Headers({"x-event-pathname": server.path})}));
vi.mock("geist/font/sans", () => ({GeistSans: {variable: "sans"}}));
vi.mock("geist/font/mono", () => ({GeistMono: {variable: "mono"}}));
vi.mock("react-dom", async () => ({...(await vi.importActual<object>("react-dom")), preload: server.preload}));
vi.mock("@/api/publicEventInfo", () => ({getPublicEventInfo: async () => null, PublicEventError: class extends Error {}}));
vi.mock("@/api/commonPage", () => ({getCommonManifest: server.manifest, readContext: async () => ({claims: server.claims}), RenderReadError: class extends Error {}}));
import RootLayout from "./layout";
import {EventBrandProvider} from "@/components/event/EventBrandLogo";
import {AppShell} from "@/components/event/AppShell";

function find(node: ReactNode, type: unknown): Record<string, unknown> | undefined {
    if (!isValidElement<{children?: ReactNode}>(node)) return;
    if (node.type === type) return node.props as Record<string, unknown>;
    for (const child of [node.props.children].flat(Infinity) as ReactNode[]) {
        const props = find(child, type);
        if (props) return props;
    }
}
const hidden = {EventID: "e", Name: "Hidden", LogoURL: "https://cdn.example.test/logo.png", FaviconURL: "", Theme: {Brand: "#123456", AccentLight: "#1", AccentDark: "#2", AccentLive: "#3"}};
afterEach(() => {server.cookie = undefined; server.path = "/manage"; server.claims = null; vi.clearAllMocks();});

it("puts the logo of a hidden event in the first HTML of /manage when the request has a staff grant", async () => {
    server.claims = {preview: true, exp: 9999999999};
    server.manifest.mockResolvedValue({Audience: "staff", Event: hidden});
    const tree = await RootLayout({children: <main />});
    expect(find(tree, EventBrandProvider)).toMatchObject({logoURL: "https://cdn.example.test/logo.png"});
    expect(find(tree, AppShell)).toMatchObject({event: null});
    expect(server.preload).toHaveBeenCalledWith("https://cdn.example.test/logo.png", {as: "image"});
    expect(server.manifest).toHaveBeenCalledWith();
});

it("keeps the placeholder without a grant and asks the render API nothing", async () => {
    const tree = await RootLayout({children: <main />});
    expect(find(tree, EventBrandProvider)).toMatchObject({logoURL: null, persist: false});
    expect(server.manifest).not.toHaveBeenCalled();
    expect(server.preload).not.toHaveBeenCalled();
});

it("keeps the placeholder when the render read fails", async () => {
    server.claims = {preview: true, exp: 9999999999};
    server.manifest.mockRejectedValue(new Error("down"));
    expect(find(await RootLayout({children: <main />}), EventBrandProvider)).toMatchObject({logoURL: null});
});

it("ignores a manifest that is not the staff audience", async () => {
    server.claims = {preview: true, exp: 9999999999};
    server.manifest.mockResolvedValue({Audience: "public", Event: hidden});
    expect(find(await RootLayout({children: <main />}), EventBrandProvider)).toMatchObject({logoURL: null});
});

it("hands the participant preview cookie to the shell so the first render hides staff UI", async () => {
    server.cookie = "event-1";
    expect(find(await RootLayout({children: <main />}), AppShell)).toMatchObject({previewCookie: "event-1"});
    server.cookie = "bad value;";
    expect(find(await RootLayout({children: <main />}), AppShell)).toMatchObject({previewCookie: null});
});
