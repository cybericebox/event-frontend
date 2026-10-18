import {isValidElement, type ReactNode} from "react";
import {afterEach, expect, it, vi} from "vitest";
const server = vi.hoisted(() => ({event: null as null | Record<string, unknown>, preload: vi.fn(), grant: false, staff: null as null | Record<string, unknown>}));
vi.mock("next/headers", () => ({headers: async () => new Headers({"x-event-pathname": "/"})}));
vi.mock("geist/font/sans", () => ({GeistSans: {variable: "sans"}}));
vi.mock("geist/font/mono", () => ({GeistMono: {variable: "mono"}}));
vi.mock("react-dom", async () => ({...(await vi.importActual<object>("react-dom")), preload: server.preload}));
vi.mock("@/api/publicEventInfo", () => ({getPublicEventInfo: async () => server.event, PublicEventError: class extends Error {}}));
vi.mock("@/api/commonPage", () => ({getCommonManifest: async () => (server.staff ? {Audience: "staff", Event: server.staff} : null), readContext: async () => (server.grant ? {claims: {preview: true}} : null), RenderReadError: class extends Error {}}));
import RootLayout from "./layout";
import {EventBrandProvider} from "@/components/event/EventBrandLogo";

function brandProps(node: ReactNode): Record<string, unknown> | undefined {
    if (!isValidElement<{children?: ReactNode}>(node)) return;
    if (node.type === EventBrandProvider) return node.props as Record<string, unknown>;
    for (const child of [node.props.children].flat(Infinity) as ReactNode[]) {
        const props = brandProps(child);
        if (props) return props;
    }
}
afterEach(() => {server.event = null; server.grant = false; server.staff = null; vi.clearAllMocks();});

it("includes the logo of a public event in the first render and preloads it", async () => {
    server.event = {EventID: "e", Name: "Open", LogoURL: "https://cdn.example.test/logo.png", Theme: {Brand: "#123456"}};
    const props = brandProps(await RootLayout({children: <main />}));
    expect(props).toMatchObject({logoURL: "https://cdn.example.test/logo.png", persist: false});
    expect(server.preload).toHaveBeenCalledWith("https://cdn.example.test/logo.png", {as: "image"});
});

it("leaves the branding unknown when the server cannot see the event", async () => {
    const props = brandProps(await RootLayout({children: <main />}));
    expect(props).toMatchObject({logoURL: null, persist: false});
    expect(server.preload).not.toHaveBeenCalled();
});

it("keeps a known event without a logo as «no logo»", async () => {
    server.event = {EventID: "e", Name: "Open", LogoURL: "", Theme: {Brand: "#123456"}};
    expect(brandProps(await RootLayout({children: <main />}))).toMatchObject({logoURL: ""});
});

it("renders the event logo of a hidden event for staff with a valid grant on a personal route", async () => {
    server.grant = true;
    server.staff = {EventID: "e", Name: "Hidden", LogoURL: "https://cdn.example.test/hidden.png", FaviconURL: "", Theme: {Brand: "#123456"}};
    const props = brandProps(await RootLayout({children: <main />}));
    expect(props).toMatchObject({logoURL: "https://cdn.example.test/hidden.png", name: "Hidden", persist: true});
    expect(server.preload).toHaveBeenCalledWith("https://cdn.example.test/hidden.png", {as: "image"});
});

it("keeps the branding unknown without a grant even if the render route would answer", async () => {
    server.staff = {EventID: "e", Name: "Hidden", LogoURL: "https://cdn.example.test/hidden.png", Theme: {Brand: "#123456"}};
    expect(brandProps(await RootLayout({children: <main />}))).toMatchObject({logoURL: null});
});
