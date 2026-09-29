// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ContentBlock} from "@/types/eventContent";
import {ContentBlocks} from "@/components/event/content/ContentBlocks";
import {PageBlockEditor} from "./PageBlockEditor";
import {previewValues} from "./previewScenario";

vi.mock("@/api/clientAuth", () => ({
    getCurrentUser: vi.fn(async () => null),
    getJoinStatus: vi.fn(async () => 0),
    getInvitationInfo: vi.fn(async () => ({Status: 0, Invited: false})),
}));
vi.mock("@/api/manage", () => ({
    getManagePages: vi.fn(async () => []),
    getManageContent: vi.fn(async () => ({})),
    uploadManageBannerImage: vi.fn(),
}));

afterEach(cleanup);

// Real state of the reported event: registration type closed, not started yet.
const real = {
    "event.tag": "test", "event.registration": "closed", "event.registrationOpen": false, "event.joinPolicy": "locked_at_start",
    "event.phase": "published", "event.isStarted": false, "event.isFinished": false,
    "event.startAt": new Date(Date.now() + 3_600_000).toISOString(), "event.effectiveFinishAt": new Date(Date.now() + 9 * 3_600_000).toISOString(),
    "event.scoreboardVisibility": "public",
};
const cta: ContentBlock = {id: "cta", type: "cta", title: "", text: "", action: {label: "Приєднатися", kind: "join_event", href: ""}};

function wrap(node: React.ReactNode) {
    return <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>;
}

describe("constructor preview", () => {
    it("shows the join button to a guest before the start even when real registration is closed", () => {
        render(wrap(<ContentBlocks document={{blocks: [cta]}} variables={previewValues(real, "before", "guest")} preview previewViewer="guest" />));
        expect(screen.getByRole("link", {name: "Приєднатися"}).getAttribute("href")).toBe("/join");
    });

    it("follows the preview registration toggle, not the real window", () => {
        render(wrap(<ContentBlocks document={{blocks: [cta]}} variables={previewValues(real, "before", "guest", "closed")} preview previewViewer="guest" />));
        expect(screen.queryByRole("link", {name: "Приєднатися"})).toBeNull();
        cleanup();
        // Locked at start, but the editor opened registration during the event.
        render(wrap(<ContentBlocks document={{blocks: [cta]}} variables={previewValues(real, "during", "moderator", "open")} preview previewViewer="moderator" />));
        expect(screen.getByRole("link", {name: "Приєднатися"})).toBeTruthy();
    });

    it("warns under a join button that the real site will not show it", () => {
        render(wrap(<PageBlockEditor eventID="event-1" coverImage="" block={cta} index={0} count={1} values={real} catalog={[]} canEdit selected onSelect={() => {}} onUpdate={() => {}} onMove={() => {}} onDelete={() => {}} />));
        const note = screen.getByRole("note");
        expect(note.textContent).toContain("Реєстрацію закрито");
        expect(screen.getByRole("link", {name: "Налаштування реєстрації"}).getAttribute("href")).toBe("/manage/registration");
    });

    it("does not warn when the real registration can open", () => {
        render(wrap(<PageBlockEditor eventID="event-1" coverImage="" block={cta} index={0} count={1} values={{...real, "event.registration": "open"}} catalog={[]} canEdit selected onSelect={() => {}} onUpdate={() => {}} onMove={() => {}} onDelete={() => {}} />));
        expect(screen.queryByRole("note")).toBeNull();
    });
});
