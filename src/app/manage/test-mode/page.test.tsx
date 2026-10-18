// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
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
function view() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return {...render(<QueryClientProvider client={client}><Page /></QueryClientProvider>), client};
}
afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks(); api.manage = true;
    api.get.mockResolvedValue({DefaultSelections: [selection], DefaultGroupName: "Платформна група", DynamicAllocated: false, GroupName: "Тестова група", GroupNameOverride: null, Inherit: true, Selections: [], EffectiveSelections: [selection]});
    api.catalog.mockResolvedValue([{ID: "e1", ExerciseVersionID: "v1", Name: "Файл", Infrastructure: false, Variants: [{ID: "a", Index: 0}]}]);
    api.save.mockImplementation(async (_eventID, draft) => ({...await api.get(), ...draft, EffectiveSelections: draft.Inherit ? [selection] : draft.Selections}));
});

it("inherits defaults without loading the editable catalog", async () => {
    view();
    expect(await screen.findByText("Файл")).toBeTruthy();
    expect(screen.getByText("Завдання за замовчуванням")).toBeTruthy();
    expect(api.catalog).not.toHaveBeenCalled();
    expect(screen.getByRole("button", {name: "Додати завдання"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Відновити налаштування за замовчуванням"})).toBeNull();
});

it("copies defaults for customization and can save an explicitly empty override", async () => {
    view();
    fireEvent.click(await screen.findByRole("button", {name: "Прибрати «Файл»"}));
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({Inherit: false, Selections: []})));
});

it("restores inheritance rather than saving an empty custom selection", async () => {
    api.get.mockResolvedValue({DefaultSelections: [selection], DefaultGroupName: "Платформна група", DynamicAllocated: false, GroupName: "Тестова група", GroupNameOverride: null, Inherit: false, Selections: [selection], EffectiveSelections: [selection]});
    view();
    fireEvent.click(await screen.findByRole("button", {name: "Відновити налаштування за замовчуванням"}));
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({GroupNameOverride: null, Inherit: true, Selections: []})));
});

it("does not offer overrides to read-only event staff", async () => {
    api.manage = false; view();
    expect(await screen.findByText("Файл")).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Прибрати «Файл»"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Додати завдання"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Зберегти"})).toBeNull();
});

it("snapshots platform selections when the group is first edited", async () => {
    view();
    fireEvent.change(await screen.findByRole("textbox", {name: "Назва тестової групи"}), {target: {value: "Моя група"}});
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({GroupNameOverride: "Моя група", Inherit: false, Selections: [selection]})));
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

it("restores both the group name and the live platform selection", async () => {
    const custom = {...selection, ExerciseVersionID: "custom", Name: "Власний файл"};
    api.get.mockResolvedValue({DefaultSelections: [selection], DefaultGroupName: "Платформа", DynamicAllocated: false, GroupName: "Власна назва", GroupNameOverride: "Власна назва", Inherit: false, Selections: [custom], EffectiveSelections: [custom]});
    view();
    fireEvent.click(await screen.findByRole("button", {name: "Відновити налаштування за замовчуванням"}));
    expect(screen.getByRole("button", {name: "Файл"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Власний файл"})).toBeNull();
    expect(screen.getByRole("textbox", {name: "Назва тестової групи"})).toHaveProperty("value", "Платформа");
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({Inherit: true, Selections: [], GroupNameOverride: null})));
});

it("keeps inherited data current but freezes a local copy after an edit", async () => {
    const {client} = view();
    await screen.findByRole("button", {name: "Файл"});
    const newer = {...selection, ExerciseVersionID: "v2", Name: "Оновлений файл"};
    const original = await api.get();
    await act(async () => {client.setQueryData(["event-preview-settings", "e1"], {...original, DefaultSelections: [newer]});});
    await screen.findByRole("button", {name: "Оновлений файл"});
    fireEvent.change(screen.getByRole("textbox", {name: "Назва тестової групи"}), {target: {value: "Мій набір"}});
    await act(async () => {client.setQueryData(["event-preview-settings", "e1"], original);});
    expect(screen.getByRole("button", {name: "Оновлений файл"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("e1", expect.objectContaining({Inherit: false, Selections: [newer]})));
});

it("preserves a local draft if saving fails", async () => {
    api.save.mockRejectedValue(new Error("offline"));
    view();
    fireEvent.click(await screen.findByRole("button", {name: "Прибрати «Файл»"}));
    fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", {name: "Файл"})).toBeNull();
    expect(screen.getByRole("button", {name: "Зберегти"})).toHaveProperty("disabled", false);
});
