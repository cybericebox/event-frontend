// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const server = vi.hoisted(() => ({infrastructure: false, status: "not_published", configured: false}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "3f1c2d4e-0000-4000-8000-000000000001", Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: true})}));
vi.mock("@/api/manage", async original => ({
    ...(await original() as object),
    getManageConfig: async () => ({
        EventID: "3f1c2d4e-0000-4000-8000-000000000001", Participation: 0, Registration: 0, ScoreboardVisibility: 0, ParticipantsVisibility: 0,
        PreviewDescription: "", PreviewPicture: "", MaxTeamSize: 3, MinTeamSize: null, MaxTeams: null, InfrastructureAllowed: server.infrastructure,
        AllowPseudonyms: false, ShowDifficulty: true, HintsDisabled: false, HintChargeMode: 0,
    }),
    getManageLifecycle: async () => ({Configured: server.configured, Status: server.status}),
}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import ParticipationSettingsPage from "./page";

function renderPage() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ParticipationSettingsPage /></QueryClientProvider>);
}

describe("Налаштування участі, блок інфраструктури", () => {
    afterEach(() => { cleanup(); Object.assign(server, {infrastructure: false, status: "not_published", configured: false}); });

    it("before publication without infrastructure asks the platform administrator", async () => {
        renderPage();
        expect((await screen.findByTestId("infrastructure-note")).textContent).toBe("Потрібні завдання зі стендами? Попросіть адміністратора платформи увімкнути інфраструктуру — це можна зробити лише до публікації.");
    });

    it("before publication with infrastructure shows a one-line status", async () => {
        server.infrastructure = true;
        renderPage();
        expect((await screen.findByTestId("infrastructure-note")).textContent).toBe("Інфраструктура увімкнена");
    });

    it("after publication the block is hidden", async () => {
        Object.assign(server, {configured: true, status: "published", infrastructure: true});
        renderPage();
        await screen.findByRole("radiogroup");
        expect(screen.queryByTestId("infrastructure-note")).toBeNull();
    });
});
