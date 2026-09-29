// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {OwnTeam} from "@/api/clientAuth";
import type {OwnParticipantAnswers} from "@/api/participantForm";
import {MissingFieldsNotice} from "./MissingFieldsNotice";

let pathname = "/challenges";
let answers: OwnParticipantAnswers | null = null;
vi.mock("next/navigation", () => ({usePathname: () => pathname}));
vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: React.ReactNode}) => <a href={href} {...rest}>{children}</a>}));
vi.mock("@/api/participantForm", async original => ({...(await original() as object), getOwnParticipantAnswers: async () => answers}));
vi.mock("@/api/eventTeams", async original => ({...(await original() as object), getSelfTeamFields: async () => ({Version: 1, Enabled: true, Required: true, Document: {blocks: [{id: "m", type: "field", key: "motto", input: "text", label: "Девіз"}]}})}));

afterEach(() => {cleanup(); pathname = "/challenges"; answers = null;});

const ownAnswers = (missing: string[], blocking = false): OwnParticipantAnswers => ({
    Form: {Version: 2, Enabled: true, Required: true, Document: {blocks: [{id: "s", type: "field", key: "school", input: "text", label: "Школа"}]}},
    Answers: {}, Editable: true, Missing: missing, Blocking: blocking,
});
const team = (missing: string[], blocking = false): OwnTeam => ({ID: "11111111-1111-4111-8111-111111111111", Name: "Blue", MemberCount: 1, JoinCode: "", JoinCodeExpiresAt: null, Role: 0, ExtraFields: {}, MissingFields: missing, BlockingFields: blocking});

function renderNotice(ownTeam: OwnTeam | null) {
    render(<QueryClientProvider client={new QueryClient()}><MissingFieldsNotice eventID="e1" ownTeam={ownTeam} /></QueryClientProvider>);
}

describe("MissingFieldsNotice", () => {
    it("asks a participant with missing fields to fill them and links to the profile", async () => {
        answers = ownAnswers(["school"]);
        renderNotice(null);
        expect(await screen.findByText("Заповніть нові поля")).toBeTruthy();
        expect(screen.getByText("Організатори додали обов’язкові поля до вашого профілю: Школа.")).toBeTruthy();
        expect(screen.getByRole("link", {name: "Перейти до профілю"}).getAttribute("href")).toBe("/participation");
    });

    it("says that submitting is blocked when the organizer chose it", async () => {
        answers = ownAnswers(["school"], true);
        renderNotice(null);
        expect(await screen.findByText(/Поки їх не заповнено, надсилати відповіді на завдання не можна\./)).toBeTruthy();
    });

    it("asks about the team fields too and links to the team page", async () => {
        answers = ownAnswers([]);
        renderNotice(team(["motto"], true));
        expect(await screen.findByText(/Організатори додали обов’язкові поля команди: Девіз\./)).toBeTruthy();
        expect(screen.getByRole("link", {name: "Перейти до команди"}).getAttribute("href")).toBe("/team");
        expect(screen.getByText(/Заповнити їх може капітан\. Поки їх не заповнено/)).toBeTruthy();
    });

    it("stays silent when nothing is missing", async () => {
        answers = ownAnswers([]);
        renderNotice(team([]));
        await waitFor(() => expect(document.querySelector(".ib-banner")).toBeNull());
    });

    it("stays silent on the pages that carry the marks themselves", async () => {
        answers = ownAnswers(["school"]);
        pathname = "/participation";
        renderNotice(team(["motto"]));
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(document.querySelector(".ib-banner")).toBeNull();
    });
});
