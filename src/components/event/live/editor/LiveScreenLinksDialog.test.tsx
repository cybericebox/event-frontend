// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveScreenLinksDialog} from "./LiveScreenLinksDialog";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const api = vi.hoisted(() => ({get: vi.fn(), issue: vi.fn(), regenerate: vi.fn(), revoke: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(),
    getLiveScreenLink: api.get, issueLiveScreenLink: api.issue, regenerateLiveScreenLink: api.regenerate, revokeLiveScreenLink: api.revoke}));

const event = {EventID: "01900000-0000-7000-8000-000000000001", Name: "Захід", FinishTime: null, LogoURL: "", Theme: {Brand: "#211A52"}} as unknown as PublicEventInfo;
const link = {ID: "01900000-0000-7000-8000-0000000000aa", CreatedAt: "2026-09-29T10:00:00Z", ExpiresAt: null};

function mount() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><LiveScreenLinksDialog open event={event} onClose={() => undefined} /></QueryClientProvider>);
}

beforeEach(() => {
    api.get.mockReset().mockResolvedValue(null);
    api.issue.mockReset().mockResolvedValue({...link, Token: "tok_en"});
    api.regenerate.mockReset().mockResolvedValue({...link, ID: "renewed", Token: "re_new"});
    api.revoke.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("live view link dialog", () => {
    it("creates the one link without expiry by default and shows its URL once", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {clipboard: {writeText}});
        mount();
        await act(async () => {fireEvent.click(await screen.findByRole("button", {name: /Створити посилання/}));});
        expect(api.issue).toHaveBeenCalledWith(event.EventID, "none");
        const url = (screen.getByLabelText("Посилання") as HTMLInputElement).value;
        expect(url).toBe(`${window.location.origin}/live#screen=tok_en`);
        expect(screen.getByText(/діє до: без обмеження/)).toBeTruthy();
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: /Копіювати/}));});
        expect(writeText).toHaveBeenCalledWith(url);
    });

    it("hides the URL of an existing link and offers regenerate and turn off", async () => {
        api.get.mockResolvedValue(link);
        mount();
        await screen.findByText(/Повне посилання показується лише одразу після створення/);
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.queryByRole("button", {name: /Створити посилання/})).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: /Перегенерувати/}));
        expect(api.regenerate).not.toHaveBeenCalled();
        await act(async () => {fireEvent.click(screen.getAllByRole("button", {name: "Перегенерувати"}).at(-1)!);});
        expect(api.regenerate).toHaveBeenCalledWith(event.EventID);
        expect((screen.getByLabelText("Посилання") as HTMLInputElement).value).toContain("#screen=re_new");
    });

    it("turns the link off after a confirmation", async () => {
        api.get.mockResolvedValue(link);
        mount();
        fireEvent.click(await screen.findByRole("button", {name: /Вимкнути/}));
        await act(async () => {fireEvent.click(screen.getAllByRole("button", {name: "Вимкнути"}).at(-1)!);});
        expect(api.revoke).toHaveBeenCalledWith(event.EventID);
        expect(await screen.findByRole("button", {name: /Створити посилання/})).toBeTruthy();
    });
});
