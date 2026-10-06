// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {JoinPreview} from "./JoinPreview";

vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: ReactNode}) => <a href={href} {...rest}>{children}</a>}));
vi.mock("@/components/event/EventLoading", () => ({EventLoading: ({label}: {label?: string}) => <div>{label}</div>}));
vi.mock("@/api/manageParticipantForm", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/manageParticipantForm")>()),
    getManageParticipantForm: async () => ({
        Version: 1, Enabled: true, Required: true,
        Document: {blocks: [{type: "field", id: "b1", key: "school", label: "Школа", input: "text", required: true, editable: true}]},
    }),
}));

const fetchMock = vi.fn();
const event = (extra: Partial<PublicEventInfo> = {}) => ({EventID: "event-1", Name: "Олімпіада", Participation: 0, Registration: 1, ...extra}) as PublicEventInfo;

function view(info: PublicEventInfo) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><JoinPreview event={info} /></QueryClientProvider>);
}

const writes = () => fetchMock.mock.calls.filter(([, init]) => ["POST", "PUT", "PATCH", "DELETE"].includes(String(init?.method ?? "GET").toUpperCase()));

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("walks form, validation and result without any network write", async () => {
    view(event());
    expect(screen.getByText("Перегляд реєстрації — нічого не зберігається")).toBeTruthy();
    const input = await screen.findByLabelText(/Школа/);
    fireEvent.click(screen.getByRole("button", {name: "Приєднатися"}));
    expect(screen.getByRole("alert").textContent).toContain("Школа");
    fireEvent.change(input, {target: {value: "Ліцей"}});
    fireEvent.click(screen.getByRole("button", {name: "Приєднатися"}));
    expect(screen.getByText("Заявку подано")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Далі"}));
    expect(screen.getByRole("link", {name: "Відкрити «Моя участь»"}).getAttribute("href")).toBe("/participation");
    expect(writes()).toEqual([]);
});

it("switches the outcome and offers the team step to an approved team participant", async () => {
    view(event({Participation: 1, Registration: 2}));
    const input = await screen.findByLabelText(/Школа/);
    fireEvent.change(input, {target: {value: "Ліцей"}});
    fireEvent.click(screen.getByRole("button", {name: "Відхилено"}));
    fireEvent.click(screen.getByRole("button", {name: "Приєднатися"}));
    expect(screen.getByText("Заявку відхилено")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Схвалено"}));
    expect(screen.getByText("Ви зареєстровані")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Далі"}));
    expect(screen.getByText("Створити команду", {selector: "h2, h3, span, div"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Далі"}));
    expect(screen.getByRole("link", {name: "Відкрити «Моя участь»"})).toBeTruthy();
    expect(writes()).toEqual([]);
});
