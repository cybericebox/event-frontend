// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {PreviewSettingsPage as Page} from "@/components/event/manage/exercises/PreviewSettingsPage";

const api = vi.hoisted(() => ({get: vi.fn(), catalog: vi.fn(), save: vi.fn(), manage: true}));
vi.mock("@/api/managePreviewSettings", async original => ({...await original<typeof import("@/api/managePreviewSettings")>(), getPreviewSettings: api.get, getPreviewCatalog: api.catalog, savePreviewSettings: api.save}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1"}, canManage: api.manage})}));
vi.mock("@/components/event/manage/manualDraft", async () => {
    const {useState} = await import("react");
    return {useDraftDirty: () => {}, useSessionDraftState: <T,>(_key: string, initial: T) => useState(initial)};
});
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn()}}));
const selection = {ExerciseVersionID: "v1", VariantID: "a", Name: "Файл"};
function view() {return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><Page /></QueryClientProvider>);}
afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks(); api.manage = true;
    api.get.mockResolvedValue({DefaultSelections: [selection], DefaultGroupName: "Платформна група", DynamicAllocated: false, GroupName: "Тестова група", GroupNameOverride: null, Inherit: true, Selections: [], EffectiveSelections: [selection]});
    api.catalog.mockResolvedValue([{ID: "e1", ExerciseVersionID: "v1", Name: "Файл", Infrastructure: false, Variants: [{ID: "a", Index: 0}]}]);
    api.save.mockImplementation(async (_eventID, draft) => ({...draft, EffectiveSelections: draft.Inherit ? [selection] : draft.Selections}));
});

it("inherits defaults without loading the editable catalog", async () => {
    view();
    expect(await screen.findByText("Файл")).toBeTruthy();
    expect(screen.getByText("Набір платформи")).toBeTruthy();
    expect(api.catalog).not.toHaveBeenCalled();
});

it("copies defaults for customization and can save an explicitly empty override", async () => {
    view();
    fireEvent.click(await screen.findByRole("button", {name: "Змінити для заходу"}));
    fireEvent.click(screen.getByRole("button", {name: "Прибрати «Файл»"}));
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({Inherit: false, Selections: []})));
});

it("restores inheritance rather than saving an empty custom selection", async () => {
    api.get.mockResolvedValue({DefaultSelections: [selection], DefaultGroupName: "Платформна група", DynamicAllocated: false, GroupName: "Тестова група", GroupNameOverride: null, Inherit: false, Selections: [selection], EffectiveSelections: [selection]});
    view();
    fireEvent.click(await screen.findByRole("button", {name: "Використовувати набір платформи"}));
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({GroupNameOverride: null, Inherit: true, Selections: []})));
});

it("does not offer overrides to read-only event staff", async () => {
    api.manage = false; view();
    expect(await screen.findByText("Файл")).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Змінити для заходу"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Зберегти"})).toBeNull();
});

it("renames the single group while keeping platform selections inherited", async () => {
    view();
    fireEvent.change(await screen.findByRole("textbox", {name: "Назва тестової групи"}), {target: {value: "Моя група"}});
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({GroupNameOverride: "Моя група", Inherit: true})));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
});

it("keeps newer edits when an earlier save finishes", async () => {
    let complete!: (value: unknown) => void;
    api.save.mockImplementation(() => new Promise(resolve => {complete = resolve;}));
    view();
    const name = await screen.findByRole("textbox", {name: "Назва тестової групи"});
    fireEvent.change(name, {target: {value: "Перша назва"}});
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    fireEvent.change(name, {target: {value: "Нова назва"}});
    complete({DefaultSelections: [selection], DefaultGroupName: "Платформа", DynamicAllocated: false, GroupName: "Перша назва", GroupNameOverride: "Перша назва", Inherit: true, Selections: [], EffectiveSelections: [selection]});
    await waitFor(() => expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", false));
    expect(name).toHaveProperty("value", "Нова назва");
});

it("shows platform selections immediately when restoring, and copies them when customizing again", async () => {
    const custom = {...selection, ExerciseVersionID: "custom", Name: "Власний файл"};
    api.get.mockResolvedValue({DefaultSelections: [selection], DefaultGroupName: "Платформа", DynamicAllocated: false, GroupName: "Власна назва", GroupNameOverride: "Власна назва", Inherit: false, Selections: [custom], EffectiveSelections: [custom]});
    view();
    fireEvent.click(await screen.findByRole("button", {name: "Використовувати набір платформи"}));
    expect(screen.getByRole("button", {name: "Файл"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Власний файл"})).toBeNull();
    fireEvent.click(screen.getByRole("button", {name: "Змінити для заходу"}));
    fireEvent.click(screen.getByRole("button", {name: "Відновити назву платформи"}));
    expect(screen.getByRole("textbox", {name: "Назва тестової групи"})).toHaveProperty("value", "Платформа");
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({Inherit: false, Selections: [selection], GroupNameOverride: null})));
});
