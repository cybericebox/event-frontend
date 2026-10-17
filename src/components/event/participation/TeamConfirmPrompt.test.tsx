// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {OwnTeam, Participation} from "@/api/clientAuth";
import {formEventTeam} from "@/api/eventTeams";
import {t} from "@/i18n/t";
import {TeamConfirmPrompt} from "./TeamConfirmPrompt";

const context = vi.hoisted(() => ({value: null as unknown}));
const participation = vi.hoisted(() => ({value: null as unknown}));
vi.mock("@/components/event/ParticipantShell", () => ({useParticipantContext: () => context.value}));
vi.mock("./participationRules", () => ({useParticipation: () => ({data: participation.value}), reasonText: (code: string) => code}));
vi.mock("@/api/eventTeams", async importOriginal => ({...(await importOriginal<typeof import("@/api/eventTeams")>()), formEventTeam: vi.fn(async () => undefined)}));
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {this.setAttribute("open", "");};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {this.removeAttribute("open");};
afterEach(() => {cleanup(); vi.clearAllMocks();});

const team = (over: Partial<OwnTeam>) => ({ID: "t1", Name: "Blue", MemberCount: 3, Role: 0, Formed: false, ExtraFields: {}, ...over}) as OwnTeam;
const setup = (ownTeam: OwnTeam | null, state: Partial<Participation> | null) => {
    context.value = {ownTeam};
    participation.value = state && {FormTeam: {Allowed: true, Reason: ""}, TeamNeedsConfirmation: false, ...state};
    return render(<QueryClientProvider client={new QueryClient()}><TeamConfirmPrompt eventID="e1" /></QueryClientProvider>);
};

describe("TeamConfirmPrompt", () => {
    it("asks the captain to confirm, warns the roster closes, and confirms through the dialog", async () => {
        setup(team({}), {TeamNeedsConfirmation: true});
        expect(screen.getByText(t("participation.team.confirmPrompt"))).toBeTruthy();
        expect(screen.getByText(t("participation.team.confirmWarning"))).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: t("participation.team.form")}));
        fireEvent.click(await screen.findByRole("button", {name: t("participation.team.formAction")}));
        await waitFor(() => expect(formEventTeam).toHaveBeenCalledWith("e1"));
    });

    it("tells a member to wait for the captain, with no button", () => {
        setup(team({Role: 1}), {TeamNeedsConfirmation: true});
        expect(screen.getByText(t("participation.team.confirmWaiting"))).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("shows nothing where the start forms the teams", () => {
        const {container} = setup(team({}), {TeamNeedsConfirmation: false});
        expect(container.textContent).toBe("");
    });

    it("shows nothing once the team is formed", () => {
        const {container} = setup(team({Formed: true}), {TeamNeedsConfirmation: true});
        expect(container.textContent).toBe("");
    });
});

describe("no formation status in the participant UI", () => {
    it("no longer carries the status texts", async () => {
        const uk = (await import("../../../../messages/uk.json")).default as Record<string, string>;
        for (const key of ["participation.team.statusOpen", "participation.team.statusFormed", "participation.team.statusFormedAtStart", "challenges.teamNotFormed"]) expect(uk[key]).toBeUndefined();
    });
});
