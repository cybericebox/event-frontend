import {afterEach, expect, it, vi} from "vitest";
// Real helpers (nothing mocked but the network readers): a server call into a client-only module must surface here.
const server = vi.hoisted(() => ({manifest: vi.fn()}));
vi.mock("next/headers", () => ({cookies: async () => ({get: () => undefined}), headers: async () => new Headers({"x-event-pathname": "/manage", host: "khctf.cybericebox.com"})}));
vi.mock("geist/font/sans", () => ({GeistSans: {variable: "sans"}}));
vi.mock("geist/font/mono", () => ({GeistMono: {variable: "mono"}}));
vi.mock("@/api/publicEventInfo", () => ({getPublicEventInfo: async () => null, PublicEventError: class extends Error {}}));
vi.mock("@/api/commonPage", () => ({getCommonManifest: server.manifest, readContext: async () => ({claims: {preview: true, exp: 9999999999}}), RenderReadError: class extends Error {}}));
import RootLayout, {generateMetadata} from "./layout";
const granted = {EventID: "e", Name: "Hidden", LogoURL: "/api/events/e/logo/abc", FaviconURL: "/api/events/e/favicon/abc", Theme: {Brand: "#123456", AccentLight: "#1", AccentDark: "#2", AccentLive: "#3"}};
afterEach(() => vi.clearAllMocks());

it("renders the layout of a granted staff event without throwing", async () => {
    server.manifest.mockResolvedValue({Audience: "staff", Event: granted});
    await expect(RootLayout({children: null})).resolves.toBeTruthy();
});

it("builds the metadata of a granted staff event", async () => {
    server.manifest.mockResolvedValue({Audience: "staff", Event: granted});
    await expect(generateMetadata()).resolves.toMatchObject({title: "Hidden"});
});
