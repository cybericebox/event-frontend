// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import JoinPage from "./page";

const state = vi.hoisted(() => ({
    status: 0,
    participation: null as unknown,
    staff: false,
}));

vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: ReactNode}) => <a href={href} {...rest}>{children}</a>}));
vi.mock("next/navigation", () => ({useRouter: () => ({push: vi.fn(), replace: vi.fn()})}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => ({EventID: "event-1", Name: "Олімпіада", Registration: 2})}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => null}));
vi.mock("@/components/event/useStaffAccess", () => ({useStaffAccess: () => ({staff: state.staff, pending: false})}));
vi.mock("@/components/event/join/JoinPreview", () => ({JoinPreview: () => <div>join-preview</div>}));
vi.mock("@/components/event/EventLoading", () => ({EventLoading: ({label}: {label?: string}) => <div>{label}</div>}));
vi.mock("@/api/clientAuth", () => ({
    getCurrentUser: async () => ({ID: "u", FirstName: "", LastName: "", Email: ""}),
    getJoinStatus: async () => state.status,
    getInvitationInfo: async () => ({Status: state.status, Invited: false}),
    getParticipation: async () => state.participation,
}));
vi.mock("@/api/participantForm", async importOriginal => ({
    ...(await importOriginal<typeof import("@/api/participantForm")>()),
    getSelfParticipantForm: async () => ({Enabled: false}),
}));

const block = (register: {Allowed: boolean; Reason: string}, extra: Record<string, unknown> = {}) => ({Phase: "published", Staff: false, RosterOpen: true, RegistrationWindowOpen: true, Register: register, ...extra});

function view() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><JoinPage /></QueryClientProvider>);
}

beforeEach(() => { state.status = 0; state.participation = null; state.staff = false; });
afterEach(cleanup);

describe("join page", () => {
    it("offers the registration button when the server allows registering", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        view();
        expect(await screen.findByRole("button", {name: "Приєднатися"})).toBeTruthy();
    });

    it("gives event staff the registration preview instead of the refusal", async () => {
        state.staff = true;
        state.participation = block({Allowed: false, Reason: "staff_cannot_participate"}, {Staff: true});
        view();
        expect(await screen.findByText("join-preview")).toBeTruthy();
        expect(screen.queryByText(/Власники й модератори заходу не беруть участі як учасники/)).toBeNull();
    });

    it("never shows a participant the preview", async () => {
        state.participation = block({Allowed: true, Reason: ""});
        view();
        expect(await screen.findByRole("button", {name: "Приєднатися"})).toBeTruthy();
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
        expect(screen.queryByRole("button", {name: "Приєднатися"})).toBeNull();
    });
});
