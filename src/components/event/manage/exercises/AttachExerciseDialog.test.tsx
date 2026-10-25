// @vitest-environment jsdom
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
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

const choice = (id: string, name: string, infrastructure: boolean) => ({ID: id, Name: name, Description: "", PublishedVersionID: id, Tags: [], Scope: "catalog", Infrastructure: infrastructure, Attached: false, ResourceHeavy: false, Resources: null, AvgDifficulty: null, TaskCount: null, TaskNames: [], MatchedCount: null, AvailableCount: null}) as PublishedExerciseChoice;

// The filters are selects: open one, then pick an option (a radio item for one choice, a check for several).
async function pick(label: string, option: string) {
    fireEvent.pointerDown(screen.getByRole("button", {name: label}), {button: 0, ctrlKey: false});
    fireEvent.click(await screen.findByRole("menuitemradio", {name: option}));
}
async function check(label: string, option: string) {
    fireEvent.pointerDown(screen.getByRole("button", {name: new RegExp(`^${label}:`)}), {button: 0, ctrlKey: false});
    fireEvent.click(await screen.findByRole("menuitemcheckbox", {name: new RegExp(`^${option}`)}));
}
const infra = (option: "all" | "yes" | "no") => pick(t("manage.exercises.attachDialog.infrastructure"), t(`manage.exercises.attachDialog.infrastructureChoice.${option}`));
const added = (option: "all" | "yes" | "no") => pick(t("manage.exercises.attachDialog.attachedFilter.label"), t(`manage.exercises.attachDialog.attachedChoice.${option}`));
const filterCall = (patch: Record<string, unknown> = {}) => ({search: "", infrastructure: "all", tags: [], difficulties: [], attached: "all", ...patch});

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
        fireEvent.click(await screen.findByRole("checkbox", {name: /Web/}));
        fireEvent.click(await screen.findByRole("radio", {name: t("manage.exercises.attachDialog.variantForAll", {number: 1})}));
        first.unmount();
        renderDialog(true, true);
        await waitFor(() => expect(screen.getByRole("checkbox", {name: /Web/})).toHaveProperty("checked", true));
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
        expect(api.choices).toHaveBeenCalledWith("e", {search: "", infrastructure: "no", tags: [], difficulties: [], attached: "all"});
        const item = await screen.findByRole("checkbox", {name: /Test/});
        expect((item as HTMLInputElement).disabled).toBe(true);
        expect(item.closest("label")!.textContent).toContain("Потрібна інфраструктура — у заходу її вимкнено");
        expect(document.getElementById(item.getAttribute("aria-describedby")!)?.textContent).toContain("Потрібна інфраструктура — у заходу її вимкнено");
    });

    it("marks resource-heavy sets and shows each set's total resources", async () => {
        const res = (cpu: number, memory: number, devices: number, blocks = devices * 4) => ({Blocks: blocks, CPUMillicores: cpu, MemoryBytes: memory * 1024 ** 2, Devices: devices});
        api.choices.mockResolvedValue([
            {...choice("33333333-3333-4333-8333-333333333333", "Heavy", false), ResourceHeavy: true, Resources: {Min: res(500, 2048, 2), Max: res(500, 2048, 2)}},
            {...choice("44444444-4444-4444-8444-444444444444", "Light", false), Resources: {Min: res(50, 128, 1), Max: res(250, 1024, 3)}},
            choice("55555555-5555-4555-8555-555555555555", "Plain", false),
        ]);
        renderDialog(true);
        const heavy = (await screen.findByRole("checkbox", {name: /Heavy/})).closest("label")!;
        expect(heavy.querySelector("[data-resource-heavy]")?.textContent).toBe("Ресурсоємне");
        expect(heavy.querySelector("[data-resources-total]")?.textContent).toBe("CPU 500 мілі-ядер · памʼять 2 ГіБ · пристроїв: 2");
        const light = screen.getByRole("checkbox", {name: /Light/}).closest("label")!;
        expect(light.querySelector("[data-resource-heavy]")).toBeNull();
        expect(light.querySelector("[data-resources-total]")?.textContent).toBe("CPU 50 мілі-ядер–250 мілі-ядер · памʼять 128 МіБ–1 ГіБ · пристроїв: 1–3");
        expect(screen.getByRole("checkbox", {name: /Plain/}).closest("label")!.querySelector("[data-resources-total]")).toBeNull();
    });

    it("shows a failed attach inside the dialog", async () => {
        api.choices.mockResolvedValue([choice("22222222-2222-4222-8222-222222222222", "Web", false)]);
        api.preview.mockResolvedValue({ID: "22222222-2222-4222-8222-222222222222", Name: "Web", Description: "", VersionID: "v", VariantCount: 1, Variant: 0, Tasks: []});
        api.attach.mockRejectedValue(new ManageApiError(409, 1808));
        renderDialog(true);
        expect(api.choices).toHaveBeenCalledWith("e", {search: "", infrastructure: "all", tags: [], difficulties: [], attached: "all"});
        fireEvent.click(await screen.findByRole("checkbox", {name: /Web/}));
        fireEvent.click(await screen.findByRole("button", {name: "Додати"}));
        await waitFor(() => expect(screen.getByText("Завдання потребує інфраструктури, а в заходу її вимкнено.")).toBeTruthy());
    });

    it("offers a change request when the reservation cannot hold the set (72508)", async () => {
        api.choices.mockResolvedValue([choice("22222222-2222-4222-8222-222222222222", "Web", false)]);
        api.preview.mockResolvedValue({ID: "22222222-2222-4222-8222-222222222222", Name: "Web", Description: "", VersionID: "v", VariantCount: 1, Variant: 0, Tasks: []});
        api.attach.mockRejectedValue(new ManageApiError(409, 2508));
        renderDialog(true);
        fireEvent.click(await screen.findByRole("checkbox", {name: /Web/}));
        fireEvent.click(await screen.findByRole("button", {name: "Додати"}));
        const link = await screen.findByRole("link", {name: "Запросити розширення"});
        expect(link.getAttribute("href")).toBe("/manage/resources?request=1");
    });

    it("warns under the filter when sets with stands are listed but the event has no infrastructure", async () => {
        api.choices.mockResolvedValue([]);
        renderDialog(false);
        expect(screen.queryByText(/У заходу немає інфраструктури/)).toBeNull();
        await infra("yes");
        const notice = await screen.findByText(/У заходу немає інфраструктури/);
        expect(notice.textContent).toBe("У заходу немає інфраструктури — завдання зі стендами додати не можна. Її може увімкнути адміністратор платформи до публікації.");
        await infra("no");
        await waitFor(() => expect(screen.queryByText(/У заходу немає інфраструктури/)).toBeNull());
    });

    it("on «Усі» warns only when a listed set needs infrastructure", async () => {
        api.choices.mockResolvedValue([choice("a", "Plain", false)]);
        renderDialog(false);
        await infra("all");
        await screen.findByText("Plain");
        expect(screen.queryByText(/У заходу немає інфраструктури/)).toBeNull();
        api.choices.mockResolvedValue([choice("a", "Plain", false), choice("b", "Stands", true)]);
        await infra("yes");
        await infra("all");
        await screen.findByText("Stands");
        expect(screen.getByText(/У заходу немає інфраструктури/)).toBeTruthy();
    });

    it("refetches at once with the picked tags and lists each set's tags", async () => {
        api.tags.mockResolvedValue([{Tag: "web", ExerciseCount: 2}]);
        api.choices.mockResolvedValue([{...choice("c", "Tagged", false), Tags: ["web", "crypto"]}]);
        renderDialog(true);
        expect((await screen.findByRole("checkbox", {name: /Tagged/})).closest("label")!.textContent).toContain("crypto");
        fireEvent.pointerDown(screen.getByRole("button", {name: new RegExp(`^${t("manage.exercises.attachDialog.tags")}:`)}), {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemcheckbox", {name: /web/}));
        // A list with several choices stays open while picking; Esc closes it.
        fireEvent.keyDown(document.activeElement ?? document.body, {key: "Escape"});
        await waitFor(() => expect(api.choices).toHaveBeenLastCalledWith("e", {search: "", infrastructure: "all", tags: ["web"], difficulties: [], attached: "all"}));
        // The previous list stays on screen while the filtered one loads.
        expect(screen.getByRole("checkbox", {name: /Tagged/})).toBeTruthy();
    });

    it("shows each row's tags, average difficulty and subtask count; the count opens the names", async () => {
        const web = {...choice("33333333-3333-4333-8333-333333333333", "Web", false), Description: "A long description", Tags: ["web", "sqli", "auth"],
            AvgDifficulty: 3.33, TaskCount: 3, TaskNames: ["Recon", "Exploit", "Report"]};
        const bare = {...choice("44444444-4444-4444-8444-444444444444", "Bare", false)};
        api.choices.mockResolvedValue([web, bare]);
        renderDialog(true);
        const row = (await screen.findByRole("checkbox", {name: /Web/})).closest("li")!;
        for (const tag of ["web", "sqli", "auth"]) expect(within(row).getByText(tag)).toBeTruthy();
        expect(within(row).getByLabelText(t("manage.exercises.avgDifficulty.value", {level: t("manage.exercises.avgDifficulty.easy"), value: "3,3"}))).toBeTruthy();
        const count = within(row).getByRole("button", {name: t("manage.exercises.subtasks.show", {count: 3})});
        expect(count.textContent).toBe("3");
        // Not inside the card's label, and it does not select the card.
        expect(count.closest(".event-exercise-picker__item")).toBeNull();
        const panel = document.getElementById(count.getAttribute("popovertarget")!)!;
        expect(panel.getAttribute("popover")).toBe("auto");
        expect([...panel.querySelectorAll("li")].map(item => item.textContent)).toEqual(["Recon", "Exploit", "Report"]);
        fireEvent.click(count);
        expect(within(row).getByRole("checkbox", {name: /Web/})).toHaveProperty("checked", false);
        // Without a variant or a difficulty: «—».
        const bareRow = screen.getByRole("checkbox", {name: /Bare/}).closest("li")!;
        expect(within(bareRow).getByLabelText(t("manage.exercises.avgDifficulty.none")).textContent).toBe("—");
        expect(within(bareRow).getByLabelText(t("manage.exercises.subtasks.none")).textContent).toBe("—");
    });

    it("filters by difficulty (in level order) and by attached on the server, and counts what is shown", async () => {
        api.choices.mockResolvedValue([{...choice("a", "Web", false), MatchedCount: 1, AvailableCount: 40}]);
        renderDialog(true);
        expect(await screen.findByText(t("manage.exercises.attachDialog.count", {shown: 1, total: 40}))).toBeTruthy();
        const level = t("manage.exercises.attachDialog.difficultyFilter.label");
        await check(level, t("manage.exercises.difficulty.hard"));
        expect(screen.getByRole("menuitemcheckbox", {name: t("manage.exercises.difficulty.hard")}).getAttribute("aria-checked")).toBe("true");
        // The menu stays open while picking several.
        fireEvent.click(screen.getByRole("menuitemcheckbox", {name: t("manage.exercises.difficulty.easy")}));
        await waitFor(() => expect(api.choices).toHaveBeenLastCalledWith("e", filterCall({difficulties: ["easy", "hard"]})));
        fireEvent.click(screen.getByRole("menuitemcheckbox", {name: t("manage.exercises.attachDialog.difficultyFilter.none")}));
        await waitFor(() => expect(api.choices).toHaveBeenLastCalledWith("e", filterCall({difficulties: ["easy", "hard", "none"]})));
        fireEvent.keyDown(document.activeElement ?? document.body, {key: "Escape"});
        await added("no");
        await waitFor(() => expect(api.choices).toHaveBeenLastCalledWith("e", filterCall({difficulties: ["easy", "hard", "none"], attached: "no"})));
    });

    it("says when the list stops before every match", async () => {
        api.choices.mockResolvedValue([{...choice("a", "Web", false), MatchedCount: 130, AvailableCount: 200}]);
        renderDialog(true);
        const line = await screen.findByText(new RegExp(t("manage.exercises.attachDialog.countLimited", {matched: 130})));
        expect(line.textContent).toContain(t("manage.exercises.attachDialog.count", {shown: 1, total: 200}));
    });

    it("shows a centred empty state with a reset when the filters match nothing", async () => {
        api.choices.mockResolvedValue([]);
        renderDialog(true);
        expect(await screen.findByText(t("manage.exercises.attachDialog.noResults"))).toBeTruthy();
        await added("yes");
        const empty = (await screen.findByText(t("manage.exercises.attachDialog.noFilterResults"))).closest("[data-empty-state]") as HTMLElement;
        expect(empty).toBeTruthy();
        fireEvent.click(within(empty).getByRole("button", {name: t("manage.exercises.attachDialog.resetFilters")}));
        await waitFor(() => expect(api.choices).toHaveBeenLastCalledWith("e", filterCall()));
        expect(screen.getByRole("button", {name: t("manage.exercises.attachDialog.attachedFilter.label")}).textContent).toBe(t("manage.exercises.attachDialog.attachedChoice.all"));
    });
});

// A promise the test settles by hand, to watch one request at a time.
function deferred() {
    let resolve!: () => void, reject!: (error: unknown) => void;
    const promise = new Promise<void>((done, fail) => {resolve = () => done(); reject = fail;});
    return {promise, resolve, reject};
}

describe("AttachExerciseDialog multi-select", () => {
    const A = choice("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Alpha", false);
    const B = choice("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Bravo", false);
    const C = choice("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Charlie", false);
    const done = {...choice("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "Done", false), Attached: true};
    const box = (name: string) => screen.getByRole("checkbox", {name: t("manage.exercises.attachDialog.select", {name})}) as HTMLInputElement;
    const counter = (count: number) => t("manage.exercises.attachDialog.selectedCount", {count});

    function renderMulti() {
        const onClose = vi.fn();
        const onAttached = vi.fn(async () => undefined);
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        render(<QueryClientProvider client={client}><AttachExerciseDialog eventID="e" infrastructureAllowed open onClose={onClose} onAttached={onAttached} /></QueryClientProvider>);
        return {onClose, onAttached};
    }

    async function selectAll() {
        await screen.findByText("Alpha");
        fireEvent.click(screen.getByRole("button", {name: t("manage.exercises.attachDialog.selectShown")}));
        await screen.findByText(counter(3));
    }

    it("selects with checkboxes, skips attached sets, selects all shown, clears, and keeps the selection across filters", async () => {
        api.choices.mockResolvedValue([A, B, done]);
        renderMulti();
        await screen.findByText("Alpha");
        expect(screen.getByText(counter(0))).toBeTruthy();
        expect(box("Done").disabled).toBe(true);
        fireEvent.click(box("Alpha"));
        expect(box("Alpha").checked).toBe(true);
        expect(box("Alpha").closest("li")!.className).toContain("is-selected");
        expect(screen.getByText(counter(1))).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: t("manage.exercises.attachDialog.selectShown")}));
        expect(screen.getByText(counter(2))).toBeTruthy();
        expect(box("Done").checked).toBe(false);
        expect((screen.getByRole("button", {name: t("manage.exercises.attachDialog.selectShown")}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("button", {name: t("manage.exercises.attachDialog.clearSelection")}));
        expect(screen.getByText(counter(0))).toBeTruthy();
        // A filter change replaces the list; the picked set stays picked.
        fireEvent.click(box("Bravo"));
        api.choices.mockResolvedValue([C]);
        await added("no");
        await screen.findByText("Charlie");
        expect(screen.queryByText("Bravo")).toBeNull();
        expect(screen.getByText(counter(1))).toBeTruthy();
        fireEvent.click(box("Charlie"));
        expect(screen.getByText(counter(2))).toBeTruthy();
    });

    it("keeps the variant choice for one picked set and hides it for several", async () => {
        api.choices.mockResolvedValue([A, B]);
        api.preview.mockResolvedValue({ID: A.ID, Name: "Alpha", Description: "", VersionID: "v", VariantCount: 2, Variant: 0, Tasks: []});
        renderMulti();
        await screen.findByText("Alpha");
        fireEvent.click(box("Alpha"));
        expect(await screen.findByRole("radio", {name: t("manage.exercises.attachDialog.variantPerTeam")})).toBeTruthy();
        fireEvent.click(box("Bravo"));
        await waitFor(() => expect(screen.queryByRole("radio", {name: t("manage.exercises.attachDialog.variantPerTeam")})).toBeNull());
        expect(screen.getByText(t("manage.exercises.attachDialog.multiVariants"))).toBeTruthy();
    });

    it("attaches the picked sets one request at a time with a variant per team, showing the progress, then closes", async () => {
        api.choices.mockResolvedValue([A, B, C]);
        const calls = [deferred(), deferred(), deferred()];
        api.attach.mockImplementation(() => calls[api.attach.mock.calls.length - 1].promise);
        const {onClose, onAttached} = renderMulti();
        await selectAll();
        fireEvent.click(screen.getByRole("button", {name: t("common.add")}));
        for (const [index, call] of calls.entries()) {
            await waitFor(() => expect(api.attach).toHaveBeenCalledTimes(index + 1));
            expect(screen.getByText(t("manage.exercises.attachDialog.addingProgress", {current: index + 1, total: 3}))).toBeTruthy();
            call.resolve();
        }
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(api.attach.mock.calls).toEqual([["e", A.PublishedVersionID, 0, null], ["e", B.PublishedVersionID, 0, null], ["e", C.PublishedVersionID, 0, null]]);
        expect(onAttached).toHaveBeenCalledTimes(1);
    });

    it("goes on after a failure, lists the failed sets with their messages and keeps only them picked", async () => {
        api.choices.mockResolvedValue([A, B, C]);
        api.attach.mockImplementation(async (_event: string, version: string) => {
            if (version === B.PublishedVersionID) throw new ManageApiError(409, 1808);
        });
        const {onClose, onAttached} = renderMulti();
        await selectAll();
        fireEvent.click(screen.getByRole("button", {name: t("common.add")}));
        const alert = await screen.findByRole("alert");
        expect(api.attach).toHaveBeenCalledTimes(3);
        expect(alert.textContent).toContain(t("manage.exercises.attachDialog.failedList.one", {count: 1, total: 3}));
        const item = within(alert).getByText("Bravo").closest("li")!;
        expect(item.textContent).toContain("Завдання потребує інфраструктури, а в заходу її вимкнено.");
        expect(within(alert).queryByText("Alpha")).toBeNull();
        expect(onClose).not.toHaveBeenCalled();
        expect(onAttached).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByText(counter(1))).toBeTruthy());
        expect(box("Bravo").checked).toBe(true);
        expect(box("Alpha").checked).toBe(false);
    });
});
