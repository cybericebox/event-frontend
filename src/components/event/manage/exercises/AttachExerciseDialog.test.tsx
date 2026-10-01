// @vitest-environment jsdom
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {PublishedExerciseChoice} from "@/api/manageChallenges";
import {ManageApiError} from "@/api/manage";
import {AttachExerciseDialog} from "./AttachExerciseDialog";

const api = vi.hoisted(() => ({choices: vi.fn(), preview: vi.fn(), attach: vi.fn(), tags: vi.fn()}));
vi.mock("@/api/manageChallenges", () => ({
    getPublishedExerciseChoices: api.choices, getPublishedExercisePreview: api.preview, attachEventExercise: api.attach, getPublishedExerciseTags: api.tags,
}));

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const choice = (id: string, name: string, infrastructure: boolean) => ({ID: id, Name: name, Description: "", PublishedVersionID: id, Tags: [], Scope: "catalog", Infrastructure: infrastructure, Attached: false}) as PublishedExerciseChoice;

function renderDialog(infrastructureAllowed: boolean) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(<QueryClientProvider client={client}><AttachExerciseDialog eventID="e" infrastructureAllowed={infrastructureAllowed} open onClose={vi.fn()} onAttached={vi.fn(async () => undefined)} /></QueryClientProvider>);
}

describe("AttachExerciseDialog", () => {
    it("starts at «Немає» and disables sets that need infrastructure when the event has none", async () => {
        api.choices.mockResolvedValue([choice("11111111-1111-4111-8111-111111111111", "Test", true)]);
        renderDialog(false);
        expect(api.choices).toHaveBeenCalledWith("e", "", "no", []);
        const item = await screen.findByRole("button", {name: /Test/});
        expect((item as HTMLButtonElement).disabled).toBe(true);
        expect(item.textContent).toContain("Потрібна інфраструктура — у заходу її вимкнено");
    });

    it("shows a failed attach inside the dialog", async () => {
        api.choices.mockResolvedValue([choice("22222222-2222-4222-8222-222222222222", "Web", false)]);
        api.preview.mockResolvedValue({ID: "22222222-2222-4222-8222-222222222222", Name: "Web", Description: "", VersionID: "v", VariantCount: 1, Variant: 0, Tasks: []});
        api.attach.mockRejectedValue(new ManageApiError(409, 1808));
        renderDialog(true);
        expect(api.choices).toHaveBeenCalledWith("e", "", "all", []);
        fireEvent.click(await screen.findByRole("button", {name: /Web/}));
        fireEvent.click(await screen.findByRole("button", {name: "Додати"}));
        await waitFor(() => expect(screen.getByText("Набір потребує інфраструктури, а в заходу її вимкнено.")).toBeTruthy());
    });

    it("warns under the filter when sets with stands are listed but the event has no infrastructure", async () => {
        api.choices.mockResolvedValue([]);
        renderDialog(false);
        expect(screen.queryByText(/У заходу немає інфраструктури/)).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Є"}));
        const notice = screen.getByRole("status", {name: ""});
        expect(notice.textContent).toBe("У заходу немає інфраструктури — набори зі стендами додати не можна. Її може увімкнути адміністратор платформи до публікації.");
        expect(screen.getByRole("button", {name: "Є"}).closest(".ib-seg")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Немає"}));
        expect(screen.queryByText(/У заходу немає інфраструктури/)).toBeNull();
    });

    it("on «Усі» warns only when a listed set needs infrastructure", async () => {
        api.choices.mockResolvedValue([choice("a", "Plain", false)]);
        renderDialog(false);
        fireEvent.click(screen.getByRole("button", {name: "Усі"}));
        await screen.findByText("Plain");
        expect(screen.queryByText(/У заходу немає інфраструктури/)).toBeNull();
        api.choices.mockResolvedValue([choice("a", "Plain", false), choice("b", "Stands", true)]);
        fireEvent.click(screen.getByRole("button", {name: "Є"}));
        fireEvent.click(screen.getByRole("button", {name: "Усі"}));
        await screen.findByText("Stands");
        expect(screen.getByRole("status", {name: ""}).textContent).toMatch(/У заходу немає інфраструктури/);
    });

    it("refetches at once with the picked tags and lists each set's tags", async () => {
        api.tags.mockResolvedValue([{Tag: "web", ExerciseCount: 2}]);
        api.choices.mockResolvedValue([{...choice("c", "Tagged", false), Tags: ["web", "crypto"]}]);
        renderDialog(true);
        expect((await screen.findByRole("button", {name: /Tagged/})).textContent).toContain("crypto");
        fireEvent.focus(screen.getByRole("combobox"));
        fireEvent.pointerDown(await screen.findByRole("option", {name: /web/}));
        await waitFor(() => expect(api.choices).toHaveBeenLastCalledWith("e", "", "all", ["web"]));
        // The previous list stays on screen while the filtered one loads.
        expect(screen.getByRole("button", {name: /Tagged/})).toBeTruthy();
    });
});
