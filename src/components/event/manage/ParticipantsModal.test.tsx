// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useSyncExternalStore} from "react";
import {ManageApiError} from "@/api/manage";
import type {ManageParticipant, ManageParticipantDetail} from "@/api/manageParticipants";
import {ParticipantsManager} from "./ParticipantsManager";

const nav = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    const state = {search: ""};
    return {
        state, listeners, replace: vi.fn(),
        set(value: string) {state.search = value; listeners.forEach(listener => listener());},
    };
});
vi.mock("next/navigation", () => ({
    usePathname: () => "/manage/participants",
    useRouter: () => ({replace: (url: string, options: unknown) => {nav.replace(url, options); nav.set(url.split("?")[1] ?? ""); window.history.replaceState(null, "", url);}}),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(listener => {nav.listeners.add(listener); return () => nav.listeners.delete(listener);}, () => nav.state.search, () => nav.state.search)),
}));

const api = vi.hoisted(() => ({detail: vi.fn()}));
let rows: ManageParticipant[];
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1", Participation: 1}, canManage: true})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("next/link", () => ({default: ({href, children}: {href: string; children: React.ReactNode}) => <a href={href}>{children}</a>}));
vi.mock("@/api/manage", async original => ({...(await original() as object), getManageConfig: async () => ({AllowPseudonyms: true})}));
vi.mock("@/api/manageParticipantForm", async original => ({...(await original() as object), getManageParticipantForm: async () => ({Version: 1, Enabled: true, Required: true, Document: {blocks: []}})}));
vi.mock("@/api/manageTeams", () => ({getManageTeams: async () => ({Items: [], Total: 0})}));
vi.mock("@/api/manageListColumns", () => ({getManageListColumns: async () => ({List: "participants", Columns: []}), putManageListColumns: vi.fn()}));
vi.mock("@/api/manageParticipants", async original => ({
    ...(await original() as object),
    getManageParticipant: (eventID: string, id: string) => api.detail(eventID, id),
    getManageParticipantsTable: async () => ({Items: rows, Total: rows.length, Page: 1, PageSize: 25, Counts: {Participants: rows.length, Applications: 0, Invitations: 0}}),
}));

const person = (id: string, name: string, extra: Partial<ManageParticipantDetail> = {}): ManageParticipantDetail => ({
    UserID: id, Name: name, Email: `${id}@test.test`, Pseudonym: "", DisplayName: name, TeamID: null, TeamName: "", Hidden: false, Invited: false, InvitedToTeam: false,
    InvitedTeamID: null, InvitedTeamName: "", InvitationSentAt: null, InvitationExpired: false, Status: 2, CreatedAt: "2026-09-01T10:00:00Z", DecidedAt: null,
    Answers: {}, FieldsMissing: 0, LastSeenAt: null, LastLabAt: null, TeamRole: null, JoinedVia: "open", Attempts: 0, Solves: 0, ...extra,
});
const ID_LIST = "11111111-1111-4111-8111-111111111111";
const ID_OTHER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
    rows = [person(ID_LIST, "Олена Коваль")];
    nav.replace.mockClear();
    api.detail.mockReset();
    api.detail.mockImplementation(async (_event: string, id: string) => id === ID_OTHER
        ? person(ID_OTHER, "Ігор Мельник", {TeamID: "33333333-3333-4333-8333-333333333333", TeamName: "Альфа", TeamRole: 0, JoinedVia: "invitation", InvitationSentAt: "2026-09-02T10:00:00Z", DecidedAt: "2026-09-03T10:00:00Z", Pseudonym: "ihor", Solves: 4, Attempts: 11})
        : person(id, "Олена Коваль"));
    nav.set("");
    window.history.replaceState(null, "", "/manage/participants");
});
afterEach(cleanup);

function renderManager() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ParticipantsManager initialTab="participants" /></QueryClientProvider>);
}

describe("last online and last in a laboratory", () => {
    it("shows both columns as a relative time with the exact time, and «ніколи» when it never happened", async () => {
        const seen = new Date(Date.now() - 5 * 60_000).toISOString();
        rows = [person(ID_LIST, "Олена Коваль", {LastSeenAt: seen, LastLabAt: null}), person(ID_OTHER, "Ігор Мельник")];
        renderManager();
        await screen.findByText("Олена Коваль");
        expect(screen.getByRole("button", {name: /Востаннє онлайн/})).toBeTruthy();
        expect(screen.getByRole("button", {name: /Востаннє в лабораторії/})).toBeTruthy();
        const first = screen.getByText("Олена Коваль").closest("tr")!;
        expect(first.textContent).toContain("5 хвилин тому");
        expect(first.textContent).toContain("ніколи");
        expect(screen.getByText("Ігор Мельник").closest("tr")!.textContent?.match(/ніколи/g)).toHaveLength(2);
    });

    it("sorts by the column through the table sort", async () => {
        renderManager();
        await screen.findByText("Олена Коваль");
        const header = screen.getByRole("button", {name: /Востаннє онлайн/}).closest("th")!;
        expect(header.getAttribute("aria-sort")).toBe("none");
        fireEvent.click(screen.getByRole("button", {name: /Востаннє онлайн/}));
        await waitFor(() => expect(screen.getByRole("button", {name: /Востаннє онлайн/}).closest("th")!.getAttribute("aria-sort")).not.toBe("none"));
    });
});

describe("participant modal in the URL", () => {
    it("opens from ?participant= for someone outside the list and shows the rich rows", async () => {
        nav.set(`participant=${ID_OTHER}`);
        renderManager();
        await screen.findByRole("dialog");
        const facts = await screen.findByTestId("participant-facts");
        expect(api.detail).toHaveBeenCalledWith("e1", ID_OTHER);
        expect(screen.getAllByText("Ігор Мельник").length).toBeGreaterThan(0);
        for (const text of ["Статус", "Псевдонім", "ihor", "Альфа", "Капітан", "За запрошенням", "Запрошення надіслано", "Рішення ухвалено", "Розвʼязано завдань", "4", "Спроб", "11"]) expect(facts.textContent).toContain(text);
    });

    it("a row click sets the param and keeps the others; close removes it", async () => {
        window.history.replaceState(null, "", "/manage/participants?tab=participants");
        renderManager();
        fireEvent.click((await screen.findByText("Олена Коваль")).closest("tr")!);
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/manage/participants?tab=participants&participant=${ID_LIST}`, {scroll: false}));
        await screen.findByRole("dialog");
        nav.replace.mockClear();
        fireEvent.click(screen.getAllByRole("button", {name: "Закрити"}).at(-1)!);
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/manage/participants?tab=participants", {scroll: false}));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("an unknown id shows the not-found state", async () => {
        api.detail.mockRejectedValue(new ManageApiError(404));
        nav.set("participant=nope");
        renderManager();
        await screen.findByRole("dialog");
        await waitFor(() => expect(screen.getAllByText("Учасника не знайдено").length).toBeGreaterThan(0));
    });
});
