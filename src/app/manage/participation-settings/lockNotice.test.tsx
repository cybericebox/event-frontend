// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const state = vi.hoisted(() => ({participation: 0 as 0 | 1, status: "published"}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e", Name: "Event", LogoURL: null}, canManage: true})}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("@/api/manage", async original => ({...await original() as object,
    getManageConfig: async () => ({Participation: state.participation, Registration: 1, ScoreboardVisibility: 2, ParticipantsVisibility: 1, PreviewDescription: "", PreviewPicture: "",
        MaxTeamSize: 4, MinTeamSize: null, MaxTeams: null, InfrastructureAllowed: false, AllowPseudonyms: false, ShowDifficulty: true, HintsDisabled: false, HintChargeMode: "reward",
        MaxFlagAttempts: null, TaskRevealMode: "all_ready", Theme: {Brand: "#211A52", Accent: "", Version: 1}}),
    getManageLifecycle: async () => ({Configured: true, Status: state.status}),
}));
const {default: Page} = await import("./page");
afterEach(cleanup);

function renderPage() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><Page /></QueryClientProvider>);
}

it("states the published lock as a neutral fact and hides Save when nothing can change", async () => {
    state.participation = 0; state.status = "published";
    renderPage();
    const note = (await screen.findByText("Після публікації змінити формат участі неможливо.")).closest("[role=note]")!;
    expect(note.className).toContain("event-manage-notice");
    expect(note.className).not.toContain("event-manage-warning");
    expect(screen.queryByRole("button", {name: "Зберегти"})).toBeNull();
});

it("keeps Save for team sizes after publication", async () => {
    state.participation = 1; state.status = "published";
    renderPage();
    await screen.findByText("Після публікації змінити формат участі неможливо.");
    expect(screen.getByRole("button", {name: "Зберегти"})).toBeTruthy();
});

it("warns before publication", async () => {
    state.participation = 0; state.status = "not_published";
    renderPage();
    const note = (await screen.findByText("Після публікації змінити формат участі неможливо.")).closest("[role=note]")!;
    expect(note.className).toContain("event-manage-warning");
    expect(screen.getByRole("button", {name: "Зберегти"})).toBeTruthy();
});
