// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const state = vi.hoisted(() => ({infra: false}));
vi.mock("@/api/manage", async original => ({
    ...(await original() as object),
    getManageConfig: async () => ({Participation: 1, Registration: 2, MaxTeamSize: 4, InfrastructureAllowed: state.infra}),
    getManageLifecycle: async () => ({Configured: true, Status: "published", Infrastructure: {HasDynamicLabs: state.infra, CanStart: !state.infra}}),
    getManageContent: async () => ({Landing: {blocks: [{}]}, LandingDraft: null}),
}));
vi.mock("@/api/manageChallenges", async original => ({...(await original() as object), getEventExerciseAttachments: async () => [{Status: 0, Infrastructure: false}]}));
vi.mock("@/api/manageMail", async original => ({
    ...(await original() as object),
    getEventMailSettings: async () => ({Identity: {Sender: {Address: "a@b.c"}}, Inherited: {Sender: {Address: ""}}}),
}));

import {SetupChip} from "./SetupChip";

afterEach(cleanup);

function renderChip() {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><SetupChip eventID="e1" /></QueryClientProvider>);
}

describe("SetupChip", () => {
    it("shows a quiet «Готово» linking to the wizard when all is done and published", async () => {
        state.infra = false;
        renderChip();
        const chip = await screen.findByRole("link", {name: /Готово/});
        expect(chip.getAttribute("href")).toBe("/manage");
        expect(chip.className).toContain("is-done");
    });

    it("turns into a warning when a blocker exists", async () => {
        state.infra = true;
        renderChip();
        const chip = await screen.findByRole("link", {name: /Є блокери/});
        expect(chip.className).toContain("is-blocked");
    });
});
