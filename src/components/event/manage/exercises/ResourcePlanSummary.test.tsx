// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {EventExerciseAttachment, Resources} from "@/api/manageChallenges";
import {ResourcePlanSummary} from "./ResourcePlanSummary";

const api = vi.hoisted(() => ({plan: vi.fn()}));
vi.mock("@/api/manageChallenges", () => ({getEventResourcePlan: api.plan}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

const res = (cpu: number, mib: number, devices = 0): Resources => ({CPUMillicores: cpu, MemoryBytes: mib * 1024 ** 2, Devices: devices});
const attachment = (id: string, name: string, max: Resources | null, heavy = false) =>
    ({ID: id, ExerciseName: name, ResourceHeavy: heavy, Resources: max && {Min: max, Max: max}}) as EventExerciseAttachment;

function view(attachments: EventExerciseAttachment[]) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><ResourcePlanSummary eventID="e" attachments={attachments} /></QueryClientProvider>);
}

describe("ResourcePlanSummary", () => {
    it("shows the total per task, the group overhead as a separate line and the team total", async () => {
        api.plan.mockResolvedValue({Overhead: {VPN: res(100, 128), Gateway: res(50, 64)}});
        const {container} = view([attachment("a", "Web", res(250, 1024, 2), true), attachment("b", "Pwn", res(125, 512, 1))]);
        await waitFor(() => expect(container.querySelector("[data-plan-total]")).not.toBeNull());
        const rows = Array.from(container.querySelectorAll("[data-plan-task]")).map(row => row.textContent);
        expect(rows[0]).toContain("Web");
        expect(rows[0]).toContain("Ресурсоємне");
        expect(rows[0]).toContain("250m");
        expect(rows[1]).toContain("512Mi");
        const overhead = container.querySelector("[data-plan-overhead]")!;
        expect(overhead.textContent).toContain("Службові поди групи");
        expect(overhead.textContent).toContain("CPU 150m · памʼять 192Mi");
        expect(overhead.textContent).toContain("VPN: CPU 100m · памʼять 128Mi; шлюз: CPU 50m · памʼять 64Mi");
        expect(container.querySelector("[data-plan-total]")!.textContent).toContain("525m");
    });

    it("renders nothing when no set has devices", () => {
        const {container} = view([attachment("a", "Quiz", null)]);
        expect(container.firstChild).toBeNull();
        expect(api.plan).not.toHaveBeenCalled();
    });

    it("shows a centered load error with a retry", async () => {
        api.plan.mockRejectedValueOnce(new Error("down")).mockResolvedValue({Overhead: {VPN: res(100, 128), Gateway: res(0, 0)}});
        const {container} = view([attachment("a", "Web", res(250, 1024, 2))]);
        fireEvent.click(await screen.findByRole("button", {name: "Спробувати ще раз"}));
        await waitFor(() => expect(container.querySelector("[data-plan-total]")).not.toBeNull());
    });
});
