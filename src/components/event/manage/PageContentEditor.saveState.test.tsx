// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ManagePage} from "@/api/manage";
import type {ReactNode} from "react";

const api = vi.hoisted(() => ({save: vi.fn(), replace: vi.fn()}));
const page: ManagePage = {ID: "0190c6a4-0000-7000-8000-000000000001", Slug: "page", Title: "Page", Document: {blocks: []}, Visibility: 0, Navigation: 0, NavigationOrder: 0, PublishedAt: "2026-10-11T10:00:00Z", Draft: null};
vi.mock("next/navigation", () => ({useRouter: () => ({replace: api.replace, push: vi.fn()})}));
vi.mock("./ManagerShell", () => ({useManager: () => ({event: {EventID: "e", Name: "Event", PreviewPicture: ""}, canManage: true})}));
vi.mock("./BlockStackEditor", () => ({BlockStackEditor: ({before}: {before: ReactNode}) => before}));
vi.mock("./validatePageBlocks", () => ({validateLanding: () => null}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("react-hot-toast", () => { const toast = {success: vi.fn(), error: vi.fn()}; return {default: toast, toast}; });
vi.mock("@/api/manage", async original => ({...await original() as object, getManagePage: async () => page, getManagePages: async () => [page], getManageConfig: async () => ({ScoreboardVisibility: 1}), getManageContent: async () => ({Variables: {}}), getManageContentVariables: async () => [], saveManagePageDraft: (...args: unknown[]) => api.save(...args)}));
import {CustomPageEditor} from "./PageContentEditor";

afterEach(() => {cleanup(); api.save.mockReset(); api.replace.mockReset();});
function mount() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><CustomPageEditor slug="page" /></QueryClientProvider>);
}

describe("page draft save state", () => {
    it("keeps a clean Save slot inactive", async () => {
        mount();
        await screen.findByRole("textbox", {name: "Назва сторінки"});
        const save = screen.getByRole("button", {name: "Зберегти"});
        expect(save).toHaveProperty("disabled", true);
        fireEvent.click(save);
        expect(api.save).not.toHaveBeenCalled();
    });

    it("keeps newer edits and the current editor when a saved slug changes", async () => {
        let acknowledge!: (value: ManagePage) => void;
        api.save.mockReturnValue(new Promise<ManagePage>(resolve => { acknowledge = resolve; }));
        mount();
        const title = await screen.findByRole("textbox", {name: "Назва сторінки"}) as HTMLInputElement;
        const slug = screen.getByRole("textbox", {name: "Адреса сторінки"});
        fireEvent.change(slug, {target: {value: "saved-page"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        expect(title.disabled).toBe(false);
        fireEvent.change(title, {target: {value: "Later title"}});
        acknowledge({...page, Draft: {Slug: "saved-page", Title: "Page", Document: {blocks: []}, Visibility: 0, Navigation: 0, NavigationAfter: ""}});
        await waitFor(() => expect((screen.getByRole("button", {name: "Зберегти"}) as HTMLButtonElement).disabled).toBe(false));
        expect(title.value).toBe("Later title");
        expect(api.replace).not.toHaveBeenCalled();
        fireEvent.change(title, {target: {value: "Page"}});
        expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", true);
    });
});
