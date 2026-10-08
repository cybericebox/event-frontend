// @vitest-environment jsdom
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useEffect, useState} from "react";
import {ownBoardSchema, type ChallengeSubmission, type OwnBoard, type OwnChallenge} from "@/api/participantChallenges";
import type {LabRuntime} from "@/api/manageLabs";
import type {ModeratorSubmission} from "@/api/moderatorsBoard";
import {ParticipantChallengeError} from "@/api/participantChallenges";
import {ApiErrorCode} from "@/api/apiErrors";
import {PublicEventInfoSchema} from "@/types/publicEventInfo";
import {runningLab, completedLab} from "@/test/labLifecycle";
import {fixtureChallenge} from "./fixtures/challengeFixture";
import {t} from "@/i18n/t";

const api = vi.hoisted(() => ({board: vi.fn(), runtime: vi.fn(), submit: vi.fn(), push: vi.fn(), refresh: vi.fn(), moderators: false}));
vi.mock("next/navigation", () => ({usePathname: () => "/challenges", useRouter: () => ({push: api.push, refresh: api.refresh})}));
vi.mock("@/api/authAPI", () => ({signOut: async () => {}}));
vi.mock("@/api/clientAuth", async original => ({...await original<typeof import("@/api/clientAuth")>(), getCurrentUser: async () => ({ID: "user-a", Role: "admin", FirstName: "Test", LastName: "User", Email: "test@example.test", Picture: ""})}));
vi.mock("@/api/navigationPages", () => ({getNavigationPages: async () => []}));
vi.mock("@/api/manage", async original => ({...await original<typeof import("@/api/manage")>(), getManageAccess: async () => ({CanManage: true, InfrastructureAllowed: true}), getManagePages: async () => []}));
vi.mock("@/api/participantChallenges", async original => ({...await original<typeof import("@/api/participantChallenges")>(), getOwnBoard: () => api.board(), getOwnChallengeLab: () => api.runtime(), submitChallenge: () => api.submit()}));
vi.mock("@/api/moderatorsBoard", async original => ({...await original<typeof import("@/api/moderatorsBoard")>(), getModeratorsBoard: () => api.board(), submitModeratorFlag: () => api.submit()}));
vi.mock("@/api/manageLabs", async original => ({...await original<typeof import("@/api/manageLabs")>(), getModeratorChallengeLab: () => api.runtime()}));
vi.mock("@/api/taskOpenedBeacon", () => ({reportTaskOpened: () => {}}));
vi.mock("@/components/event/EventCountdown", () => ({EventCountdown: () => null}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => api.moderators ? null : ({event, participantInfo: {}, ownTeam: {ID: "team-a", Admitted: true, Formed: true, MemberCount: 2}})}));
vi.mock("@/components/event/GuestShell", () => ({useGuestEvent: () => api.moderators ? event : null}));
vi.mock("@/components/event/PrivateEventBootstrap", () => ({usePrivateEvent: () => null}));
vi.mock("@/components/event/vpn/EventVpn", () => ({useEventVpn: () => ({available: false, openVpn: () => {}}), EventVpnProvider: ({children}: {children: React.ReactNode}) => children, VpnHeaderButton: () => null}));
vi.mock("@/components/event/useStaffAccess", () => ({useStaffAccess: () => ({staff: false})}));
vi.mock("@/components/event/manage/ManagerEntry", () => ({ManagerEntry: () => null}));
vi.mock("@/components/event/InboxButton", () => ({InboxButton: () => null}));
vi.mock("@/utils/origins", async original => ({...await original<typeof import("@/utils/origins")>(), requireApiOrigin: () => "https://api.test"}));

const event = PublicEventInfoSchema.parse({EventID: "00000000-0000-4000-8000-000000000010", Tag: "event-a", Name: "Event A", StartTime: "2026-01-01T00:00:00Z", FinishTime: null, Status: 1, Participation: 1, Registration: 1, CanViewResults: false, CanViewParticipants: false, PreviewDescription: "", PreviewPicture: "", Theme: {Brand: "#123456", Accent: "", AccentLight: "#123456", AccentDark: "#123456", AccentLive: "#123456", Version: 1}});
const question = {...fixtureChallenge, Snapshot: {...fixtureChallenge.Snapshot, name: "Pending task", description: {}}, SolvedAt: null, Hints: [], Lab: runningLab};
const initial = ownBoardSchema.parse({ServerNow: "2026-10-08T12:00:00Z", Challenges: [question]});
const runtime: LabRuntime = {Lab: completedLab, Phase: "Ready", Ready: true, VPNCIDR: "", InternetCIDR: "", Access: [], Queue: null};
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((reply, fail) => {resolve = reply; reject = fail;});
    return {promise, resolve, reject};
}
const {ChallengesBoard} = await import("./ChallengesBoard");
const {EventNavbar} = await import("@/components/event/EventNavigation");

function Session() {
    const [signedIn, setSignedIn] = useState(true);
    useEffect(() => {api.push.mockImplementation(() => setSignedIn(false));}, []);
    // Root QueryClientProvider stays mounted across the actual logout's client navigation.
    return signedIn ? <><EventNavbar event={event} authenticated approved /><ChallengesBoard /></> : <p>Signed out</p>;
}
beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {observe() {} disconnect() {}});
    HTMLDialogElement.prototype.showModal = function() {this.setAttribute("open", "");};
    HTMLDialogElement.prototype.close = function() {this.removeAttribute("open");};
});
afterAll(() => {vi.unstubAllGlobals();});
afterEach(() => {cleanup(); vi.clearAllMocks(); api.board.mockReset(); api.runtime.mockReset(); api.submit.mockReset(); api.moderators = false;});

describe("pending lifecycle work across actual account-menu logout", () => {
    it.each([{moderators: false, failedSubmission: false}, {moderators: true, failedSubmission: false}, {moderators: false, failedSubmission: true}])("does not recreate board/runtime/submission authority after clear ($moderators, failed=$failedSubmission)", async ({moderators, failedSubmission}) => {
        api.moderators = moderators;
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        const boardReply = deferred<OwnBoard | OwnChallenge[]>();
        const runtimeReply = deferred<LabRuntime>();
        const submissionReply = deferred<ChallengeSubmission | ModeratorSubmission>();
        api.board.mockResolvedValue(moderators ? initial.Challenges : initial);
        api.runtime.mockReturnValue(runtimeReply.promise);
        api.submit.mockReturnValue(submissionReply.promise);
        render(<QueryClientProvider client={client}><Session /></QueryClientProvider>);
        fireEvent.click(await screen.findByRole("button", {name: /^Pending task/}));
        fireEvent.change(screen.getByLabelText("Прапор"), {target: {value: "ICE{ok}"}});
        fireEvent.click(screen.getByRole("button", {name: "Надіслати"}));
        api.board.mockReturnValue(boardReply.promise);
        void client.refetchQueries({queryKey: [moderators ? "event-moderators-board" : "event-own-challenges", event.EventID], exact: true});
        fireEvent.click(screen.getByRole("button", {name: t("account.menu")}));
        await act(async () => {fireEvent.click(screen.getByRole("button", {name: "Вийти"}));});
        expect(screen.getByText("Signed out")).toBeTruthy();
        expect(client.getQueryCache().getAll()).toHaveLength(0);
        await act(async () => {
            boardReply.resolve(moderators ? initial.Challenges : initial);
            runtimeReply.resolve(runtime);
            if (failedSubmission) submissionReply.reject(new ParticipantChallengeError(409, ApiErrorCode.StageClosed));
            else submissionReply.resolve(moderators ? {Correct: true, FirstSolve: true, Lab: completedLab}
                : {Correct: true, FirstSolve: true, Practice: false, Lab: completedLab});
        });
        expect(client.getQueryCache().getAll()).toHaveLength(0);
        expect(client.getQueryDefaults(["event-lab-lifecycle", moderators ? "moderators" : "participant", event.EventID, runningLab.ID])).toEqual({});
        client.clear();
    });
});
