// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ClientContentPage} from "./ClientContentPage";
const state = vi.hoisted(() => ({status: 0, visibility: 1, published: true}));
vi.mock("../ParticipantPreview", () => ({useParticipantPreview: () => ({active: true, state: {status: state.status}})}));
vi.mock("@/components/event/PrivateEventBootstrap", () => ({usePrivateEvent: () => null}));
vi.mock("./ContentBlocks", () => ({ContentBlocks: ({title}: {title: string}) => <p>{title}</p>}));
vi.mock("@/api/manage", async original => ({...await original<typeof import("@/api/manage")>(), getManagePage: async () => ({Slug: "rules", Title: "Participant-only page", PublishedAt: state.published ? "2026-01-01" : null, Visibility: state.visibility, Document: {blocks: []}}), getManageContent: async () => ({Variables: {}})}));
beforeEach(() => {state.status = 0; state.visibility = 1; state.published = true;});
afterEach(cleanup);
function view() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    // A previously opened staff page must never become a participant preview cache hit.
    client.setQueryData(["event-client-page", "event-1", "rules", "session"], {Page: {Title: "Staff cache", Document: {blocks: []}}, Variables: {}});
    return render(<QueryClientProvider client={client}><ClientContentPage publicEventID="event-1" slug="rules" /></QueryClientProvider>);
}
it("hides participant-only pages until the simulated registration is approved", async () => {
    view();
    await screen.findByText("Сторінку не знайдено або доступ обмежено");
    expect(screen.queryByText("Participant-only page")).toBeNull();
    expect(screen.queryByText("Staff cache")).toBeNull();
});
it("renders a published participant-only page after local approval", async () => {
    state.status = 2;
    view();
    expect(await screen.findByText("Participant-only page")).toBeTruthy();
});
it.each(["staff", "draft"])("hides %s pages even after local approval", async variant => {
    state.status = 2;
    state.visibility = variant === "staff" ? 2 : 1;
    state.published = variant !== "draft";
    view();
    await screen.findByText("Сторінку не знайдено або доступ обмежено");
    expect(screen.queryByText("Participant-only page")).toBeNull();
});
