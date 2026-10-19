// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {ParticipantPreviewProvider, ParticipantPreviewEntry, useParticipantPreview} from "../ParticipantPreview";
import {JoinPreview} from "./JoinPreview";

vi.mock("next/navigation", () => ({usePathname: () => "/join", useRouter: () => ({push: vi.fn()})}));
vi.mock("@/api/clientAuth", () => ({getCurrentUser: async () => ({ID: "00000000-0000-4000-8000-000000000001"})}));
vi.mock("@/api/manage", async importOriginal => ({...await importOriginal<typeof import("@/api/manage")>(), getManageAccess: async () => ({CanManage: true})}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => null}));
vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: ReactNode}) => <a href={href} {...rest}>{children}</a>}));
vi.mock("@/components/event/EventLoading", () => ({EventLoading: ({label}: {label?: string}) => <div>{label}</div>}));
vi.mock("@/api/manageParticipantForm", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/manageParticipantForm")>()),
    getManageParticipantForm: async () => ({
        Version: 1, Enabled: true, Required: true,
        Document: {blocks: [{type: "field", id: "b1", key: "school", label: "Школа", input: "text", required: true, editable: true}, {type: "field", id: "private", key: "internal", label: "Внутрішня примітка", input: "text", staffOnly: true}]},
    }),
}));

const fetchMock = vi.fn();
const event = (extra: Partial<PublicEventInfo> = {}) => ({EventID: "event-1", Name: "Олімпіада", Participation: 0, Registration: 1, ...extra}) as PublicEventInfo;

function view(info: PublicEventInfo, warm = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    client.setQueryData(["event-current-user"], {ID: "00000000-0000-4000-8000-000000000001"});
    client.setQueryData(["event-management-access", info.EventID], {CanManage: true});
    if (warm) client.setQueryData(["event-management-participant-form", info.EventID], {Version: 1, Enabled: true, Required: true, Document: {blocks: [
        {type: "field", id: "b1", key: "school", label: "Школа", input: "text", required: true, editable: true},
        {type: "field", id: "private", key: "internal", label: "Внутрішня примітка", input: "text", staffOnly: true},
    ]}});
    const mounted = render(<QueryClientProvider client={client}><ParticipantPreviewProvider><ParticipantPreviewEntry eventID={info.EventID} registration={info.Registration} /><ActivePreview event={info} /></ParticipantPreviewProvider></QueryClientProvider>);
    return {...mounted, client};
}

function ActivePreview({event}: {event: PublicEventInfo}) {const preview = useParticipantPreview(event.EventID); return preview.active ? <JoinPreview event={event} /> : null;}

async function chooseOutcome(name: string) {
    fireEvent.pointerDown(within(screen.getByRole("dialog")).getByRole("button", {name: "Дії тестового режиму"}), {button: 0, ctrlKey: false});
    fireEvent.click(await screen.findByRole("menuitemradio", {name}));
}

const writes = () => fetchMock.mock.calls.filter(([, init]) => ["POST", "PUT", "PATCH", "DELETE"].includes(String(init?.method ?? "GET").toUpperCase()));

beforeEach(() => { sessionStorage.clear(); HTMLDialogElement.prototype.showModal = function () {this.open = true;}; HTMLDialogElement.prototype.close = function () {this.open = false;}; fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows a pending result in a dialog without offering team access or writing to the server", async () => {
    view(event());
    fireEvent.click(await screen.findByRole("button", {name: "Тестувати як учасник"}));
    const input = await screen.findByLabelText(/Школа/);
    fireEvent.click(screen.getByRole("button", {name: "Приєднатися"}));
    // The message sits under its question, so it does not repeat the question.
    expect(screen.getByRole("alert").textContent).toBe("Обовʼязкове поле");
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
    fireEvent.change(input, {target: {value: "Ліцей"}});
    fireEvent.click(screen.getByRole("button", {name: "Приєднатися"}));
    expect(screen.getByRole("dialog", {name: "Заявку подано"})).toBeTruthy();
    expect(screen.getByRole("button", {name: "Гаразд"})).toBeTruthy();
    expect(screen.queryByRole("link", {name: "Перейти до команди"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Далі"})).toBeNull();
    expect(writes()).toEqual([]);
});

it("offers team access only for an approved application, with no intermediate completion screen", async () => {
    view(event({Participation: 1, Registration: 2}));
    fireEvent.click(await screen.findByRole("button", {name: "Тестувати як учасник"}));
    fireEvent.change(await screen.findByLabelText(/Школа/), {target: {value: "Ліцей"}});
    await chooseOutcome("Відхилено");
    fireEvent.click(screen.getByRole("button", {name: "Приєднатися"}));
    expect(screen.getByRole("dialog", {name: "Заявку відхилено"})).toBeTruthy();
    expect(screen.queryByRole("link", {name: "Перейти до команди"})).toBeNull();
    await chooseOutcome("Схвалено");
    expect(screen.getByRole("dialog", {name: "Ви зареєстровані"})).toBeTruthy();
    expect(screen.getByRole("link", {name: "Перейти до команди"}).getAttribute("href")).toBe("/participation?tab=team");
    expect(screen.queryByRole("button", {name: "Далі"})).toBeNull();
    expect(writes()).toEqual([]);
});

it.each([false, true])("filters staff-only fields for preview without changing the management cache (warm=%s)", async warm => {
    const {client} = view(event(), warm);
    fireEvent.click(await screen.findByRole("button", {name: "Тестувати як учасник"}));
    await screen.findByLabelText(/Школа/);
    expect(screen.queryByLabelText(/Внутрішня примітка/)).toBeNull();
    const cached = client.getQueryData<{Document: {blocks: {key: string}[]}}>(["event-management-participant-form", "event-1"]);
    expect(cached?.Document.blocks.some(field => field.key === "internal")).toBe(true);
});
