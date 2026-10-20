// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, act} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import JoinPage from "./page";
import {consumeJoinIntent, createJoinIntent} from "@/utils/joinIntent";

const api = vi.hoisted(() => ({join: vi.fn(async () => 2), push: vi.fn(), replace: vi.fn(), invitation:vi.fn()}));
const state = vi.hoisted(() => ({
    status: 0,
    participation: null as unknown,
    staff: false,
    form: false,
    participant: null as unknown,
}));

vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: ReactNode}) => <a href={href} {...rest}>{children}</a>}));
vi.mock("next/navigation", () => ({useRouter: () => ({push: api.push, replace: api.replace})}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => ({EventID: "event-1", Name: "Олімпіада", Registration: 2, Participation: state.participant ? 1 : 0})}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => state.participant}));
vi.mock("@/components/event/useStaffAccess", () => ({useStaffAccess: () => ({staff: state.staff, pending: false})}));
vi.mock("@/components/event/join/JoinPreview", () => ({JoinPreview: () => <div>join-preview</div>}));
vi.mock("@/components/event/EventLoading", () => ({EventLoading: ({label}: {label?: string}) => <div>{label}</div>}));
vi.mock("@/api/clientAuth", () => ({
    getCurrentUser: async () => ({ID: "u", FirstName: "", LastName: "", Email: ""}),
    getJoinStatus: async () => state.status,
    getInvitationInfo: () => api.invitation(),
    getParticipation: async () => state.participation,
}));
vi.mock("@/api/participantForm", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/participantForm")>()),
    getSelfParticipantForm: async () => ({Enabled: state.form, Document: {blocks: []}}),
    joinSelfEvent: () => api.join(),
}));

const block = (register: {Allowed: boolean; Reason: string}, extra: Record<string, unknown> = {}) => ({Phase: "published", Staff: false, RosterOpen: true, RegistrationWindowOpen: true, Register: register, ...extra});

function view() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><JoinPage /></QueryClientProvider>);
}

beforeEach(() => { HTMLDialogElement.prototype.showModal=function(){this.open=true;}; HTMLDialogElement.prototype.close=function(){this.open=false;}; api.replace.mockReset(); api.invitation.mockReset(); api.invitation.mockImplementation(async()=>({Status:state.status,Invited:false})); state.status = 0; state.participation = null; state.staff = false; state.form = false; state.participant = null; api.join.mockClear(); window.history.replaceState(null, "", "/join"); sessionStorage.clear(); });
afterEach(cleanup);

describe("join page", () => {
    it("does not ask a participant who already has a team to create or join one", async () => {
        state.status = 2;
        state.participant = {event: {EventID: "event-1", Name: "Олімпіада", Participation: 1}, ownTeam: {ID: "t", Name: "Сині"}};
        view();
        expect(await screen.findByText("Ви вже в команді «Сині».")).toBeTruthy();
        expect(screen.queryByText(/Створіть команду/)).toBeNull();
    });

    it("offers the registration button when the server allows registering", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        view();
        expect(await screen.findByRole("button", {name: "Підтвердити участь"})).toBeTruthy();
    });

    it("requires staff to enter the global test mode from management", async () => {
        state.staff = true;
        state.participation = block({Allowed: false, Reason: "staff_cannot_participate"}, {Staff: true});
        view();
        expect(await screen.findByText(/Власники й модератори заходу не беруть участі як учасники/)).toBeTruthy();
        expect(screen.queryByText("join-preview")).toBeNull();
    });

    it("never shows a participant the preview", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        view();
        expect(await screen.findByRole("button", {name: "Підтвердити участь"})).toBeTruthy();
        expect(screen.queryByText("join-preview")).toBeNull();
    });

    it.each([
        ["closed_at_start", /реєстрація після старту вимкнена/],
        ["not_published", /ще не опубліковано/],
        ["event_finished", /Захід завершено/],
        ["registration_closed", /Організатори закрили реєстрацію/],
    ])("says why registration is closed: %s", async (reason, text) => {
        state.participation = block({Allowed: false, Reason: reason});
        view();
        expect(await screen.findByText(text)).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Підтвердити участь"})).toBeNull();
    });

    it("explains a bare visit with no fields instead of showing an empty form", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        view();
        expect(await screen.findByText("Для цього заходу додаткові поля не потрібні. Підтвердьте участь одним натисканням.")).toBeTruthy();
    });

    it("shows only the registering loader while a no-field application is sent after a click", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        let finish!: (v: number) => void;
        api.join.mockImplementationOnce(() => new Promise<number>(r => {finish = r;}));
        window.history.replaceState(null, "", `/join?continue=${createJoinIntent("event-1")}`);
        view();
        await vi.waitFor(() => expect(api.join).toHaveBeenCalledTimes(1));
        expect(screen.getByText("Реєструємо…")).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Підтвердити участь"})).toBeNull();
        await act(async () => finish(1));
        expect(await screen.findByText("Заявку подано")).toBeTruthy();
    });

    it("labels the busy submit of a form «Надсилаємо…»", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        state.form = true;
        let finish!: (v: number) => void;
        api.join.mockImplementationOnce(() => new Promise<number>(r => {finish = r;}));
        view();
        (await screen.findByRole("button", {name: "Надіслати заявку"})).click();
        expect(await screen.findByText("Надсилаємо…")).toBeTruthy();
        await act(async () => finish(2));
    });

    it("sends the application by itself after the sign-in this browser started", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        const nonce = createJoinIntent("event-1");
        window.history.replaceState(null, "", `/join?continue=${nonce}`);
        view();
        await vi.waitFor(() => expect(api.join).toHaveBeenCalledTimes(1));
        expect(window.location.search).toBe("");
    });

    it("does not send anything for a forged link (no flow started here)", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        window.history.replaceState(null, "", "/join?continue=1");
        view();
        await screen.findByRole("button", {name: "Підтвердити участь"});
        expect(api.join).not.toHaveBeenCalled();
        expect(window.location.search).toBe("");
    });

    it("does not send anything for a wrong nonce, and drops the stored one", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        createJoinIntent("event-1");
        window.history.replaceState(null, "", `/join?continue=${"0".repeat(32)}`);
        view();
        await screen.findByRole("button", {name: "Підтвердити участь"});
        expect(api.join).not.toHaveBeenCalled();
        expect(consumeJoinIntent("event-1", "0".repeat(32))).toBe(false);
    });

    it("does not send anything for an expired nonce", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        const nonce = createJoinIntent("event-1", Date.now() - 60 * 60 * 1000);
        window.history.replaceState(null, "", `/join?continue=${nonce}`);
        view();
        await screen.findByRole("button", {name: "Підтвердити участь"});
        expect(api.join).not.toHaveBeenCalled();
    });

    it("does not send anything for a nonce of another event", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        const nonce = createJoinIntent("event-2");
        window.history.replaceState(null, "", `/join?continue=${nonce}`);
        view();
        await screen.findByRole("button", {name: "Підтвердити участь"});
        expect(api.join).not.toHaveBeenCalled();
    });

    it("does not send again on a replay of the same link", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        const nonce = createJoinIntent("event-1");
        window.history.replaceState(null, "", `/join?continue=${nonce}`);
        view();
        await vi.waitFor(() => expect(api.join).toHaveBeenCalledTimes(1));
        cleanup();
        window.history.replaceState(null, "", `/join?continue=${nonce}`);
        view();
        await screen.findByRole("button", {name: "Підтвердити участь"});
        expect(api.join).toHaveBeenCalledTimes(1);
    });

    it("waits for the visitor when the registration has a form, even with a valid nonce", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        state.form = true;
        const nonce = createJoinIntent("event-1");
        window.history.replaceState(null, "", `/join?continue=${nonce}`);
        view();
        await screen.findByRole("button", {name: "Надіслати заявку"});
        expect(api.join).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", {name: "Підтвердити участь"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Приєднатися"})).toBeNull();
});
});

it("keeps invitation checks visible instead of claiming an application was submitted", async()=>{
 state.status=1;state.participation=block({Allowed:false,Reason:""});
 let resolve!: (value:unknown)=>void;
 api.invitation.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 view();await vi.waitFor(()=>expect(api.invitation).toHaveBeenCalled());
 expect(screen.queryByRole("dialog",{name:"Заявку подано"})).toBeNull();
 await act(async()=>resolve({Status:1,Invited:true}));
 await vi.waitFor(()=>expect(api.replace).toHaveBeenCalledWith("/invite"));
 expect(screen.queryByRole("dialog",{name:"Заявку подано"})).toBeNull();
});
it("does not mask an invitation load error as a submitted application",async()=>{
 state.status=1;state.participation=block({Allowed:false,Reason:""});api.invitation.mockRejectedValue(new Error("unavailable"));
 view();await screen.findByRole("button",{name:"Спробувати ще раз"});
 expect(screen.queryByRole("dialog",{name:"Заявку подано"})).toBeNull();
});
it("offers an approved individual the participation page, never team setup",async()=>{
 state.status=2;state.participation=block({Allowed:false,Reason:""});view();
 const link=await screen.findByRole("link",{name:"Участь"});expect(link.getAttribute("href")).toBe("/participation");
 expect(screen.queryByRole("link",{name:"Перейти до команди"})).toBeNull();
});
