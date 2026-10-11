// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, render, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {ManagerBootstrap} from "./ManagerBootstrap";

vi.mock("./ManagerShell", () => ({ManagerShell: ({children}: {children: ReactNode}) => <>{children}</>}));
vi.mock("@/api/clientEventInfo", () => ({getClientEventInfo: () => new Promise(() => {})}));

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "test", Name: "Test",
    StartTime: "2026-09-28T00:00:00Z", FinishTime: null, Status: 2,
    Participation: 0, Registration: 1, CanViewResults: false, CanViewParticipants: false,
    PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 10,
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} satisfies PublicEventInfo;
const firstIcon = `/api/events/${event.EventID}/favicon/01900000-0000-7000-8000-000000000002`;
const secondIcon = `/api/events/${event.EventID}/favicon/01900000-0000-7000-8000-000000000003`;
const icons = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
afterEach(() => {cleanup(); icons().forEach(icon => icon.remove());});

function mount(data?: PublicEventInfo) {
    const initial = document.createElement("link");
    initial.rel = "icon"; initial.href = "/platform-favicon.ico";
    document.head.append(initial);
    const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: Infinity}}});
    if (data) client.setQueryData(["event-manager-public-info"], data);
    render(<QueryClientProvider client={client}><ManagerBootstrap><p>Appearance</p></ManagerBootstrap></QueryClientProvider>);
    return client;
}

describe("manager favicon", () => {
    it("restores the saved icon after loading authenticated event info", async () => {
        mount({...event, FaviconURL: firstIcon});
        await waitFor(() => expect(icons()[0].getAttribute("href")).toBe(`https://api.example.test${firstIcon}`));
        expect(icons()).toHaveLength(1);
    });

    it("applies a saved replacement and removal in the current tab", async () => {
        const client = mount({...event, FaviconURL: firstIcon});
        await act(async () => {client.setQueryData(["event-manager-public-info"], {...event, FaviconURL: secondIcon});});
        await waitFor(() => expect(icons()[0].getAttribute("href")).toBe(`https://api.example.test${secondIcon}`));
        await act(async () => {client.setQueryData(["event-manager-public-info"], event);});
        await waitFor(() => expect(icons()[0].getAttribute("href")).toBe("/platform-favicon.ico"));
        expect(icons()).toHaveLength(1);
    });

    it("keeps the current icon while the event info is pending", () => {
        mount();
        expect(icons()[0].getAttribute("href")).toBe("/platform-favicon.ico");
    });

    it("keeps the latest icon when stale route metadata replaces it", async () => {
        mount({...event, FaviconURL: firstIcon});
        await waitFor(() => expect(icons()[0].getAttribute("href")).toBe(`https://api.example.test${firstIcon}`));
        icons()[0].setAttribute("href", "/platform-favicon.ico");
        await waitFor(() => expect(icons()[0].getAttribute("href")).toBe(`https://api.example.test${firstIcon}`));
    });
});
