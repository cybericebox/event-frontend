// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, renderHook, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";
import type {ManageConfig, ManageLifecycle} from "@/api/manage";

const config = {Participation: 1, Registration: 2, MaxTeamSize: 4, InfrastructureAllowed: false} as ManageConfig;
const lifecycle = {Configured: true, Status: "published", Infrastructure: {HasDynamicLabs: false, LaboratoriesAvailable: false, RequiresVPN: false, CanStart: true}} as ManageLifecycle;
vi.mock("@/api/manage", async importOriginal => ({...await importOriginal<object>(),
    getManageConfig: async () => config, getManageLifecycle: async () => lifecycle,
    getManageContent: async () => {throw new Error("offline");},
}));
vi.mock("@/api/manageChallenges", async importOriginal => ({...await importOriginal<object>(), getEventExerciseAttachments: async () => []}));
vi.mock("@/api/manageMail", async importOriginal => ({...await importOriginal<object>(), getEventMailSettings: async () => {throw new Error("offline");}}));
vi.mock("../exercises/useBoardSets", () => ({useBoardSets: () => ({sets: {isPending: false, data: []}})}));

const {useSetup} = await import("./useSetup");
afterEach(cleanup);

it("does not wait for retries of the optional reads: a failed part only drops its step", async () => {
    // The default client retries three times with back-off (~7 s); the checklist must not wait for that.
    const client = new QueryClient();
    const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const {result} = renderHook(() => useSetup("e1"), {wrapper});
    await waitFor(() => expect(result.current).not.toBeNull(), {timeout: 1500});
    const ids = result.current!.steps.map(step => step.id);
    expect(ids).not.toContain("pages");
    expect(ids).not.toContain("mail");
});
