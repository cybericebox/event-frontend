// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ComponentType} from "react";

const api = vi.hoisted(() => ({general: vi.fn(), appearance: vi.fn(), lifecycle: vi.fn(), config: vi.fn()}));
const config = {Participation: 0, PreviewDescription: "Description", PreviewPicture: "", ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 30, FinishCountdownMode: "before_end", Theme: {Brand: "#211A52", Accent: "", Version: 1}};
const lifecycle = {Configured: true, JoinPolicy: 0, Status: "not_published", PublishAt: "2026-10-12T08:00:00Z", StartAt: "2026-10-12T10:00:00Z", FinishAt: null, WithdrawAt: null, Infrastructure: {CanStart: true}, LabPolicy: null};
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e", Name: "Event", LogoURL: null}, canManage: true})}));
vi.mock("@/components/event/manage/StagesManager", () => ({StagesManager: () => null}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null, resolveEventLogoURL: (url: string) => url}));
vi.mock("@/api/manage", async original => ({...await original() as object, getManageName: async () => ({Name: "Event"}), getManageConfig: async () => config, getManageLifecycle: async () => lifecycle, putManageGeneral: (...args: unknown[]) => api.general(...args), putManageAppearance: (...args: unknown[]) => api.appearance(...args), putManageLifecycle: (...args: unknown[]) => api.lifecycle(...args), putManageConfig: (...args: unknown[]) => api.config(...args)}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));
import General from "./settings/page";
import Appearance from "./appearance/page";
import Schedule from "./schedule/page";

afterEach(() => {cleanup(); Object.values(api).forEach(mock => mock.mockReset());});
function mount(Component: ComponentType) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const result = render(<QueryClientProvider client={client}><Component /></QueryClientProvider>);
    return {...result, client};
}

describe("acknowledged event settings", () => {
    it.each([General, Appearance, Schedule])("never submits a clean form with Enter (%s)", async Component => {
        const {container} = mount(Component);
        await waitFor(() => expect(container.querySelectorAll("form").length).toBeGreaterThan(0));
        for (const button of screen.getAllByRole("button", {name: /^Зберегти/})) expect(button).toHaveProperty("disabled", true);
        container.querySelectorAll("form").forEach(form => fireEvent.submit(form));
        Object.values(api).forEach(mock => expect(mock).not.toHaveBeenCalled());
    });

    it("disables Save after reverting the effective name", async () => {
        mount(General);
        const name = await screen.findByDisplayValue("Event") as HTMLInputElement;
        fireEvent.change(name, {target: {value: "New Event"}});
        expect(screen.getByRole("button", {name: "Зберегти"})).toBeTruthy();
        fireEvent.change(name, {target: {value: " Event "}});
        expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", true);
        fireEvent.submit(name.closest("form")!);
        expect(api.general).not.toHaveBeenCalled();
    });

    it("follows fresh server data while clean", async () => {
        const {client} = mount(General);
        await screen.findByDisplayValue("Event");
        act(() => client.setQueryData(["event-management-name", "e"], {Name: "Fresh Event"}));
        await screen.findByDisplayValue("Fresh Event");
        expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", true);
    });

    it("shows an empty accent as the automatic one, not as white", async () => {
        mount(Appearance);
        const accent = await screen.findByRole("textbox", {name: /^Акцентний колір/}) as HTMLInputElement;
        expect(accent.value).toBe("");
        expect(accent.placeholder).toBe("Як брендовий");
        const swatch = accent.parentElement!.querySelector(".event-color-swatch") as HTMLElement;
        expect(swatch.style.backgroundColor).toBe("rgb(33, 26, 82)");
        fireEvent.change(await screen.findByRole("textbox", {name: /^Брендовий колір/}), {target: {value: "#123456"}});
        expect(swatch.style.backgroundColor).toBe("rgb(18, 52, 86)");
    });

    it("compares colors without case or surrounding-space differences", async () => {
        mount(Appearance);
        const brand = await screen.findByRole("textbox", {name: /^Брендовий колір/});
        fireEvent.change(brand, {target: {value: " #211a52 "}});
        expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", true);
        fireEvent.submit(brand.closest("form")!);
        expect(api.appearance).not.toHaveBeenCalled();
    });
});
