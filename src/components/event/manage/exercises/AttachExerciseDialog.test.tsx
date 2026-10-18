// @vitest-environment jsdom
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {PublishedExerciseChoice} from "@/api/manageChallenges";
import {ManageApiError} from "@/api/manage";
import {AttachExerciseDialog} from "./AttachExerciseDialog";
import {ManualDraftProvider} from "../manualDraft";
import {t} from "@/i18n/t";
/* eslint-disable @next/next/no-html-link-for-pages -- Tests interception of a navigation link. */

const api = vi.hoisted(() => ({choices: vi.fn(), preview: vi.fn(), attach: vi.fn(), tags: vi.fn()}));
vi.mock("@/api/manageChallenges", () => ({
    getPublishedExerciseChoices: api.choices, getPublishedExercisePreview: api.preview, attachEventExercise: api.attach, getPublishedExerciseTags: api.tags,
}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/exercises", useRouter: () => ({push: vi.fn(), replace: vi.fn()})}));

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
beforeEach(() => sessionStorage.clear());

const choice = (id: string, name: string, infrastructure: boolean) => ({ID: id, Name: name, Description: "", PublishedVersionID: id, Tags: [], Scope: "catalog", Infrastructure: infrastructure, Attached: false, ResourceHeavy: false, Resources: null}) as PublishedExerciseChoice;

function renderDialog(infrastructureAllowed: boolean, withDrafts = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const dialog = <AttachExerciseDialog eventID="e" infrastructureAllowed={infrastructureAllowed} open onClose={vi.fn()} onAttached={vi.fn(async () => undefined)} />;
    return render(<QueryClientProvider client={client}>{withDrafts ? <ManualDraftProvider userID="user-a" eventID="e">{dialog}<a href="/manage/settings">next</a></ManualDraftProvider> : dialog}</QueryClientProvider>);
}

describe("AttachExerciseDialog", () => {
    it("restores a pending attachment and its variant policy after refresh, then clears it after success", async () => {
        const web = choice("22222222-2222-4222-8222-222222222222", "Web", false);
        api.choices.mockResolvedValue([web]);
        api.preview.mockResolvedValue({ID: web.ID, Name: "Web", Description: "", VersionID: "v", VariantCount: 3, Variant: 0, Tasks: []});
        api.attach.mockResolvedValue(undefined);
        const first = renderDialog(true, true);
        fireEvent.click(await screen.findByRole("button", {name: /Web/}));
        fireEvent.click(await screen.findByRole("radio", {name: t("manage.exercises.attachDialog.variantForAll", {number: 1})}));
        first.unmount();
        renderDialog(true, true);
        await waitFor(() => expect(screen.getByRole("button", {name: /Web/}).getAttribute("aria-pressed")).toBe("true"));
        expect(await screen.findByRole("radio", {name: t("manage.exercises.attachDialog.variantForAll", {number: 1})})).toHaveProperty("checked", true);
        fireEvent.click(screen.getByText("next"));
        expect(screen.getByText(t("manage.unsaved.title"))).toBeTruthy();
        fireEvent.click(screen.getAllByText(t("common.cancel")).at(-1)!);
        fireEvent.click(screen.getByRole("button", {name: t("common.add")}));
        await waitFor(() => expect(api.attach).toHaveBeenCalledWith("e", web.PublishedVersionID, 1, 0));
        await waitFor(() => expect(Object.keys(sessionStorage).filter(key => key.includes("exercise-attachment"))).toEqual([]));
    });

    it("starts at «Немає» and disables sets that need infrastructure when the event has none", async () => {
        api.choices.mockResolvedValue([choice("11111111-1111-4111-8111-111111111111", "Test", true)]);
        renderDialog(false);
        expect(api.choices).toHaveBeenCalledWith("e", "", "no", []);
        const item = await screen.findByRole("button", {name: /Test/});
        expect((item as HTMLButtonElement).disabled).toBe(true);
        expect(item.textContent).toContain("Потрібна інфраструктура — у заходу її вимкнено");
    });

    it("marks resource-heavy sets and shows each set's total resources", async () => {
        const res = (cpu: number, memory: number, devices: number, blocks = devices * 4) => ({Blocks: blocks, CPUMillicores: cpu, MemoryBytes: memory * 1024 ** 2, Devices: devices});
        api.choices.mockResolvedValue([
            {...choice("33333333-3333-4333-8333-333333333333", "Heavy", false), ResourceHeavy: true, Resources: {Min: res(500, 2048, 2), Max: res(500, 2048, 2)}},
            {...choice("44444444-4444-4444-8444-444444444444", "Light", false), Resources: {Min: res(50, 128, 1), Max: res(250, 1024, 3)}},
            choice("55555555-5555-4555-8555-555555555555", "Plain", false),
        ]);
        renderDialog(true);
        const heavy = await screen.findByRole("button", {name: /Heavy/});
        expect(heavy.querySelector("[data-resource-heavy]")?.textContent).toBe("Ресурсоємне");
        expect(heavy.querySelector("[data-resources-total]")?.textContent).toBe("CPU 500 мілі-ядер · памʼять 2 ГіБ · 8 блоків · пристроїв 2");
        const light = screen.getByRole("button", {name: /Light/});
        expect(light.querySelector("[data-resource-heavy]")).toBeNull();
        expect(light.querySelector("[data-resources-total]")?.textContent).toBe("CPU 50 мілі-ядер–250 мілі-ядер · памʼять 128 МіБ–1 ГіБ · 4–12 блоків · пристроїв 1–3");
        expect(screen.getByRole("button", {name: /Plain/}).querySelector("[data-resources-total]")).toBeNull();
    });

    it("shows a failed attach inside the dialog", async () => {
        api.choices.mockResolvedValue([choice("22222222-2222-4222-8222-222222222222", "Web", false)]);
        api.preview.mockResolvedValue({ID: "22222222-2222-4222-8222-222222222222", Name: "Web", Description: "", VersionID: "v", VariantCount: 1, Variant: 0, Tasks: []});
        api.attach.mockRejectedValue(new ManageApiError(409, 1808));
        renderDialog(true);
        expect(api.choices).toHaveBeenCalledWith("e", "", "all", []);
        fireEvent.click(await screen.findByRole("button", {name: /Web/}));
        fireEvent.click(await screen.findByRole("button", {name: "Додати"}));
        await waitFor(() => expect(screen.getByText("Завдання потребує інфраструктури, а в заходу її вимкнено.")).toBeTruthy());
    });

    it("offers a change request when the reservation cannot hold the set (72508)", async () => {
        api.choices.mockResolvedValue([choice("22222222-2222-4222-8222-222222222222", "Web", false)]);
        api.preview.mockResolvedValue({ID: "22222222-2222-4222-8222-222222222222", Name: "Web", Description: "", VersionID: "v", VariantCount: 1, Variant: 0, Tasks: []});
        api.attach.mockRejectedValue(new ManageApiError(409, 2508));
        renderDialog(true);
        fireEvent.click(await screen.findByRole("button", {name: /Web/}));
        fireEvent.click(await screen.findByRole("button", {name: "Додати"}));
        const link = await screen.findByRole("link", {name: "Запросити розширення"});
        expect(link.getAttribute("href")).toBe("/manage/resources?request=1");
    });

    it("warns under the filter when sets with stands are listed but the event has no infrastructure", async () => {
        api.choices.mockResolvedValue([]);
        renderDialog(false);
        expect(screen.queryByText(/У заходу немає інфраструктури/)).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: "Є"}));
        const notice = screen.getByRole("status", {name: ""});
        expect(notice.textContent).toBe("У заходу немає інфраструктури — завдання зі стендами додати не можна. Її може увімкнути адміністратор платформи до публікації.");
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

it("uses the ordinary picker for preview selections without mutating competition attachments", async () => {
    const web = {...choice("22222222-2222-4222-8222-222222222222", "Web", false), Attached: true};
    api.choices.mockResolvedValue([web]);
    api.preview.mockResolvedValue({ID: web.ID, Name: "Web", Description: "", VersionID: "v", VariantCount: 2, Variant: 0, Tasks: []});
    const select = vi.fn(async () => undefined);
    render(<QueryClientProvider client={new QueryClient()}><AttachExerciseDialog eventID="e" infrastructureAllowed open onClose={vi.fn()} onAttached={vi.fn(async () => undefined)} selectionAdapter={{attachedVersionIDs: [], onSelect: select}} /></QueryClientProvider>);
    const item = await screen.findByRole("button", {name: /Web/});
    expect(item).toHaveProperty("disabled", false);
    fireEvent.click(item);
    expect(await screen.findByLabelText(t("manage.exercises.attachDialog.previewVariant"))).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name: t("common.add")}));
    await waitFor(() => expect(select).toHaveBeenCalledWith(expect.objectContaining({ID: web.ID}), 0));
    expect(api.attach).not.toHaveBeenCalled();
});

it("limits preview catalog and variant choices to event-eligible availability", async () => {
    const eligible = choice("eligible", "Eligible", true);
    api.choices.mockResolvedValue([eligible, choice("dynamic", "Dynamic", true), choice("unavailable", "Unavailable", false)]);
    api.preview.mockResolvedValue({ID: eligible.ID, Name: "Eligible", Description: "", VersionID: "v", VariantCount: 3, Variant: 2, Tasks: []});
    const select = vi.fn(async () => undefined);
    render(<QueryClientProvider client={new QueryClient()}><AttachExerciseDialog eventID="e" infrastructureAllowed={false} open onClose={vi.fn()} onAttached={vi.fn(async () => undefined)} selectionAdapter={{availableVariants: {[eligible.PublishedVersionID]: [2]}, attachedVersionIDs: [], onSelect: select}} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", {name: /Eligible/}));
    expect(api.choices).toHaveBeenCalledWith("e", "", "all", []);
    expect(screen.getByRole("button", {name: /Eligible/})).toHaveProperty("disabled", false);
    expect(screen.queryByRole("button", {name: /Dynamic/})).toBeNull();
    expect(screen.queryByRole("button", {name: /Unavailable/})).toBeNull();
    await waitFor(() => expect(api.preview).toHaveBeenCalledWith("e", eligible.PublishedVersionID, 2));
    const variant = await screen.findByLabelText(t("manage.exercises.attachDialog.previewVariant"));
    expect(variant.textContent).toContain("3");
    expect(variant.textContent).not.toContain("1");
    expect(variant.textContent).not.toContain("2");
    fireEvent.click(screen.getByRole("button", {name: t("common.add")}));
    await waitFor(() => expect(select).toHaveBeenCalledWith(expect.objectContaining({ID: eligible.ID}), 2));
    expect(api.attach).not.toHaveBeenCalled();
});

it("lists preview tasks that cannot be chosen muted with a reason, after the choosable ones", async () => {
    const eligible = choice("eligible", "Eligible", false);
    const capped = choice("capped", "Capped", true);
    api.choices.mockResolvedValue([capped, eligible]);
    api.preview.mockResolvedValue({ID: eligible.ID, Name: "Eligible", Description: "", VersionID: "v", VariantCount: 1, Variant: 0, Tasks: []});
    const ineligible = [{ID: capped.ID, Name: "Capped", Reason: "no_capacity"}, {ID: "draft", Name: "Draft", Reason: "not_published"}];
    render(<QueryClientProvider client={new QueryClient()}><AttachExerciseDialog eventID="e" infrastructureAllowed open onClose={vi.fn()} onAttached={vi.fn(async () => undefined)} selectionAdapter={{availableVariants: {[eligible.PublishedVersionID]: [0]}, ineligible, attachedVersionIDs: [], onSelect: vi.fn(async () => undefined)}} /></QueryClientProvider>);
    expect(await screen.findByRole("button", {name: /Eligible/})).toHaveProperty("disabled", false);
    expect(screen.queryByRole("button", {name: /Capped/})).toBeNull();
    expect(screen.getByText(t("manage.previewSettings.reason.no_capacity"))).toBeTruthy();
    expect(screen.getByText(t("manage.previewSettings.reason.not_published"))).toBeTruthy();
    const names = screen.getAllByRole("listitem").map(item => item.textContent ?? "");
    expect(names[0]).toContain("Eligible");
    expect(names[1]).toContain("Capped");
    expect(names[2]).toContain("Draft");
});
