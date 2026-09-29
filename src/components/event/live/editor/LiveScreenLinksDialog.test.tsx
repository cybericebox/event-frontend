// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {LiveScreenLinksDialog} from "./LiveScreenLinksDialog";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const api = vi.hoisted(() => ({list: vi.fn(), create: vi.fn(), regenerate: vi.fn(), revoke: vi.fn()}));
vi.mock("@/api/manageLive", async importOriginal => ({...await importOriginal<typeof import("@/api/manageLive")>(),
    listLiveScreenLinks: api.list, createLiveScreenLink: api.create, regenerateLiveScreenLink: api.regenerate, revokeLiveScreenLink: api.revoke}));

const event = {EventID: "01900000-0000-7000-8000-000000000001", Name: "Захід", FinishTime: null, LogoURL: "", Theme: {Brand: "#211A52"}} as unknown as PublicEventInfo;
const link = {ID: "01900000-0000-7000-8000-0000000000aa", CreatedAt: "2026-09-29T10:00:00Z", ExpiresAt: "2026-09-30T10:00:00Z"};

function mount() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><LiveScreenLinksDialog open event={event} onClose={() => undefined} /></QueryClientProvider>);
}

beforeEach(() => {
    api.list.mockReset().mockResolvedValue([link]);
    api.create.mockReset().mockResolvedValue({...link, ID: "new", Token: "tok_en"});
    api.regenerate.mockReset().mockResolvedValue({...link, ID: "renewed", Token: "re_new"});
    api.revoke.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("screen links dialog", () => {
    it("lists active links with their dates and no token", async () => {
        mount();
        await screen.findByText(/Створено .* · діє до /);
        expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("creates a link and shows its URL once with a copy button", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {clipboard: {writeText}});
        mount();
        await screen.findByText(/Створено/);
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: /Створити посилання/}));});
        expect(api.create).toHaveBeenCalledWith(event.EventID, "day");
        const url = (await screen.findByRole("textbox", {name: "Нове посилання"}) as HTMLInputElement).value;
        expect(url).toBe(`${window.location.origin}/live#screen=tok_en`);
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: /Копіювати/}));});
        expect(writeText).toHaveBeenCalledWith(url);
    });

    it("turns «until the event ends» off without a finish time", async () => {
        mount();
        await screen.findByText(/Створено/);
        fireEvent.pointerDown(screen.getByRole("button", {name: "Діє"}), {button: 0, ctrlKey: false});
        const option = await screen.findByRole("menuitemradio", {name: /До завершення заходу/});
        expect(option.getAttribute("aria-disabled") ?? option.getAttribute("data-disabled")).not.toBeNull();
    });

    it("revokes and regenerates only after a confirmation", async () => {
        mount();
        const row = (await screen.findByText(/Створено/)).closest("li")!;
        fireEvent.click(within(row).getByRole("button", {name: /Відкликати/}));
        expect(api.revoke).not.toHaveBeenCalled();
        await act(async () => {fireEvent.click(screen.getAllByRole("button", {name: "Відкликати"}).at(-1)!);});
        expect(api.revoke).toHaveBeenCalledWith(event.EventID, link.ID);

        fireEvent.click(within(row).getByRole("button", {name: /Перевипустити/}));
        await act(async () => {fireEvent.click(screen.getAllByRole("button", {name: "Перевипустити"}).at(-1)!);});
        expect(api.regenerate).toHaveBeenCalledWith(event.EventID, link.ID);
        await waitFor(() => expect((screen.getByRole("textbox", {name: "Нове посилання"}) as HTMLInputElement).value).toContain("#screen=re_new"));
    });
});
