// @vitest-environment jsdom
import {afterEach, beforeAll, beforeEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const api = vi.hoisted(() => ({create: vi.fn(), join: vi.fn(), fields: null as unknown}));
vi.mock("next/navigation", async importOriginal => ({...await importOriginal<object>(), useRouter: () => ({push: vi.fn(), replace: vi.fn()}), usePathname: () => "/participation"}));
vi.mock("../ParticipantPreview", () => ({useParticipantPreview: () => ({active: false, state: null, config: null}), participantPreviewForm: (form: unknown) => form, previewAnswerFile: vi.fn()}));
vi.mock("@/components/event/ParticipantPreview", () => ({useParticipantPreview: () => ({active: false, state: null, config: null}), previewAnswerFile: vi.fn()}));
vi.mock("@/api/eventTeams", async importOriginal => ({
    ...await importOriginal<object>(),
    createEventTeam: (...args: unknown[]) => api.create(...args),
    joinEventTeam: (...args: unknown[]) => api.join(...args),
    getSelfTeamFields: async () => api.fields,
}));

const {NoTeam} = await import("./NoTeam");
const event = {EventID: "event-1", Name: "Захід", Participation: 1} as Parameters<typeof NoTeam>[0]["event"];

function view() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <NoTeam event={event} rosterOpen closedReason="" linkCode="" preview={false} />
    </QueryClientProvider>);
}

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {this.removeAttribute("open");};
});
beforeEach(() => {api.create.mockReset(); api.join.mockReset(); api.fields = null; sessionStorage.clear();});
afterEach(cleanup);

it("joins and creates from one card, with a single-line code field", () => {
    view();
    const card = screen.getByRole("region", {name: "Приєднатися за посиланням"});
    const field = within(card).getByRole("textbox", {name: "Посилання або код команди"});
    expect(field.tagName).toBe("INPUT");
    expect(within(card).getByRole("button", {name: "Приєднатися"})).toBeTruthy();
    expect(within(card).getByRole("button", {name: "Створити команду"})).toBeTruthy();
    expect(screen.getAllByRole("region")).toHaveLength(1);
});

async function openCreate() {
    view();
    fireEvent.click(screen.getByRole("button", {name: "Створити команду"}));
    // The submit waits for the team questions.
    const submit = screen.getByRole("button", {name: "Створити"}) as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(false));
    return submit;
}

it("checks the team name itself and puts the message under the field", async () => {
    const submit = await openCreate();
    await act(async () => {fireEvent.click(submit);});
    const name = screen.getByRole("textbox", {name: /Назва команди/});
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toBe("Введіть назву команди");
    fireEvent.change(name, {target: {value: "ab"}});
    await act(async () => {fireEvent.click(submit);});
    expect(screen.getByText("Назва — щонайменше 3 символи")).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();
});

it("marks an empty required team question under that question", async () => {
    api.fields = {Version: 1, Enabled: true, Required: true, Document: {blocks: [{id: "b1", type: "field", key: "school", label: "Заклад", input: "short_text", required: true, editable: true}]}};
    const submit = await openCreate();
    await screen.findByText("Заклад");
    fireEvent.change(screen.getByRole("textbox", {name: /Назва команди/}), {target: {value: "Сині"}});
    await act(async () => {fireEvent.click(submit);});
    expect(screen.getByText("Обовʼязкове поле")).toBeTruthy();
    expect(screen.getByRole("textbox", {name: /Заклад/}).getAttribute("aria-invalid")).toBe("true");
    expect(api.create).not.toHaveBeenCalled();
});
