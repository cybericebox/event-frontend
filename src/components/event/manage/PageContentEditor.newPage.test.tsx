// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";

vi.mock("next/navigation", () => ({useRouter: () => ({replace: vi.fn(), push: vi.fn()})}));
vi.mock("./ManagerShell", () => ({useManager: () => ({event: {EventID: "e", Name: "Event", PreviewPicture: ""}, canManage: true})}));
vi.mock("./BlockStackEditor", () => ({BlockStackEditor: ({before}: {before: ReactNode}) => before}));
vi.mock("./validatePageBlocks", () => ({validateLanding: () => null}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("react-hot-toast", () => { const toast = {success: vi.fn(), error: vi.fn()}; return {default: toast, toast}; });
vi.mock("@/api/manage", async original => ({...await original() as object, getManagePages: async () => [], getManageConfig: async () => ({ScoreboardVisibility: 1}), getManageContent: async () => ({Variables: {}}), getManageContentVariables: async () => []}));
import {CustomPageEditor} from "./PageContentEditor";

afterEach(() => {cleanup(); sessionStorage.clear();});
function mount() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><CustomPageEditor /></QueryClientProvider>);
}

describe("a new page before any input", () => {
    it("shows no field errors and no unsaved changes", async () => {
        mount();
        const title = await screen.findByRole("textbox", {name: "Назва сторінки"});
        const slug = screen.getByRole("textbox", {name: "Адреса сторінки"});
        expect(title.getAttribute("aria-invalid")).not.toBe("true");
        expect(slug.getAttribute("aria-invalid")).not.toBe("true");
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.queryByText("Є незбережені зміни")).toBeNull();
        expect(screen.queryByRole("button", {name: "Скасувати"})).toBeNull();
    });

    it("shows a field error once that field is left empty, and the unsaved state after typing", async () => {
        mount();
        const title = await screen.findByRole("textbox", {name: "Назва сторінки"});
        fireEvent.blur(title);
        expect(title.getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByRole("textbox", {name: "Адреса сторінки"}).getAttribute("aria-invalid")).not.toBe("true");
        fireEvent.change(title, {target: {value: "Правила"}});
        expect(screen.getByText("Є незбережені зміни")).toBeTruthy();
    });

    it("«Опублікувати» on an incomplete page shows the missing field's error and focuses it", async () => {
        mount();
        const title = await screen.findByRole("textbox", {name: "Назва сторінки"});
        fireEvent.change(title, {target: {value: "Правила"}});
        fireEvent.click(screen.getByRole("button", {name: /Опублікувати/}));
        const slug = screen.getByRole("textbox", {name: "Адреса сторінки"});
        expect(slug.getAttribute("aria-invalid")).toBe("true");
        expect(document.activeElement).toBe(slug);
    });
});
